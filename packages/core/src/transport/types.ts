import type { ChatEvent } from '../events'
import type { ChatMessage } from '../types'

export type SendRequest = {
  messages: ChatMessage[]
  /** Extra fields merged into the request payload. */
  body?: Record<string, unknown>
  headers?: Record<string, string>
  /** Set when the send was triggered by a retry of the previous assistant turn. */
  regenerate?: boolean
}

export type TransportContext = {
  signal: AbortSignal
}

/**
 * The single seam between this library and any backend.
 *
 * An `AsyncIterable` rather than a callback bag: `for await` gives us backpressure,
 * `try/finally` cleanup, and cancellation via the abort signal for free.
 */
export interface ChatTransport {
  send(request: SendRequest, context: TransportContext): AsyncIterable<ChatEvent>
}

/** Thrown for non-2xx responses so callers can inspect the status. */
export class TransportError extends Error {
  readonly status: number | undefined
  readonly body: string | undefined

  constructor(message: string, options: { status?: number; body?: string } = {}) {
    super(message)
    this.name = 'TransportError'
    this.status = options.status
    this.body = options.body
  }
}
