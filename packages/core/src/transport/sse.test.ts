import { describe, expect, it, vi } from 'vitest'

import type { ChatEvent } from '../events'
import { createChatStore } from '../store'
import { createSSETransport } from './sse'

const request = { messages: [] }
const context = { signal: new AbortController().signal }

function fakeFetch(frames: string[]) {
  return vi.fn(async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        for (const frame of frames) controller.enqueue(encoder.encode(frame))
        controller.close()
      },
    })
    return new Response(stream, { status: 200 })
  })
}

async function collectEvents(transport: ReturnType<typeof createSSETransport>) {
  const events: ChatEvent[] = []
  for await (const event of transport.send(request, context)) events.push(event)
  return events
}

describe('createSSETransport', () => {
  it('exposes server-hello to the consumer without yielding it as a chat event', async () => {
    const onServerHello = vi.fn()
    const transport = createSSETransport({
      url: '/chat',
      fetch: fakeFetch([
        'data: {"type":"server-hello","protocol":"agent-chat/1","capabilities":{"resume":true,"clientTools":true},"limits":{"resumeWindowEvents":5}}\n\n',
        'data: {"type":"message-start"}\n\n',
      ]),
    })

    const events: ChatEvent[] = []
    for await (const event of transport.send({ messages: [] }, { ...context, onServerHello })) {
      events.push(event)
    }

    expect(onServerHello).toHaveBeenCalledWith({
      type: 'server-hello',
      protocol: 'agent-chat/1',
      capabilities: { resume: true, clientTools: true },
      limits: { resumeWindowEvents: 5 },
    })
    expect(events).toEqual([{ type: 'message-start', eventId: undefined }])
  })

  it('ignores a server-hello that is not the first business event', async () => {
    const onServerHello = vi.fn()
    const transport = createSSETransport({
      url: '/chat',
      fetch: fakeFetch([
        'data: {"type":"message-start"}\n\n',
        'data: {"type":"server-hello","protocol":"agent-chat/9","capabilities":{"resume":true},"limits":{}}\n\n',
        'data: {"type":"text-delta","delta":"ok"}\n\n',
      ]),
    })

    const events: ChatEvent[] = []
    for await (const event of transport.send({ messages: [] }, { ...context, onServerHello })) {
      events.push(event)
    }

    expect(onServerHello).not.toHaveBeenCalled()
    expect(events).toEqual([
      { type: 'message-start', eventId: undefined },
      { type: 'text-delta', delta: 'ok', eventId: undefined },
    ])
  })

  it('continues processing events after an unknown protocol version', async () => {
    const onServerHello = vi.fn()
    const transport = createSSETransport({
      url: '/chat',
      fetch: fakeFetch([
        'data: {"type":"server-hello","protocol":"agent-chat/99","capabilities":{},"limits":{}}\n\n',
        'data: {"type":"text-delta","delta":"still works"}\n\n',
      ]),
    })

    const events: ChatEvent[] = []
    for await (const event of transport.send(request, { ...context, onServerHello }))
      events.push(event)

    expect(onServerHello).toHaveBeenCalledOnce()
    expect(events).toEqual([{ type: 'text-delta', delta: 'still works', eventId: undefined }])
  })

  it('maps a numeric SSE id to eventId', async () => {
    const transport = createSSETransport({
      url: '/chat',
      fetch: fakeFetch(['id: 7\ndata: {"type":"text-delta","delta":"hi"}\n\n']),
    })

    await expect(collectEvents(transport)).resolves.toEqual([
      { type: 'text-delta', delta: 'hi', eventId: 7 },
    ])
  })

  it.each([
    ['non-numeric', 'id: nope\ndata: {"type":"text-delta","delta":"hi"}\n\n'],
    ['missing', 'data: {"type":"text-delta","delta":"hi"}\n\n'],
  ])('keeps events when the SSE id is %s', async (_label, frame) => {
    const transport = createSSETransport({ url: '/chat', fetch: fakeFetch([frame]) })

    await expect(collectEvents(transport)).resolves.toEqual([
      { type: 'text-delta', delta: 'hi', eventId: undefined },
    ])
  })

  it('copies one SSE eventId to every event returned by mapEvent', async () => {
    const transport = createSSETransport({
      url: '/chat',
      fetch: fakeFetch(['id: 11\ndata: payload\n\n']),
      mapEvent: () => [
        { type: 'text-start' } as ChatEvent,
        { type: 'text-delta', delta: 'payload' } as ChatEvent,
      ],
    })

    await expect(collectEvents(transport)).resolves.toEqual([
      { type: 'text-start', eventId: 11 },
      { type: 'text-delta', delta: 'payload', eventId: 11 },
    ])
  })

  it('lets a same-eventId mapEvent array reach the store atomically', async () => {
    const store = createChatStore({
      transport: createSSETransport({
        url: '/chat',
        fetch: fakeFetch(['id: 11\ndata: payload\n\n']),
        mapEvent: () => [{ type: 'text-start' }, { type: 'text-delta', delta: 'payload' }],
      }),
    })

    await store.getState().send('hello')

    expect(store.getState().messages.at(-1)?.parts).toEqual([{ type: 'text', text: 'payload' }])
  })
})
