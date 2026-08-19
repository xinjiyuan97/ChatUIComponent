import { describe, expect, it } from 'vitest'

import type { ChatEvent } from '../events'
import { createAnthropicEventMapper } from './anthropic'

function run(events: unknown[]): ChatEvent[] {
  const mapper = createAnthropicEventMapper()
  return events.flatMap((event) => mapper.push(event as never))
}

describe('createAnthropicEventMapper', () => {
  it('maps a plain text turn', () => {
    const events = run([
      { type: 'message_start', message: { id: 'msg_1', usage: { input_tokens: 12 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' there' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ])

    expect(events.map((event) => event.type)).toEqual([
      'message-start',
      'text-start',
      'text-delta',
      'text-delta',
      'message-end',
    ])
    expect(events[0]).toEqual({ type: 'message-start', id: 'msg_1' })
    expect(events.at(-1)).toEqual({
      type: 'message-end',
      finishReason: 'end_turn',
      usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
    })
  })

  it('emits content already present on content_block_start', () => {
    const events = run([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'preloaded' } },
    ])
    expect(events).toContainEqual({ type: 'text-delta', delta: 'preloaded' })
  })

  it('maps thinking blocks to reasoning events', () => {
    const events = run([
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
      // The signature delta carries a cryptographic signature, not renderable content.
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'signature_delta', signature: 'abc' },
      },
      { type: 'content_block_stop', index: 0 },
    ])

    expect(events.map((event) => event.type)).toEqual([
      'message-start',
      'reasoning-start',
      'reasoning-delta',
      'reasoning-end',
    ])
  })

  it('accumulates tool input from partial_json deltas', () => {
    const events = run([
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'toolu_1', name: 'search' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"q"' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: ':"x"}' },
      },
      { type: 'content_block_stop', index: 0 },
    ])

    expect(events).toContainEqual({
      type: 'tool-input-start',
      toolCallId: 'toolu_1',
      name: 'search',
    })
    expect(
      events
        .filter(
          (e): e is Extract<ChatEvent, { type: 'tool-input-delta' }> =>
            e.type === 'tool-input-delta',
        )
        .map((e) => e.delta)
        .join(''),
    ).toBe('{"q":"x"}')
    expect(events.at(-1)).toEqual({ type: 'tool-executing', toolCallId: 'toolu_1' })
  })

  it('routes deltas to the right block when two are interleaved by index', () => {
    const events = run([
      { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_2', name: 'calc' },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{}' },
      },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } },
    ])

    expect(events).toContainEqual({ type: 'tool-input-delta', toolCallId: 'toolu_2', delta: '{}' })
    expect(events).toContainEqual({ type: 'text-delta', delta: 'ok' })
  })

  it('closes blocks the provider left open when the message stops', () => {
    const events = run([
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_3', name: 'f' },
      },
      { type: 'message_stop' },
    ])

    expect(events.slice(-3).map((event) => event.type)).toEqual([
      'reasoning-end',
      'tool-executing',
      'message-end',
    ])
  })

  it('surfaces provider errors as error events', () => {
    const events = run([
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ])
    expect(events).toEqual([{ type: 'error', error: 'Overloaded' }])
  })

  it('ignores ping and unknown event types', () => {
    expect(run([{ type: 'ping' }, { type: 'something_new' }])).toEqual([])
  })

  it('opens the message implicitly when message_start is missing', () => {
    // Some proxies drop message_start when replaying a cached turn.
    const events = run([{ type: 'content_block_start', index: 0, content_block: { type: 'text' } }])
    expect(events[0]).toEqual({ type: 'message-start' })
  })

  it('preserves an empty partial_json delta', () => {
    const events = run([
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 't', name: 'f' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '' },
      },
    ])
    expect(events).toContainEqual({ type: 'tool-input-delta', toolCallId: 't', delta: '' })
  })
})
