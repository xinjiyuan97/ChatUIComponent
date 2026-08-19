import type { ChatEvent } from '../events'
import type { HttpTransportOptions } from './http'
import { fetchSSE } from './http'
import type { SSEMessage } from './sse-parser'
import type { ChatTransport, SendRequest, TransportContext } from './types'

export type SSETransportOptions = HttpTransportOptions & {
  /**
   * Converts one SSE message into zero or more `ChatEvent`s. Defaults to parsing the
   * payload as a `ChatEvent` JSON object, i.e. the server already speaks our format.
   */
  mapEvent?: (message: SSEMessage) => ChatEvent | ChatEvent[] | null | undefined
}

/**
 * Transport for a backend that streams this library's own event format over SSE.
 *
 * This is the recommended shape for new backends: emit one JSON `ChatEvent` per
 * `data:` line and nothing here needs configuring.
 */
export function createSSETransport(options: SSETransportOptions): ChatTransport {
  const mapEvent = options.mapEvent ?? defaultMapEvent

  return {
    async *send(request: SendRequest, context: TransportContext) {
      for await (const message of fetchSSE(options, request, context)) {
        if (message.data === '[DONE]') return
        const mapped = mapEvent(message)
        if (!mapped) continue
        if (Array.isArray(mapped)) yield* mapped
        else yield mapped
      }
    },
  }
}

function defaultMapEvent(message: SSEMessage): ChatEvent | null {
  if (!message.data) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(message.data)
  } catch {
    // Not JSON — treat the raw payload as a text delta. This makes the transport work
    // against dead-simple servers that just stream plain token strings.
    return { type: 'text-delta', delta: message.data }
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const candidate = parsed as { type?: unknown }

  // `event: text-delta` + `data: {"delta":"..."}` is also accepted.
  if (typeof candidate.type !== 'string' && message.event) {
    return { ...(parsed as object), type: message.event } as ChatEvent
  }
  if (typeof candidate.type !== 'string') return null
  return parsed as ChatEvent
}
