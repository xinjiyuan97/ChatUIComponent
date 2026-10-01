import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { AgentEngine, type Envelope } from './engine.ts'
import { heartbeat, sseFrame } from './frames.ts'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, last-event-id',
  vary: 'Origin',
}
const json = (response: ServerResponse, status: number, value: unknown) => {
  response.writeHead(status, { ...cors, 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}
async function body(request: IncomingMessage): Promise<Envelope> {
  let raw = ''
  for await (const chunk of request) raw += chunk
  return raw ? (JSON.parse(raw) as Envelope) : {}
}

export function createAgentServer(engine = new AgentEngine()): Server {
  return createServer(async (request, response) => {
    Object.entries(cors).forEach(([key, value]) => response.setHeader(key, value))
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }
    if (request.method === 'GET' && request.url?.startsWith('/agent/scenario/')) {
      json(response, 200, {
        scenario: request.url.split('/').pop(),
        scenarios: [
          'stop',
          'length',
          'tool-calls',
          'awaiting-permission',
          'cancelled',
          'error',
          'disconnect',
          'cancel',
          'duplicate-out-of-order',
          'structured-error',
          'unknown-event',
          'block-ids',
          'client-tool',
          'permission',
          'minimal-capabilities',
          'usage',
          'attachment-limit',
        ],
      })
      return
    }
    if (request.method !== 'POST' || request.url !== '/agent/chat') {
      json(response, 404, {
        error: { scope: 'transport', code: 'not_found', message: 'Not found', retryable: false },
      })
      return
    }
    try {
      const envelope = await body(request)
      const input = Array.isArray(envelope.input) ? envelope.input : []
      const attachment = input
        .flatMap((item) => (item.type === 'message' ? item.parts : []))
        .find((part) => part.type === 'file' && (part.size ?? 0) > 1024)
      if (attachment) {
        json(response, 413, {
          error: {
            scope: 'transport',
            code: 'attachment_limit',
            message: 'Attachment exceeds maxAttachmentBytes',
            retryable: false,
          },
        })
        return
      }
      const cancel = input.find((item) => item.type === 'cancel')
      if (cancel?.type === 'cancel') {
        engine.cancel(envelope, cancel)
        json(response, 200, { ok: true })
        return
      }
      const run = engine.duplicate(envelope, input) ?? engine.start(envelope, input)
      const cursorHeader = Number(request.headers['last-event-id'])
      const cursor = Number.isFinite(cursorHeader)
        ? cursorHeader
        : (envelope.resume?.lastEventId ?? 0)
      if (engine.replayExpired(run, cursor)) {
        json(response, 409, {
          error: {
            scope: 'transport',
            code: 'resume_expired',
            message: 'Replay point is outside retention window',
            retryable: false,
          },
        })
        return
      }
      response.writeHead(200, {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      response.flushHeaders()
      response.write(heartbeat())
      const abort = new AbortController()
      request.on('aborted', () => abort.abort())
      engine.stream(
        run,
        cursor,
        abort.signal,
        (frame) => {
          response.write(sseFrame(frame))
          response.flushHeaders()
        },
        () => response.end(),
      )
    } catch (error) {
      json(response, 400, {
        error: {
          scope: 'transport',
          code: 'invalid_request',
          message: String(error),
          retryable: false,
        },
      })
    }
  })
}
