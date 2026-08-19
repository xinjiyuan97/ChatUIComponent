import { describe, expect, it } from 'vitest'

import type { ChatEvent } from '../events'
import { createOpenAIEventMapper } from './openai'

/** Feeds chunks through the mapper and returns the flattened event stream. */
function run(chunks: unknown[]): ChatEvent[] {
  const mapper = createOpenAIEventMapper()
  return chunks.flatMap((chunk) => mapper.push(chunk as never))
}

const textChunk = (content: string) => ({ choices: [{ delta: { content } }] })

describe('createOpenAIEventMapper', () => {
  it('opens the message exactly once', () => {
    const events = run([textChunk('a'), textChunk('b')])
    expect(events.filter((event) => event.type === 'message-start')).toHaveLength(1)
  })

  it('maps content deltas to text events', () => {
    const events = run([textChunk('Hello '), textChunk('world')])
    expect(events.filter((event) => event.type === 'text-delta')).toEqual([
      { type: 'text-delta', delta: 'Hello ' },
      { type: 'text-delta', delta: 'world' },
    ])
    expect(events.filter((event) => event.type === 'text-start')).toHaveLength(1)
  })

  it('maps reasoning_content to a reasoning block', () => {
    const events = run([
      { choices: [{ delta: { reasoning_content: 'let me think' } }] },
      { choices: [{ delta: { reasoning_content: ' harder' } }] },
      textChunk('answer'),
    ])

    expect(events.map((event) => event.type)).toEqual([
      'message-start',
      'reasoning-start',
      'reasoning-delta',
      'reasoning-delta',
      'reasoning-end',
      'text-start',
      'text-delta',
    ])
  })

  it('accepts the `reasoning` field name too', () => {
    const events = run([{ choices: [{ delta: { reasoning: 'hmm' } }] }])
    expect(events).toContainEqual({ type: 'reasoning-delta', delta: 'hmm' })
  })

  it('accumulates tool arguments across chunks by index', () => {
    const events = run([
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'call_1', function: { name: 'get_weather', arguments: '' } },
              ],
            },
          },
        ],
      },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"ci' } }] } }] },
      {
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ty":"SF"}' } }] } }],
      },
    ])

    expect(events).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'call_1',
      name: 'get_weather',
    })
    // The name and id only appear on the first chunk, so later deltas must reuse them.
    expect(events.filter((event) => event.type === 'tool-input-start')).toHaveLength(1)
    expect(
      events
        .filter(
          (event): event is Extract<ChatEvent, { type: 'tool-input-delta' }> =>
            event.type === 'tool-input-delta',
        )
        .map((event) => event.delta)
        .join(''),
    ).toBe('{"city":"SF"}')
  })

  it('tracks parallel tool calls independently', () => {
    const events = run([
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: 'a', function: { name: 'one', arguments: '{"x":' } },
                { index: 1, id: 'b', function: { name: 'two', arguments: '{"y":' } },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 1, function: { arguments: '2}' } },
                { index: 0, function: { arguments: '1}' } },
              ],
            },
          },
        ],
      },
    ])

    const deltas = events.filter(
      (event): event is Extract<ChatEvent, { type: 'tool-input-delta' }> =>
        event.type === 'tool-input-delta',
    )
    expect(
      deltas
        .filter((d) => d.toolCallId === 'a')
        .map((d) => d.delta)
        .join(''),
    ).toBe('{"x":1}')
    expect(
      deltas
        .filter((d) => d.toolCallId === 'b')
        .map((d) => d.delta)
        .join(''),
    ).toBe('{"y":2}')
  })

  it('starts a new call when an index is reused with a different id', () => {
    const events = run([
      {
        choices: [{ delta: { tool_calls: [{ index: 0, id: 'first', function: { name: 'f' } }] } }],
      },
      {
        choices: [{ delta: { tool_calls: [{ index: 0, id: 'second', function: { name: 'g' } }] } }],
      },
    ])

    expect(events.filter((event) => event.type === 'tool-input-start')).toEqual([
      { type: 'tool-input-start', toolCallId: 'first', name: 'f' },
      { type: 'tool-input-start', toolCallId: 'second', name: 'g' },
    ])
  })

  it('closes open tool calls and reasoning on finish_reason', () => {
    const events = run([
      { choices: [{ delta: { reasoning_content: 'thinking' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'x', function: { name: 'f' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ])

    const tail = events.slice(-2)
    expect(tail).toEqual([
      { type: 'tool-executing', toolCallId: 'x' },
      { type: 'message-end', finishReason: 'tool_calls', usage: undefined },
    ])
  })

  it('maps usage onto message-end', () => {
    const events = run([
      {
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
    ])

    expect(events.at(-1)).toEqual({
      type: 'message-end',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    })
  })

  it('handles a usage-only trailing chunk', () => {
    const events = run([
      textChunk('hi'),
      { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
    ])

    expect(events.at(-1)).toEqual({
      type: 'message-end',
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    })
  })

  it('ignores empty content deltas', () => {
    // Azure and several proxies emit a role-only opening chunk with `content: ""`.
    const events = run([{ choices: [{ delta: { role: 'assistant', content: '' } }] }])
    expect(events).toEqual([{ type: 'message-start' }])
  })
})
