import { describe, expect, it } from 'vitest'

import type { ChatEvent } from './events'
import { applyEvent, applyEvents } from './reducer'
import type { ChatMessage, ReasoningPart, TextPart, ToolPart } from './types'

const NOW = 1_000_000

function empty(): ChatMessage {
  return { id: 'm1', role: 'assistant', parts: [] }
}

function replay(events: ChatEvent[], now = NOW): ChatMessage {
  return applyEvents(empty(), events, now)
}

describe('applyEvent', () => {
  it('never mutates the input message', () => {
    const message = empty()
    const next = applyEvent(message, { type: 'text-delta', delta: 'hi' }, NOW)
    expect(message.parts).toEqual([])
    expect(next).not.toBe(message)
  })

  it('appends consecutive text deltas into one part', () => {
    const message = replay([
      { type: 'text-delta', delta: 'Hello' },
      { type: 'text-delta', delta: ', world' },
    ])
    expect(message.parts).toEqual([{ type: 'text', text: 'Hello, world' }])
  })

  it('starts a second text part after an intervening tool call', () => {
    const message = replay([
      { type: 'text-delta', delta: 'before' },
      { type: 'tool-input-start', toolCallId: 't1', name: 'f' },
      { type: 'text-delta', delta: 'after' },
    ])

    expect(message.parts.map((part) => part.type)).toEqual(['text', 'tool', 'text'])
    expect((message.parts[2] as TextPart).text).toBe('after')
  })

  it('keeps unchanged parts referentially stable', () => {
    const first = replay([
      { type: 'text-delta', delta: 'a' },
      { type: 'tool-input-start', toolCallId: 't1', name: 'f' },
    ])
    const second = applyEvent(
      first,
      { type: 'tool-input-delta', toolCallId: 't1', delta: '{}' },
      NOW,
    )

    // Memoised part renderers depend on this: touching the tool must not re-render text.
    expect(second.parts[0]).toBe(first.parts[0])
    expect(second.parts[1]).not.toBe(first.parts[1])
  })

  it('records reasoning duration on reasoning-end', () => {
    let message = applyEvent(empty(), { type: 'reasoning-start' }, NOW)
    message = applyEvent(message, { type: 'reasoning-delta', delta: 'thinking' }, NOW)
    message = applyEvent(message, { type: 'reasoning-end' }, NOW + 4200)

    expect(message.parts[0]).toMatchObject({
      type: 'reasoning',
      text: 'thinking',
      durationMs: 4200,
    })
  })

  it('ignores a duplicate reasoning-end', () => {
    let message = applyEvent(empty(), { type: 'reasoning-start' }, NOW)
    message = applyEvent(message, { type: 'reasoning-end' }, NOW + 1000)
    message = applyEvent(message, { type: 'reasoning-end' }, NOW + 9999)

    expect((message.parts[0] as ReasoningPart).durationMs).toBe(1000)
  })

  it('accumulates tool arguments and parses them when execution starts', () => {
    const message = replay([
      { type: 'tool-input-start', toolCallId: 't1', name: 'get_weather' },
      { type: 'tool-input-delta', toolCallId: 't1', delta: '{"city"' },
      { type: 'tool-input-delta', toolCallId: 't1', delta: ':"SF"}' },
      { type: 'tool-executing', toolCallId: 't1' },
    ])

    expect(message.parts[0]).toMatchObject({
      type: 'tool',
      name: 'get_weather',
      state: 'executing',
      inputText: '{"city":"SF"}',
      input: { city: 'SF' },
    })
  })

  it('keeps raw text when the arguments are not valid JSON', () => {
    const message = replay([
      { type: 'tool-input-start', toolCallId: 't1', name: 'f' },
      { type: 'tool-input-delta', toolCallId: 't1', delta: '{"truncat' },
      { type: 'tool-executing', toolCallId: 't1' },
    ])

    const part = message.parts[0] as ToolPart
    // Truncated arguments are common on an aborted stream; showing the raw text beats
    // showing an empty panel.
    expect(part.input).toBeUndefined()
    expect(part.inputText).toBe('{"truncat')
  })

  it('records tool duration on output', () => {
    let message = applyEvent(
      empty(),
      { type: 'tool-input-start', toolCallId: 't1', name: 'f' },
      NOW,
    )
    message = applyEvent(
      message,
      { type: 'tool-output', toolCallId: 't1', output: { ok: true } },
      NOW + 250,
    )

    expect(message.parts[0]).toMatchObject({
      state: 'output-available',
      output: { ok: true },
      durationMs: 250,
    })
  })

  it('synthesises a part for output from a call it never saw start', () => {
    const message = replay([{ type: 'tool-output', toolCallId: 'ghost', output: 1 }])
    expect(message.parts[0]).toMatchObject({
      type: 'tool',
      toolCallId: 'ghost',
      name: 'unknown',
      state: 'output-available',
    })
  })

  it('routes updates to the right call when several are in flight', () => {
    const message = replay([
      { type: 'tool-input-start', toolCallId: 'a', name: 'one' },
      { type: 'tool-input-start', toolCallId: 'b', name: 'two' },
      { type: 'tool-error', toolCallId: 'a', error: 'boom' },
      { type: 'tool-output', toolCallId: 'b', output: 'fine' },
    ])

    expect(message.parts[0]).toMatchObject({
      toolCallId: 'a',
      state: 'output-error',
      error: 'boom',
    })
    expect(message.parts[1]).toMatchObject({ toolCallId: 'b', state: 'output-available' })
  })

  it('fails a tool that never returned when the stream ends', () => {
    const message = replay([
      { type: 'tool-input-start', toolCallId: 't1', name: 'f' },
      { type: 'tool-executing', toolCallId: 't1' },
      { type: 'message-end' },
    ])

    // Otherwise the row spins forever.
    expect(message.parts[0]).toMatchObject({ state: 'output-error' })
    expect(message.status).toBe('complete')
  })

  it('closes a dangling reasoning block on message-end', () => {
    let message = applyEvent(empty(), { type: 'reasoning-start' }, NOW)
    message = applyEvent(message, { type: 'message-end' }, NOW + 700)
    expect((message.parts[0] as ReasoningPart).durationMs).toBe(700)
  })

  it('stores finish reason and usage in metadata', () => {
    const message = replay([
      { type: 'message-end', finishReason: 'stop', usage: { inputTokens: 3, outputTokens: 9 } },
    ])
    expect(message.metadata).toEqual({
      finishReason: 'stop',
      usage: { inputTokens: 3, outputTokens: 9 },
    })
  })

  it('appends an error part and marks the message failed', () => {
    const message = replay([
      { type: 'text-delta', delta: 'partial' },
      { type: 'error', error: 'network down' },
    ])

    expect(message.status).toBe('error')
    expect(message.parts.at(-1)).toEqual({
      type: 'error',
      message: 'network down',
      retryable: true,
    })
  })

  it('replaces an a2ui surface in place when it is re-emitted', () => {
    const message = replay([
      { type: 'a2ui', surfaceId: 's1', spec: { type: 'Card' } },
      { type: 'text-delta', delta: 'after' },
      { type: 'a2ui', surfaceId: 's1', spec: { type: 'Card', children: [{ type: 'Text' }] } },
    ])

    // Streaming a progressively-parsed spec must not push the card to the bottom.
    expect(message.parts.map((part) => part.type)).toEqual(['a2ui', 'text'])
    expect(message.parts[0]).toMatchObject({
      spec: { type: 'Card', children: [{ type: 'Text' }] },
    })
  })

  it('merges an a2ui data patch at a path', () => {
    const message = replay([
      {
        type: 'a2ui',
        surfaceId: 's1',
        spec: { type: 'Card' },
        data: { order: { status: 'pending' } },
      },
      {
        type: 'a2ui-patch',
        surfaceId: 's1',
        patch: { op: 'merge', path: 'order', value: { status: 'done' } },
      },
    ])

    expect(message.parts[0]).toMatchObject({ data: { order: { status: 'done' } } })
  })

  it('refuses to write through __proto__ in a patch path', () => {
    const message = replay([
      { type: 'a2ui', surfaceId: 's1', spec: { type: 'Card' }, data: {} },
      {
        type: 'a2ui-patch',
        surfaceId: 's1',
        patch: { op: 'replace', path: '__proto__.polluted', value: 1 },
      },
    ])

    expect(message.parts[0]).toMatchObject({ data: {} })
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('ignores a patch for a surface that does not exist', () => {
    const message = replay([
      { type: 'a2ui-patch', surfaceId: 'missing', patch: { op: 'replace', value: 1 } },
    ])
    expect(message.parts).toEqual([])
  })

  it('replaces a re-sent permission request in place', () => {
    const message = replay([
      { type: 'permission-request', request: { id: 'p1', toolName: 'bash', detail: 'ls' } },
      { type: 'text-delta', delta: 'after' },
      { type: 'permission-request', request: { id: 'p1', toolName: 'bash', detail: 'ls -la' } },
    ])

    // Two menus for one action would leave one of them unanswerable.
    expect(message.parts.map((part) => part.type)).toEqual(['permission', 'text'])
    expect(message.parts[0]).toMatchObject({ request: { detail: 'ls -la' } })
  })

  it('attaches an out-of-band resolution to its request', () => {
    const message = replay([
      { type: 'permission-request', request: { id: 'p1', toolName: 'bash' } },
      {
        type: 'permission-resolved',
        requestId: 'p1',
        resolution: { requestId: 'p1', option: 'allow-once', decision: 'allow-once' },
      },
    ])

    expect(message.parts[0]).toMatchObject({
      type: 'permission',
      resolution: { decision: 'allow-once' },
    })
  })

  it('ignores a resolution for a request it never saw', () => {
    const message = replay([
      {
        type: 'permission-resolved',
        requestId: 'ghost',
        resolution: { requestId: 'ghost', option: 'deny', decision: 'deny' },
      },
    ])
    expect(message.parts).toEqual([])
  })

  it('leaves an undecided permission request pending when the stream ends', () => {
    const message = replay([
      { type: 'permission-request', request: { id: 'p1', toolName: 'bash' } },
      { type: 'message-end' },
    ])

    // Waiting on a human is the normal terminal state of an approval turn; auto-denying
    // here would be the renderer making a security decision that belongs to the host.
    expect(message.parts[0]).toEqual({
      type: 'permission',
      request: { id: 'p1', toolName: 'bash' },
    })
    expect(message.status).toBe('complete')
  })

  it('replaces a todo list in place when the plan is revised', () => {
    const message = replay([
      { type: 'todo', todoId: 'plan', items: [{ id: '1', title: '读代码', status: 'pending' }] },
      { type: 'text-delta', delta: 'after' },
      {
        type: 'todo',
        todoId: 'plan',
        items: [
          { id: '1', title: '读代码', status: 'completed' },
          { id: '2', title: '改代码', status: 'in-progress' },
        ],
      },
    ])

    // An agent revises its plan many times per run; appending each revision would bury
    // the conversation under checklists.
    expect(message.parts.map((part) => part.type)).toEqual(['todo', 'text'])
    expect(message.parts[0]).toMatchObject({ todoId: 'plan', items: [{}, { id: '2' }] })
  })

  it('keeps two todo lists apart when their ids differ', () => {
    const message = replay([
      { type: 'todo', items: [{ id: '1', title: 'a', status: 'pending' }] },
      { type: 'todo', todoId: 'sub', items: [{ id: '2', title: 'b', status: 'pending' }] },
    ])

    expect(message.parts.map((part) => part.type)).toEqual(['todo', 'todo'])
    expect(message.parts[0]).toMatchObject({ todoId: 'default' })
  })
})
