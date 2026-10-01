import { describe, expect, it, vi } from 'vitest'

import { createSSETransport } from './sse'

describe('SSE cancellation', () => {
  it('posts a typed cancel input to the configured cancel endpoint', async () => {
    let url: string | URL | undefined
    let init: RequestInit | undefined
    const fetch = vi.fn(async (input: string | URL, request?: RequestInit) => {
      url = input
      init = request
      return new Response(null, { status: 204 })
    }) as unknown as typeof globalThis.fetch
    const transport = createSSETransport({
      url: '/chat',
      cancelUrl: '/turns/turn_1/cancel',
      fetch,
    } as never)

    await transport.cancel?.({
      turnId: 'turn_1',
      runId: 'run_1',
      input: { type: 'cancel', inputId: 'input_1', reason: 'user' },
    })

    expect(url).toBe('/turns/turn_1/cancel')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({
      protocol: 'agent-chat/1',
      turnId: 'turn_1',
      runId: 'run_1',
      input: [{ type: 'cancel', inputId: 'input_1', reason: 'user' }],
    })
  })

  it('keeps the configured SSE URL as the default cancel endpoint', async () => {
    let url: string | URL | undefined
    const fetch = vi.fn(async (input: string | URL) => {
      url = input
      return new Response(null, { status: 204 })
    }) as unknown as typeof globalThis.fetch
    const transport = createSSETransport({ url: '/chat', fetch })

    await transport.cancel?.({
      input: { type: 'cancel', inputId: 'input_2' },
    })

    expect(url).toBe('/chat')
  })

  it('rejects non-success cancellation responses', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 404 })) as unknown as typeof globalThis.fetch
    const transport = createSSETransport({ url: '/chat', fetch })

    await expect(
      transport.cancel?.({ input: { type: 'cancel', inputId: 'input_3' } }),
    ).rejects.toThrow('Cancellation request failed with status 404')
  })
})
