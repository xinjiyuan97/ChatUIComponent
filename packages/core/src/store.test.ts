import { describe, expect, it, vi } from 'vitest'

import { createChatStore, type ClientToolHandler } from './store'
import { createMockTransport, mockReasoning, mockText, mockTool, mockTurn } from './transport/mock'

describe('createChatStore', () => {
  it('records the minimum server capabilities when hello is absent', async () => {
    const transport = createMockTransport(
      [
        { event: { type: 'message-start' } },
        { event: { type: 'message-end', finishReason: 'stop' } },
      ],
      { speed: 0 },
    )
    const store = createChatStore({ transport })

    await store.getState().send('hello')

    expect(store.getState().serverHello).toEqual({
      type: 'server-hello',
      protocol: 'agent-chat/1',
      capabilities: {
        blockIds: false,
        resume: false,
        clientTools: false,
        permissions: false,
        a2ui: false,
      },
      limits: {},
    })
  })

  it('does not hand client tools to the host when the server disables them', async () => {
    const onClientTool = vi.fn()
    const transport = {
      async *send(_request: unknown, context: { onServerHello?: (hello: never) => void }) {
        context.onServerHello?.({
          type: 'server-hello',
          protocol: 'agent-chat/1',
          capabilities: { clientTools: false },
          limits: {},
        } as never)
        yield { type: 'message-start' } as const
        yield {
          type: 'tool-input-start',
          toolCallId: 'call-1',
          name: 'read',
          execution: 'client',
        } as const
        yield { type: 'tool-input-available', toolCallId: 'call-1', input: {} } as const
        yield { type: 'message-end', finishReason: 'stop' } as const
      },
    }
    const store = createChatStore({ transport, onClientTool })

    await store.getState().send('hello')

    expect(onClientTool).not.toHaveBeenCalled()
  })

  it('keeps streaming the assistant message after message-start renames it', async () => {
    const serverMessageId = 'assistant-server-1'
    const usage = { inputTokens: 12, outputTokens: 8, totalTokens: 20 }
    const onFinish = vi.fn()
    const script = mockTurn(
      serverMessageId,
      mockReasoning('thinking', { delay: 0 }),
      mockText('answer', { delay: 0 }),
      mockTool({
        name: 'lookup',
        input: { query: 'status' },
        output: { ok: true },
        runMs: 0,
        delay: 0,
      }),
    )
    script[script.length - 1] = { event: { type: 'message-end', finishReason: 'stop', usage } }
    const store = createChatStore({
      transport: createMockTransport(script, { speed: 0 }),
      onFinish,
    })

    await store.getState().send('hello')

    const assistant = store.getState().messages.at(-1)
    expect(assistant?.id).toBe(serverMessageId)
    expect(assistant?.parts.map((part) => part.type)).toEqual(['reasoning', 'text', 'tool'])
    expect(assistant?.status).toBe('complete')
    expect(assistant?.metadata).toEqual({ finishReason: 'stop', usage })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(assistant)
  })

  it('records the greatest eventId without changing it for smaller or missing ids', async () => {
    const store = createChatStore({
      transport: createMockTransport(
        [
          { event: { type: 'message-start', eventId: 10 } },
          { event: { type: 'text-start' } },
          { event: { type: 'text-delta', delta: 'hello', eventId: 4 } },
          { event: { type: 'text-end' } },
          { event: { type: 'message-end', eventId: 8 } },
        ],
        { speed: 0 },
      ),
    })

    await store.getState().send('hello')

    expect(store.getState().lastEventId).toBe(10)
  })

  it('drops a duplicate eventId without duplicating the text part', async () => {
    const store = createChatStore({
      transport: createMockTransport(
        [
          { event: { type: 'message-start' } },
          { event: { type: 'text-start', eventId: 1 } },
          { event: { type: 'text-delta', delta: 'once', eventId: 2 } },
          { event: { type: 'text-delta', delta: 'once', eventId: 2 } },
          { event: { type: 'message-end' } },
        ],
        { speed: 0 },
      ),
    })

    await store.getState().send('hello')

    expect(store.getState().messages.at(-1)?.parts).toEqual([{ type: 'text', text: 'once' }])
  })

  it('drops an eventId lower than the greatest processed id', async () => {
    const store = createChatStore({
      transport: createMockTransport(
        [
          { event: { type: 'message-start' } },
          { event: { type: 'text-start' } },
          { event: { type: 'text-delta', delta: 'new', eventId: 5 } },
          { event: { type: 'text-delta', delta: 'old', eventId: 3 } },
          { event: { type: 'message-end' } },
        ],
        { speed: 0 },
      ),
    })

    await store.getState().send('hello')

    expect(store.getState().messages.at(-1)?.parts).toEqual([{ type: 'text', text: 'new' }])
  })

  it('keeps unnumbered events working alongside numbered events', async () => {
    const store = createChatStore({
      transport: createMockTransport(
        [
          { event: { type: 'message-start' } },
          { event: { type: 'text-start' } },
          { event: { type: 'text-delta', delta: 'numbered', eventId: 5 } },
          { event: { type: 'text-delta', delta: ' unnumbered' } },
          { event: { type: 'text-delta', delta: 'stale', eventId: 4 } },
          { event: { type: 'message-end' } },
        ],
        { speed: 0 },
      ),
    })

    await store.getState().send('hello')

    expect(store.getState().messages.at(-1)?.parts).toEqual([
      { type: 'text', text: 'numbered unnumbered' },
    ])
  })

  it('does not notify onEvent for a dropped event', async () => {
    const onEvent = vi.fn()
    const store = createChatStore({
      transport: createMockTransport(
        [
          { event: { type: 'message-start' } },
          { event: { type: 'text-start', eventId: 1 } },
          { event: { type: 'text-delta', delta: 'once', eventId: 2 } },
          { event: { type: 'text-delta', delta: 'duplicate', eventId: 2 } },
          { event: { type: 'message-end' } },
        ],
        { speed: 0 },
      ),
      onEvent,
    })

    await store.getState().send('hello')

    expect(onEvent).toHaveBeenCalledTimes(4)
    expect(onEvent).not.toHaveBeenCalledWith({
      type: 'text-delta',
      delta: 'duplicate',
      eventId: 2,
    })
  })

  it('marks dangling reasoning and tools cancelled after stop', async () => {
    let resolveReady: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    const transport = {
      async *send(_request: never, context: { signal: AbortSignal }) {
        yield { type: 'permission-request', request: { id: 'p1', toolName: 'bash' } } as const
        yield { type: 'reasoning-start' } as const
        yield { type: 'tool-input-start', toolCallId: 't1', name: 'bash' } as const
        resolveReady?.()
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => resolve()),
        )
      },
    }
    const store = createChatStore({ transport })
    const sending = store.getState().send('hello')
    await ready
    store.getState().stop()
    await sending

    const assistant = store.getState().messages.at(-1)
    expect(assistant?.status).toBe('aborted')
    expect(assistant?.parts).toEqual([
      { type: 'permission', request: { id: 'p1', toolName: 'bash' } },
      expect.objectContaining({ type: 'reasoning', cancelled: true }),
      expect.objectContaining({ type: 'tool', state: 'cancelled' }),
    ])
  })

  it('marks dangling reasoning and tools as errors after a disconnect', async () => {
    const transport = {
      async *send() {
        yield { type: 'permission-request', request: { id: 'p1', toolName: 'bash' } } as const
        yield { type: 'reasoning-start' } as const
        yield { type: 'tool-input-start', toolCallId: 't1', name: 'bash' } as const
      },
    }
    const store = createChatStore({ transport })

    await store.getState().send('hello')

    const assistant = store.getState().messages.at(-1)
    expect(assistant?.status).toBe('error')
    expect(assistant?.parts).toEqual([
      { type: 'permission', request: { id: 'p1', toolName: 'bash' } },
      expect.objectContaining({ type: 'reasoning', durationMs: expect.any(Number) }),
      expect.objectContaining({ type: 'tool', state: 'output-error' }),
    ])
  })

  it('does not complete a stream that ends without message-end', async () => {
    const store = createChatStore({
      transport: {
        async *send() {
          yield { type: 'permission-request', request: { id: 'p2', toolName: 'bash' } } as const
          yield { type: 'reasoning-start' } as const
          yield { type: 'tool-input-start', toolCallId: 't2', name: 'bash' } as const
        },
      },
    })

    await store.getState().send('hello')

    const assistant = store.getState().messages.at(-1)
    expect(assistant?.status).toBe('error')
    expect(assistant?.status).not.toBe('complete')
    expect(assistant?.parts[0]).toEqual({
      type: 'permission',
      request: { id: 'p2', toolName: 'bash' },
    })
    expect(assistant?.parts[1]).toMatchObject({ type: 'reasoning', durationMs: expect.any(Number) })
    expect(assistant?.parts[2]).toMatchObject({ type: 'tool', state: 'output-error' })
  })

  it('sends cancellation through a transport without waiting for it', async () => {
    let resolveReady: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    let aborted = false
    let cancelCalled = false
    const transport = {
      async *send(_request: never, context: { signal: AbortSignal }) {
        yield { type: 'reasoning-start' } as const
        resolveReady?.()
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => {
            aborted = true
            resolve()
          }),
        )
      },
      cancel: async () => {
        cancelCalled = true
        await new Promise<void>(() => {})
      },
    }
    const store = createChatStore({ transport })
    const sending = store.getState().send('hello')
    await ready

    store.getState().stop()
    expect(cancelCalled).toBe(true)
    expect(aborted).toBe(true)
    await sending
    expect(store.getState().messages.at(-1)?.status).toBe('aborted')
  })

  it('stops locally when transport has no cancel capability', async () => {
    let resolveReady: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    const transport = {
      async *send(_request: never, context: { signal: AbortSignal }) {
        yield { type: 'reasoning-start' } as const
        resolveReady?.()
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => resolve()),
        )
      },
    }
    const store = createChatStore({ transport })
    const sending = store.getState().send('hello')
    await ready

    expect(() => store.getState().stop()).not.toThrow()
    await sending
    expect(store.getState().messages.at(-1)?.status).toBe('aborted')
  })

  it('ignores cancellation request failures and keeps the message aborted', async () => {
    let resolveReady: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })
    const transport = {
      async *send(_request: never, context: { signal: AbortSignal }) {
        yield { type: 'reasoning-start' } as const
        resolveReady?.()
        await new Promise<void>((resolve) =>
          context.signal.addEventListener('abort', () => resolve()),
        )
      },
      cancel: async () => {
        throw new Error('offline')
      },
    }
    const store = createChatStore({ transport })
    const sending = store.getState().send('hello')
    await ready

    expect(() => store.getState().stop()).not.toThrow()
    await sending
    expect(store.getState().messages.at(-1)?.status).toBe('aborted')
    expect(store.getState().error).toBeNull()
  })

  it('dispatches client tools asynchronously and accepts a typed result', async () => {
    let submitToolResult:
      | ((toolCallId: string, result: { output?: unknown; error?: string }) => Promise<void>)
      | undefined
    let sendCount = 0
    const requests: unknown[] = []
    const onClientTool = vi.fn((_event: unknown, submit: typeof submitToolResult) => {
      submitToolResult = submit
    })
    const transport = {
      async *send(request: { input?: unknown }, _context: { signal: AbortSignal }) {
        requests.push(request)
        sendCount += 1
        if (sendCount === 1) {
          yield { type: 'message-start', id: 'assistant-client-1' } as const
          yield {
            type: 'tool-input-start',
            toolCallId: 'client-1',
            name: 'read-file',
            execution: 'client',
          } as const
          yield {
            type: 'tool-input-available',
            toolCallId: 'client-1',
            input: { path: 'a.txt' },
          } as const
          yield { type: 'text-start' } as const
          yield { type: 'text-delta', delta: 'still streaming' } as const
          yield { type: 'message-end', finishReason: 'stop' } as const
        } else {
          yield { type: 'message-end', finishReason: 'stop' } as const
        }
      },
    }
    const store = createChatStore({ transport, onClientTool } as never)

    await store.getState().send('hello')

    expect(onClientTool).toHaveBeenCalledTimes(1)
    expect(store.getState().messages.at(-1)?.parts).toEqual([
      expect.objectContaining({ type: 'tool', state: 'awaiting-client' }),
      { type: 'text', text: 'still streaming' },
    ])
    expect(submitToolResult).toBeDefined()

    await submitToolResult?.('client-1', { output: 'contents' })

    const assistant = store
      .getState()
      .messages.find((message) => message.id === 'assistant-client-1')
    expect(assistant?.parts).toEqual([
      expect.objectContaining({
        type: 'tool',
        toolCallId: 'client-1',
        state: 'output-available',
        output: 'contents',
      }),
      { type: 'text', text: 'still streaming' },
    ])
    expect((requests[1] as { input: unknown[] }).input).toEqual([
      expect.objectContaining({
        type: 'tool-result',
        toolCallId: 'client-1',
        output: 'contents',
      }),
    ])
  })

  it('ignores client tool results for unknown or already settled calls', async () => {
    let submitToolResult:
      | ((toolCallId: string, result: { output?: unknown; error?: string }) => Promise<void>)
      | undefined
    const onClientTool: ClientToolHandler = (_event, submit) => {
      submitToolResult = submit
    }
    const store = createChatStore({
      transport: {
        async *send() {
          yield {
            type: 'tool-input-start',
            toolCallId: 'client-2',
            name: 'read-file',
            execution: 'client',
          } as const
          yield { type: 'tool-input-available', toolCallId: 'client-2', input: {} } as const
          yield { type: 'tool-output', toolCallId: 'client-2', output: 'done' } as const
          yield { type: 'message-end', finishReason: 'stop' } as const
        },
      },
      onClientTool,
    } as never)

    await store.getState().send('hello')
    await expect(submitToolResult?.('unknown', { error: 'unknown' })).resolves.toBeUndefined()
    await expect(submitToolResult?.('client-2', { error: 'late' })).resolves.toBeUndefined()

    const tool = store
      .getState()
      .messages.at(-1)
      ?.parts.find((part) => part.type === 'tool')
    expect(tool).toMatchObject({ type: 'tool', state: 'output-available', output: 'done' })
  })

  it('settles a client tool with an error result', async () => {
    let submitToolResult:
      | ((toolCallId: string, result: { output?: unknown; error?: string }) => Promise<void>)
      | undefined
    const onClientTool: ClientToolHandler = (_event, submit) => {
      submitToolResult = submit
    }
    const store = createChatStore({
      transport: {
        async *send() {
          yield {
            type: 'tool-input-start',
            toolCallId: 'client-3',
            name: 'read-file',
            execution: 'client',
          } as const
          yield { type: 'tool-input-available', toolCallId: 'client-3', input: {} } as const
          yield { type: 'message-end', finishReason: 'stop' } as const
        },
      },
      onClientTool,
    } as never)

    await store.getState().send('hello')
    await submitToolResult?.('client-3', { error: 'permission denied' })

    const tool = store
      .getState()
      .messages.flatMap((message) => message.parts)
      .find((part) => part.type === 'tool' && part.toolCallId === 'client-3')
    expect(tool).toEqual(
      expect.objectContaining({
        type: 'tool',
        toolCallId: 'client-3',
        state: 'output-error',
        error: 'permission denied',
      }),
    )
  })

  it('resumes a permission turn with a typed decision and a new run', async () => {
    const requests: Array<{ turnId?: string; runId?: string; input?: unknown[] }> = []
    let sendCount = 0
    const transport = {
      async *send(request: { turnId?: string; runId?: string; input?: unknown[] }) {
        requests.push(request)
        sendCount += 1
        if (sendCount === 1) {
          yield {
            type: 'permission-request',
            request: { id: 'permission-1', toolName: 'bash' },
          } as const
          yield { type: 'message-end', finishReason: 'awaiting-permission' } as const
        } else {
          yield { type: 'text-start' } as const
          yield { type: 'text-delta', delta: 'allowed' } as const
          yield { type: 'message-end', finishReason: 'stop' } as const
        }
      },
    }
    const store = createChatStore({ transport })

    await store.getState().send('run command')
    const first = requests[0]
    const before = store.getState().messages.at(-1)
    expect(before?.metadata?.finishReason).toBe('awaiting-permission')

    await (
      store.getState() as ReturnType<typeof store.getState> & {
        submitPermissionDecision: (resolution: unknown) => Promise<void>
      }
    ).submitPermissionDecision({
      requestId: 'permission-1',
      option: 'allow-once',
      decision: 'allow-once',
    })

    expect(requests).toHaveLength(2)
    expect(requests[1]?.turnId).toBe(first?.turnId)
    expect(requests[1]?.runId).toBeDefined()
    expect(requests[1]?.runId).not.toBe(first?.runId)
    expect(requests[1]?.input).toEqual([
      expect.objectContaining({
        type: 'permission-decision',
        inputId: expect.any(String),
        requestId: 'permission-1',
        option: 'allow-once',
        decision: 'allow-once',
      }),
    ])
    expect(store.getState().messages.at(-1)?.parts).toEqual([
      expect.objectContaining({
        type: 'permission',
        resolution: expect.objectContaining({ requestId: 'permission-1' }),
      }),
      { type: 'text', text: 'allowed' },
    ])
  })

  it('submits one decision per permission request', async () => {
    const requests: Array<{ input?: unknown[] }> = []
    const store = createChatStore({
      transport: {
        async *send(request: { input?: unknown[] }) {
          requests.push(request)
          if (requests.length === 1) {
            yield {
              type: 'permission-request',
              request: { id: 'permission-2', toolName: 'bash' },
            } as const
            yield { type: 'message-end', finishReason: 'awaiting-permission' } as const
          } else {
            yield { type: 'message-end', finishReason: 'stop' } as const
          }
        },
      },
    })

    await store.getState().send('run command')
    const submit = (
      store.getState() as ReturnType<typeof store.getState> & {
        submitPermissionDecision: (resolution: unknown) => Promise<void>
      }
    ).submitPermissionDecision
    await Promise.all([
      submit({ requestId: 'permission-2', option: 'allow-once', decision: 'allow-once' }),
      submit({ requestId: 'permission-2', option: 'allow-once', decision: 'allow-once' }),
    ])

    expect(requests).toHaveLength(2)
    expect(requests[1]?.input).toHaveLength(1)
  })

  it('sends an A2UI action with the stable surface id and resolves locally', async () => {
    const requests: Array<{ turnId?: string; runId?: string; input?: unknown[] }> = []
    let sendCount = 0
    const store = createChatStore({
      transport: {
        async *send(request: { turnId?: string; runId?: string; input?: unknown[] }) {
          requests.push(request)
          sendCount += 1
          if (sendCount === 1) {
            yield {
              type: 'a2ui',
              surfaceId: 'surface-stable',
              spec: { type: 'Button', props: { onClick: { action: 'ack', resolve: true } } },
            } as const
            yield { type: 'message-end', finishReason: 'stop' } as const
          } else {
            yield { type: 'message-end', finishReason: 'stop' } as const
          }
        },
      },
    })

    await store.getState().send('show card')
    await (
      store.getState() as ReturnType<typeof store.getState> & {
        submitA2UIAction: (messageId: string, action: unknown) => Promise<void>
      }
    ).submitA2UIAction('missing-message', {
      surfaceId: 'surface-stable',
      action: 'ack',
      payload: { ok: true },
      resolve: true,
    })
    await (
      store.getState() as ReturnType<typeof store.getState> & {
        submitA2UIAction: (messageId: string, action: unknown) => Promise<void>
      }
    ).submitA2UIAction(store.getState().messages.at(-1)?.id ?? '', {
      surfaceId: 'surface-stable',
      action: 'ack',
      payload: { ok: true },
      resolve: true,
    })

    expect(requests[1]?.input).toEqual([
      expect.objectContaining({
        type: 'a2ui-action',
        inputId: expect.any(String),
        surfaceId: 'surface-stable',
        action: 'ack',
        payload: { ok: true },
      }),
    ])
    expect(store.getState().messages.at(-1)?.parts[0]).toMatchObject({
      type: 'a2ui',
      surfaceId: 'surface-stable',
      resolved: true,
    })
  })

  it('deduplicates a double A2UI action and interrupts the active run', async () => {
    let resolveFirstReady: (() => void) | undefined
    let firstAborted = false
    const firstReady = new Promise<void>((resolve) => {
      resolveFirstReady = resolve
    })
    let sendCount = 0
    const requests: Array<{ input?: unknown[] }> = []
    const store = createChatStore({
      transport: {
        async *send(request: { input?: unknown[] }, context: { signal: AbortSignal }) {
          requests.push(request)
          sendCount += 1
          if (sendCount === 1) {
            yield {
              type: 'a2ui',
              surfaceId: 'surface-double',
              spec: { type: 'Button', props: { onClick: { action: 'ack', resolve: true } } },
            } as const
            resolveFirstReady?.()
            await new Promise<void>((resolve) =>
              context.signal.addEventListener('abort', () => {
                firstAborted = true
                resolve()
              }),
            )
          } else {
            yield { type: 'message-end', finishReason: 'stop' } as const
          }
        },
      },
    })
    const sending = store.getState().send('show card')
    await firstReady
    const messageId = store.getState().messages.at(-1)?.id ?? ''
    const submit = (
      store.getState() as ReturnType<typeof store.getState> & {
        submitA2UIAction: (messageId: string, action: unknown) => Promise<void>
      }
    ).submitA2UIAction

    await Promise.all([
      submit(messageId, { surfaceId: 'surface-double', action: 'ack', resolve: true }),
      submit(messageId, { surfaceId: 'surface-double', action: 'ack', resolve: true }),
    ])
    await sending

    expect(firstAborted).toBe(true)
    expect(requests).toHaveLength(2)
    expect(requests[1]?.input).toHaveLength(1)
  })

  it('keeps resolveA2UISurface local and does not send an action', () => {
    const store = createChatStore({
      transport: {
        async *send() {
          yield { type: 'message-end', finishReason: 'stop' } as const
        },
      },
      initialMessages: [
        {
          id: 'assistant-local',
          role: 'assistant',
          parts: [
            {
              type: 'a2ui',
              surfaceId: 'surface-local',
              spec: { type: 'Label', props: { text: 'done' } },
            },
          ],
        },
      ],
    })

    store.getState().resolveA2UISurface('assistant-local', 'surface-local')

    expect(store.getState().messages[0]?.parts[0]).toMatchObject({
      type: 'a2ui',
      surfaceId: 'surface-local',
      resolved: true,
    })
  })
})
