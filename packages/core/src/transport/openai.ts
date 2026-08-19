import type { ChatEvent } from '../events'
import type { HttpTransportOptions } from './http'
import { fetchSSE } from './http'
import type { ChatTransport, SendRequest, TransportContext } from './types'

type OpenAIToolCallDelta = {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
}

type OpenAIChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      /** DeepSeek-R1 and compatible gateways. */
      reasoning_content?: string | null
      /** Some gateways use this name instead. */
      reasoning?: string | null
      tool_calls?: OpenAIToolCallDelta[]
    }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null
}

/**
 * Stateful mapper from OpenAI `chat.completions` chunks to normalised events.
 *
 * Exposed separately from the transport so the wire-format logic can be unit-tested
 * without a fetch mock.
 */
export function createOpenAIEventMapper() {
  /** Tool calls arrive keyed by `index`; `id` and `name` only appear on the first chunk. */
  const toolsByIndex = new Map<number, { id: string; name: string }>()
  let started = false
  let inReasoning = false
  let sawText = false

  function push(chunk: OpenAIChunk): ChatEvent[] {
    const events: ChatEvent[] = []
    if (!started) {
      started = true
      events.push({ type: 'message-start' })
    }

    const choice = chunk.choices?.[0]
    const delta = choice?.delta

    if (delta) {
      const reasoning = delta.reasoning_content ?? delta.reasoning
      if (reasoning) {
        if (!inReasoning) {
          inReasoning = true
          events.push({ type: 'reasoning-start' })
        }
        events.push({ type: 'reasoning-delta', delta: reasoning })
      }

      // Any non-reasoning output closes the reasoning block.
      if ((delta.content || delta.tool_calls?.length) && inReasoning) {
        inReasoning = false
        events.push({ type: 'reasoning-end' })
      }

      if (delta.content) {
        if (!sawText) {
          sawText = true
          events.push({ type: 'text-start' })
        }
        events.push({ type: 'text-delta', delta: delta.content })
      }

      for (const call of delta.tool_calls ?? []) {
        const index = call.index ?? 0
        let known = toolsByIndex.get(index)

        if (!known) {
          known = { id: call.id ?? `tool_${index}`, name: call.function?.name ?? 'unknown' }
          toolsByIndex.set(index, known)
          events.push({ type: 'tool-input-start', toolCallId: known.id, name: known.name })
        } else if (call.id && call.id !== known.id) {
          // A new id on a reused index means the previous call finished and another
          // started in the same slot.
          known = { id: call.id, name: call.function?.name ?? 'unknown' }
          toolsByIndex.set(index, known)
          events.push({ type: 'tool-input-start', toolCallId: known.id, name: known.name })
        }

        const args = call.function?.arguments
        if (args) {
          events.push({ type: 'tool-input-delta', toolCallId: known.id, delta: args })
        }
      }
    }

    const finish = choice?.finish_reason
    if (finish) {
      events.push(...closeOpenBlocks())
      events.push({
        type: 'message-end',
        finishReason: finish,
        usage: chunk.usage
          ? {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          : undefined,
      })
    } else if (chunk.usage && !choice) {
      // Final usage-only chunk emitted when `stream_options.include_usage` is set.
      events.push({
        type: 'message-end',
        usage: {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        },
      })
    }

    return events
  }

  function closeOpenBlocks(): ChatEvent[] {
    const events: ChatEvent[] = []
    if (inReasoning) {
      inReasoning = false
      events.push({ type: 'reasoning-end' })
    }
    // Arguments are complete once the turn finishes; let the reducer parse the JSON.
    for (const tool of toolsByIndex.values()) {
      events.push({ type: 'tool-executing', toolCallId: tool.id })
    }
    toolsByIndex.clear()
    return events
  }

  return { push, closeOpenBlocks }
}

/**
 * Transport for an endpoint that forwards OpenAI-compatible SSE verbatim.
 *
 * Point this at your own proxy, not at `api.openai.com` — a browser-side API key is
 * readable by anyone who opens devtools.
 */
export function createOpenAITransport(options: HttpTransportOptions): ChatTransport {
  return {
    async *send(request: SendRequest, context: TransportContext) {
      const mapper = createOpenAIEventMapper()
      let finished = false

      for await (const message of fetchSSE(options, request, context)) {
        if (!message.data || message.data === '[DONE]') {
          if (message.data === '[DONE]') break
          continue
        }
        let chunk: OpenAIChunk
        try {
          chunk = JSON.parse(message.data) as OpenAIChunk
        } catch {
          continue
        }
        for (const event of mapper.push(chunk)) {
          if (event.type === 'message-end') finished = true
          yield event
        }
      }

      if (!finished) {
        // `[DONE]` without a `finish_reason` chunk is common on proxies.
        yield* mapper.closeOpenBlocks()
        yield { type: 'message-end' }
      }
    },
  }
}
