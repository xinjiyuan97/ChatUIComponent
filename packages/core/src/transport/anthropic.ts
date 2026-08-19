import type { ChatEvent } from '../events'
import type { TokenUsage } from '../types'
import type { HttpTransportOptions } from './http'
import { fetchSSE } from './http'
import type { ChatTransport, SendRequest, TransportContext } from './types'

type AnthropicStreamEvent = {
  type?: string
  index?: number
  message?: { id?: string; usage?: { input_tokens?: number; output_tokens?: number } }
  content_block?: { type?: string; id?: string; name?: string; input?: unknown; text?: string }
  delta?: {
    type?: string
    text?: string
    thinking?: string
    partial_json?: string
    stop_reason?: string | null
  }
  usage?: { input_tokens?: number; output_tokens?: number }
  error?: { type?: string; message?: string }
}

type BlockKind =
  { kind: 'text' } | { kind: 'thinking' } | { kind: 'tool'; toolCallId: string } | { kind: 'other' }

/**
 * Stateful mapper from Anthropic Messages SSE events to normalised events.
 *
 * Anthropic addresses content blocks by `index`, so the block type is only known from
 * `content_block_start` and has to be remembered for the deltas that follow.
 */
export function createAnthropicEventMapper() {
  const blocks = new Map<number, BlockKind>()
  let usage: TokenUsage = {}
  let stopReason: string | undefined
  let started = false

  function push(event: AnthropicStreamEvent): ChatEvent[] {
    const events: ChatEvent[] = []

    switch (event.type) {
      case 'message_start': {
        started = true
        events.push({ type: 'message-start', id: event.message?.id })
        const input = event.message?.usage?.input_tokens
        if (input !== undefined) usage = { ...usage, inputTokens: input }
        break
      }

      case 'content_block_start': {
        if (!started) {
          started = true
          events.push({ type: 'message-start' })
        }
        const index = event.index ?? 0
        const block = event.content_block

        if (block?.type === 'thinking' || block?.type === 'redacted_thinking') {
          blocks.set(index, { kind: 'thinking' })
          events.push({ type: 'reasoning-start' })
        } else if (block?.type === 'tool_use' || block?.type === 'server_tool_use') {
          const toolCallId = block.id ?? `tool_${index}`
          blocks.set(index, { kind: 'tool', toolCallId })
          events.push({ type: 'tool-input-start', toolCallId, name: block.name ?? 'unknown' })
        } else if (block?.type === 'text') {
          blocks.set(index, { kind: 'text' })
          events.push({ type: 'text-start' })
          // A text block can be opened with content already in it.
          if (block.text) events.push({ type: 'text-delta', delta: block.text })
        } else {
          blocks.set(index, { kind: 'other' })
        }
        break
      }

      case 'content_block_delta': {
        const block = blocks.get(event.index ?? 0)
        const delta = event.delta

        if (delta?.type === 'text_delta' && delta.text) {
          events.push({ type: 'text-delta', delta: delta.text })
        } else if (delta?.type === 'thinking_delta' && delta.thinking) {
          events.push({ type: 'reasoning-delta', delta: delta.thinking })
        } else if (delta?.type === 'input_json_delta' && block?.kind === 'tool') {
          // `partial_json` can legitimately be an empty string; only skip undefined.
          if (delta.partial_json !== undefined) {
            events.push({
              type: 'tool-input-delta',
              toolCallId: block.toolCallId,
              delta: delta.partial_json,
            })
          }
        }
        // `signature_delta` carries the thinking signature and has nothing to render.
        break
      }

      case 'content_block_stop': {
        const index = event.index ?? 0
        const block = blocks.get(index)
        if (block?.kind === 'thinking') events.push({ type: 'reasoning-end' })
        if (block?.kind === 'tool') {
          events.push({ type: 'tool-executing', toolCallId: block.toolCallId })
        }
        blocks.delete(index)
        break
      }

      case 'message_delta': {
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason
        const output = event.usage?.output_tokens
        if (output !== undefined) usage = { ...usage, outputTokens: output }
        break
      }

      case 'message_stop':
        events.push(...finish())
        break

      case 'error':
        events.push({ type: 'error', error: event.error?.message ?? 'Unknown provider error' })
        break

      // `ping` and unrecognised event types carry nothing renderable.
      default:
        break
    }

    return events
  }

  function finish(): ChatEvent[] {
    const events: ChatEvent[] = []
    // Close anything the provider left open (happens on an aborted stream).
    for (const [index, block] of blocks) {
      if (block.kind === 'thinking') events.push({ type: 'reasoning-end' })
      if (block.kind === 'tool') {
        events.push({ type: 'tool-executing', toolCallId: block.toolCallId })
      }
      blocks.delete(index)
    }
    const total =
      usage.inputTokens !== undefined && usage.outputTokens !== undefined
        ? usage.inputTokens + usage.outputTokens
        : undefined
    events.push({
      type: 'message-end',
      finishReason: stopReason,
      usage: { ...usage, totalTokens: total },
    })
    return events
  }

  return { push, finish }
}

/**
 * Transport for an endpoint that forwards Anthropic Messages SSE verbatim.
 *
 * As with the OpenAI adapter, point this at your own proxy — never ship an API key to
 * the browser.
 */
export function createAnthropicTransport(options: HttpTransportOptions): ChatTransport {
  return {
    async *send(request: SendRequest, context: TransportContext) {
      const mapper = createAnthropicEventMapper()
      let finished = false

      for await (const message of fetchSSE(options, request, context)) {
        if (!message.data || message.data === '[DONE]') continue
        let parsed: AnthropicStreamEvent
        try {
          parsed = JSON.parse(message.data) as AnthropicStreamEvent
        } catch {
          continue
        }
        // Prefer the SSE `event:` name; some proxies drop `type` from the payload.
        if (!parsed.type && message.event) parsed.type = message.event

        for (const event of mapper.push(parsed)) {
          if (event.type === 'message-end') finished = true
          yield event
        }
      }

      if (!finished) yield* mapper.finish()
    },
  }
}
