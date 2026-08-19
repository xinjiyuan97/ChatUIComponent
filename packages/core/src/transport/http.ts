import type { SSEMessage } from './sse-parser'
import { parseSSEStream } from './sse-parser'
import type { SendRequest, TransportContext } from './types'
import { TransportError } from './types'

export type HttpTransportOptions = {
  url: string
  method?: 'POST' | 'GET'
  headers?: Record<string, string> | (() => Record<string, string>)
  /** Extra fields merged into the JSON body. */
  body?: Record<string, unknown> | (() => Record<string, unknown>)
  /** Replaces the default `{ messages, ...body }` payload entirely. */
  prepareBody?: (request: SendRequest) => unknown
  credentials?: RequestCredentials
  fetch?: typeof globalThis.fetch
}

function resolve<T>(value: T | (() => T) | undefined): T | undefined {
  return typeof value === 'function' ? (value as () => T)() : value
}

/** Shared plumbing for every HTTP-based transport: build the request, validate, yield SSE. */
export async function* fetchSSE(
  options: HttpTransportOptions,
  request: SendRequest,
  context: TransportContext,
): AsyncGenerator<SSEMessage> {
  const doFetch = options.fetch ?? globalThis.fetch
  const payload = options.prepareBody
    ? options.prepareBody(request)
    : { messages: request.messages, ...resolve(options.body), ...request.body }

  const response = await doFetch(options.url, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...resolve(options.headers),
      ...request.headers,
    },
    body: JSON.stringify(payload),
    signal: context.signal,
    credentials: options.credentials,
  })

  if (!response.ok) {
    // Read the body for the error message — servers almost always put the useful part there.
    const text = await response.text().catch(() => '')
    throw new TransportError(
      `Request failed with status ${response.status}${text ? `: ${truncate(text)}` : ''}`,
      { status: response.status, body: text },
    )
  }
  if (!response.body) {
    throw new TransportError('Response has no body to stream')
  }

  yield* parseSSEStream(response.body, context.signal)
}

function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
