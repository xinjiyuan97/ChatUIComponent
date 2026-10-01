import type { ChatEvent } from '../events'
import type { ChatCapabilities, ChatInput, ChatMessage, ServerHello } from '../types'

export type CancelRequest = {
  turnId?: string
  runId?: string
  input: Extract<ChatInput, { type: 'cancel' }>
}

export type SendRequest = {
  messages: ChatMessage[]
  protocol?: string
  conversationId?: string
  turnId?: string
  runId?: string
  capabilities?: ChatCapabilities
  resume?: { lastEventId?: number }
  input?: ChatInput[]
  /** Extra fields merged into the request payload. */
  body?: Record<string, unknown>
  headers?: Record<string, string>
  /** Set when the send was triggered by a retry of the previous assistant turn. */
  regenerate?: boolean
}

export type TransportContext = {
  signal: AbortSignal
  /** Receives the stream's first server-hello metadata event, when supported. */
  onServerHello?: (hello: ServerHello) => void
}

/**
 * The single seam between this library and any backend.
 *
 * An `AsyncIterable` rather than a callback bag: `for await` gives us backpressure,
 * `try/finally` cleanup, and cancellation via the abort signal for free.
 */
export interface ChatTransport {
  send(request: SendRequest, context: TransportContext): AsyncIterable<ChatEvent>
  cancel?(request: CancelRequest): Promise<void>
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
