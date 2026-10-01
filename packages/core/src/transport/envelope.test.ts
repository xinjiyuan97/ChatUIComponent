import { describe, expect, it, vi } from 'vitest'

import { createChatStore } from '../store'
import type { ChatInput } from '../types'
import type { SendRequest, TransportContext } from './types'
import { createMockTransport } from './mock'
import { createAnthropicTransport } from './anthropic'
import { createOpenAITransport } from './openai'
import { createSSETransport } from './sse'

const context: TransportContext = { signal: new AbortController().signal }

function response() {
  return new Response('data: [DONE]\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function captureFetch() {
  let serializedBody: string | undefined
  const fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    serializedBody = String(init?.body)
    return response()
  }) as unknown as typeof globalThis.fetch
  return { fetch, body: () => serializedBody }
}

const envelopeRequest = {
  messages: [],
  protocol: 'agent-chat/1',
  conversationId: 'conv_1',
  turnId: 'turn_1',
  runId: 'run_1',
  capabilities: { blockIds: true, resume: true, clientTools: false, a2ui: true },
  resume: { lastEventId: 12 },
  input: [
    {
      type: 'cancel',
      inputId: 'input_1',
      reason: 'stop',
    },
  ] as ChatInput[],
} as unknown as SendRequest

describe('agent-chat request envelope', () => {
  it('keeps the legacy SSE body byte-for-byte unchanged without envelope fields', async () => {
    const captured = captureFetch()
    const transport = createSSETransport({ url: '/chat', fetch: captured.fetch })

    for await (const _event of transport.send({ messages: [] }, context)) void _event

    expect(captured.body()).toBe('{"messages":[]}')
  })

  it('adds the optional envelope fields to the SSE request body', async () => {
    const captured = captureFetch()
    const transport = createSSETransport({ url: '/chat', fetch: captured.fetch })

    for await (const _event of transport.send(envelopeRequest, context)) void _event

    expect(JSON.parse(captured.body() as string)).toEqual({
      messages: [],
      protocol: 'agent-chat/1',
      conversationId: 'conv_1',
      turnId: 'turn_1',
      runId: 'run_1',
      capabilities: { blockIds: true, resume: true, clientTools: false, a2ui: true },
      resume: { lastEventId: 12 },
      input: [{ type: 'cancel', inputId: 'input_1', reason: 'stop' }],
    })
  })

  it('makes input visible to mock transport scripts', async () => {
    let seen: SendRequest | undefined
    const input = [{ type: 'cancel', inputId: 'input_2' }] as ChatInput[]
    const transport = createMockTransport((request) => {
      seen = request
      return []
    })

    for await (const _event of transport.send({ messages: [], input } as SendRequest, context)) {
      void _event
    }

    expect(seen?.input).toEqual(input)
  })

  it.each([
    [
      'openai',
      (options: { url: string; fetch: typeof globalThis.fetch }) => createOpenAITransport(options),
    ],
    [
      'anthropic',
      (options: { url: string; fetch: typeof globalThis.fetch }) =>
        createAnthropicTransport(options),
    ],
  ])(
    'does not send agent-chat fields to the %s provider transport',
    async (_name, createTransport) => {
      const captured = captureFetch()
      const transport = createTransport({ url: '/provider', fetch: captured.fetch })

      for await (const _event of transport.send(envelopeRequest, context)) void _event

      expect(JSON.parse(captured.body() as string)).toEqual({ messages: [] })
    },
  )

  it('sends typed input from store send options', async () => {
    let seen: SendRequest | undefined
    const transport = createMockTransport((request) => {
      seen = request
      return []
    })
    const input = [{ type: 'cancel', inputId: 'input_3', reason: 'user' }] as ChatInput[]
    const store = createChatStore({ transport })

    await store.getState().send('hello', { input } as never)

    expect(seen?.input).toEqual(input)
  })
})
