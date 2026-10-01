import type { ChatEvent } from '../events'
import { markEventBatch } from '../event-batch'
import type { HttpTransportOptions } from './http'
import { fetchSSE } from './http'
import type { SSEMessage } from './sse-parser'
import {
  TransportError,
  type ChatTransport,
  type CancelRequest,
  type SendRequest,
  type TransportContext,
} from './types'
import type { ServerHello } from '../types'

export type SSETransportOptions = HttpTransportOptions & {
  /** Endpoint for the typed cancel POST. Defaults to the configured SSE URL. */
  cancelUrl?: string
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
      let sawBusinessEvent = false
      for await (const message of fetchSSE(options, request, context, true)) {
        if (message.data === '[DONE]') return
        const mapped = mapEvent(message)
        if (!mapped) continue
        if (!Array.isArray(mapped) && mapped.type === 'server-hello') {
          if (!sawBusinessEvent) context.onServerHello?.(mapped as ServerHello)
          sawBusinessEvent = true
          continue
        }
        sawBusinessEvent = true
        const eventId = parseEventId(message.id)
        if (Array.isArray(mapped)) {
          const batchId = Symbol('sse-event-batch')
          yield* mapped.map((event) => markEventBatch({ ...event, eventId }, batchId))
        } else {
          yield { ...mapped, eventId }
        }
      }
    },
    async cancel(request: CancelRequest) {
      const doFetch = options.fetch ?? globalThis.fetch
      const response = await doFetch(options.cancelUrl ?? options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(typeof options.headers === 'function' ? options.headers() : options.headers),
        },
        body: JSON.stringify({
          protocol: 'agent-chat/1',
          ...stripUndefined({ turnId: request.turnId, runId: request.runId }),
          input: [request.input],
        }),
        credentials: options.credentials,
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new TransportError(
          `Cancellation request failed with status ${response.status}${text ? `: ${text}` : ''}`,
          { status: response.status, body: text },
        )
      }
    },
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>
}

function parseEventId(id: string | undefined): number | undefined {
  if (id === undefined || id.trim() === '') return undefined
  const parsed = Number(id)
  return Number.isFinite(parsed) ? parsed : undefined
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
