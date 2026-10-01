import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import {
  createChatStore,
  createMockTransport,
  createSSEDecoder,
  type ChatEvent,
  type ChatStoreState,
  type MockStep,
  type SendRequest,
} from '@xinjiyuan97/chat-core'
import { ChatThemeProvider, Message } from '@xinjiyuan97/chat-ui'

const meta = { title: 'Protocol/Agent Chat', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
type Script = (request: SendRequest) => MockStep[]
type Snapshot = Pick<ChatStoreState, 'messages' | 'status' | 'lastEventId'> & {
  requests: SendRequest[]
  observed: ChatEvent[]
}

function steps(...events: ChatEvent[]): MockStep[] {
  return events.map((event) => ({ event }))
}

function ProtocolPanel({ name, script }: { name: string; script: Script }) {
  const [requests] = useState<SendRequest[]>([])
  const [observed] = useState<ChatEvent[]>([])
  const [ready, setReady] = useState(false)
  const started = useRef(false)
  const [store] = useState(() =>
    createChatStore({
      transport: createMockTransport(
        (request) => {
          requests.push(request)
          return script(request)
        },
        { speed: 0 },
      ),
      onEvent: (event) => {
        observed.push(event)
      },
      now: () => 1000,
    }),
  )
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void store
      .getState()
      .send('协议验收')
      .then(() => setReady(true))
  }, [store])

  const snapshot: Snapshot = {
    messages: state.messages,
    status: state.status,
    lastEventId: state.lastEventId,
    requests,
    observed,
  }

  return (
    <section
      data-testid={name}
      data-ready={String(ready)}
      className="mb-4 rounded-cc-md border border-cc-border p-4"
    >
      <h3>{name}</h3>
      <p>
        store: {state.status} · message: {state.messages.at(-1)?.status ?? 'pending'} ·
        finishReason: {String(state.messages.at(-1)?.metadata?.finishReason ?? 'none')}
      </p>
      <ChatThemeProvider locale="zh-CN" asFragment>
        {state.messages
          .filter((message) => message.role === 'assistant')
          .map((message) => (
            <Message
              key={message.id}
              message={message}
              onRetry={() => undefined}
              onPermissionDecision={(resolution) =>
                store.getState().submitPermissionDecision(resolution)
              }
            />
          ))}
      </ChatThemeProvider>
      <details>
        <summary>协议状态与实际请求</summary>
        <pre data-testid="snapshot">{JSON.stringify(snapshot, null, 2)}</pre>
      </details>
    </section>
  )
}

async function panel(canvasElement: HTMLElement, name: string) {
  const element = within(canvasElement).getByTestId(name)
  await waitFor(() => expect(element).toHaveAttribute('data-ready', 'true'))
  return element
}

function snapshot(element: HTMLElement): Snapshot {
  return JSON.parse(within(element).getByTestId('snapshot').textContent ?? '{}') as Snapshot
}

const endings = [
  'stop',
  'length',
  'tool-calls',
  'cancelled',
  'awaiting-permission',
  'error',
] as const
const dangling = (): ChatEvent[] => [
  { type: 'message-start', id: 'server-assistant' },
  { type: 'reasoning-start' },
  { type: 'reasoning-delta', delta: '未收尾的推理' },
  { type: 'tool-input-start', toolCallId: 'tool-1', name: 'read_file' },
  { type: 'tool-executing', toolCallId: 'tool-1' },
  { type: 'file', id: 'file-1', mediaType: 'image/png', status: 'generating', name: 'preview.png' },
  { type: 'permission-request', request: { id: 'approval-1', toolName: 'read_file' } },
]

export const SixEndings: Story = {
  name: '六种终局并排',
  render: () => (
    <div className="grid gap-4 md:grid-cols-3">
      {endings.map((finishReason) => (
        <ProtocolPanel
          key={finishReason}
          name={finishReason}
          script={() =>
            steps(
              { type: 'text-delta', delta: '终态演示' },
              ...(finishReason === 'awaiting-permission'
                ? [
                    {
                      type: 'permission-request' as const,
                      request: { id: 'waiting', toolName: 'read_file' },
                    },
                  ]
                : []),
              { type: 'message-end', finishReason },
            )
          }
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const finishReason of endings) {
      const state = snapshot(await panel(canvasElement, finishReason))
      await expect(state.messages.at(-1)?.status).toBe(
        finishReason === 'cancelled' ? 'aborted' : finishReason === 'error' ? 'error' : 'complete',
      )
      await expect(state.messages.at(-1)?.metadata?.finishReason).toBe(finishReason)
    }
  },
}

export const Disconnected: Story = {
  name: '断流：未完成而非成功',
  render: () => <ProtocolPanel name="disconnected" script={() => steps(...dangling())} />,
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'disconnected')
    const message = snapshot(element).messages.at(-1)
    await expect(message?.status).toBe('error')
    await expect(message?.parts[0]).toMatchObject({ type: 'reasoning', durationMs: 0 })
    await expect(message?.parts[1]).toMatchObject({ type: 'tool', state: 'output-error' })
    await expect(message?.parts[2]).toMatchObject({ type: 'file', status: 'error' })
    await expect(message?.parts[3]).toEqual({
      type: 'permission',
      request: { id: 'approval-1', toolName: 'read_file' },
    })
    await expect(within(element).queryByText('已取消')).toBeNull()
    await expect(within(element).queryByText('已取消')).toBeNull()
  },
}

export const Cancelled: Story = {
  name: '取消：不再转圈，也不是失败',
  render: () => (
    <ProtocolPanel
      name="cancelled"
      script={() => steps(...dangling(), { type: 'message-end', finishReason: 'cancelled' })}
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'cancelled')
    const message = snapshot(element).messages.at(-1)
    await expect(message?.status).toBe('aborted')
    for (const part of message?.parts.slice(0, 3) ?? [])
      await expect(part).toMatchObject({ cancelled: true })
    await expect(message?.parts[3]).not.toHaveProperty('resolution')
    await expect(within(element).getAllByText('已取消')).toHaveLength(3)
    await expect(within(element).queryByText('失败')).toBeNull()
    await expect(element.querySelector('.animate-cc-spin, [aria-busy="true"]')).toBeNull()
  },
}

export const Deduplication: Story = {
  name: '去重与乱序',
  render: () => (
    <ProtocolPanel
      name="dedup"
      script={() =>
        steps(
          { type: 'text-delta', delta: '唯一正文', eventId: 5 },
          { type: 'text-delta', delta: '唯一正文', eventId: 5 },
          { type: 'text-delta', delta: '倒序污染', eventId: 3 },
          { type: 'message-end', finishReason: 'stop', eventId: 6 },
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'dedup')
    const state = snapshot(element)
    await expect(state.messages.at(-1)?.parts).toEqual([{ type: 'text', text: '唯一正文' }])
    await expect(state.lastEventId).toBe(6)
    await expect(state.observed.map((event) => event.eventId)).toEqual([5, 6])
    await expect(within(element).getByText('唯一正文')).toBeVisible()
  },
}

export const StructuredErrors: Story = {
  name: '结构化错误与重试入口',
  render: () => (
    <>
      {[false, true, undefined].map((retryable) => (
        <ProtocolPanel
          key={String(retryable)}
          name={`retry-${String(retryable)}`}
          script={() =>
            steps({
              type: 'error',
              error: '请求失败',
              scope: 'server',
              code: 'rate_limited',
              retryAfterMs: 1500,
              retryable,
            })
          }
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const retryable of [false, true, undefined]) {
      const element = await panel(canvasElement, `retry-${String(retryable)}`)
      await expect(snapshot(element).messages.at(-1)?.parts[0]).toMatchObject({
        type: 'error',
        scope: 'server',
        code: 'rate_limited',
        retryAfterMs: 1500,
        retryable: retryable ?? true,
      })
      await expect(
        within(within(element).getByRole('alert')).queryAllByRole('button'),
      ).toHaveLength(retryable === false ? 0 : 1)
    }
  },
}

export const UnknownEvent: Story = {
  name: '未知事件被忽略',
  render: () => (
    <ProtocolPanel
      name="unknown"
      script={() =>
        steps(
          { type: 'text-delta', delta: '前' },
          { type: 'future-event', payload: '不能渲染' } as unknown as ChatEvent,
          { type: 'text-delta', delta: '后' },
          { type: 'message-end', finishReason: 'stop' },
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'unknown')
    await expect(snapshot(element).messages.at(-1)?.parts).toEqual([{ type: 'text', text: '前后' }])
    await expect(snapshot(element).messages.at(-1)?.status).toBe('complete')
    await expect(within(element).getByText('前后')).toBeVisible()
  },
}

export const InterleavedBlocks: Story = {
  name: 'blockId 交错：首次出现顺序',
  render: () => (
    <ProtocolPanel
      name="blocks"
      script={() =>
        steps(
          { type: 'text-start', blockId: 'a' },
          { type: 'text-delta', blockId: 'a', delta: 'A1' },
          { type: 'text-start', blockId: 'b' },
          { type: 'text-delta', blockId: 'b', delta: 'B1' },
          { type: 'text-delta', blockId: 'a', delta: 'A2' },
          { type: 'text-delta', blockId: 'b', delta: 'B2' },
          { type: 'text-end', blockId: 'a' },
          { type: 'text-end', blockId: 'b' },
          { type: 'message-end', finishReason: 'stop' },
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'blocks')
    await expect(snapshot(element).messages.at(-1)?.parts).toEqual([
      { type: 'text', blockId: 'a', text: 'A1A2' },
      { type: 'text', blockId: 'b', text: 'B1B2' },
    ])
    await expect(within(element).getByText('A1A2')).toBeVisible()
    await expect(within(element).getByText('B1B2')).toBeVisible()
  },
}

export const ClientTool: Story = {
  name: 'client tool：等待宿主执行',
  render: () => (
    <ProtocolPanel
      name="client-tool"
      script={() =>
        steps(
          {
            type: 'tool-input-start',
            toolCallId: 'browser-1',
            name: 'browser_context',
            execution: 'client',
          },
          { type: 'tool-input-available', toolCallId: 'browser-1', input: { page: 'current' } },
          { type: 'message-end', finishReason: 'tool-calls' },
        )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'client-tool')
    await expect(snapshot(element).messages.at(-1)?.parts[0]).toMatchObject({
      execution: 'client',
      state: 'awaiting-client',
    })
    await expect(element.querySelector('.animate-cc-spin')).toBeNull()
    await expect(within(element).getByText(/等待宿主|Waiting for host/)).toBeVisible()
  },
}

export const PermissionRoundTrip: Story = {
  name: '权限往返：同 turn 新 run',
  render: () => (
    <ProtocolPanel
      name="permission"
      script={(request) =>
        request.input?.some((input) => input.type === 'permission-decision')
          ? steps(
              { type: 'text-delta', delta: '审批后继续' },
              { type: 'message-end', finishReason: 'stop' },
            )
          : steps(
              { type: 'permission-request', request: { id: 'approval-1', toolName: 'read_file' } },
              { type: 'message-end', finishReason: 'awaiting-permission' },
            )
      }
    />
  ),
  play: async ({ canvasElement }) => {
    const element = await panel(canvasElement, 'permission')
    await expect(snapshot(element).messages.at(-1)?.metadata?.finishReason).toBe(
      'awaiting-permission',
    )
    await userEvent.click(within(element).getByRole('menuitem', { name: /允许这一次/ }))
    await waitFor(() =>
      expect(snapshot(element).messages.at(-1)?.metadata?.finishReason).toBe('stop'),
    )
    const requests = snapshot(element).requests
    await expect(requests).toHaveLength(2)
    await expect(requests[1]?.turnId).toBe(requests[0]?.turnId)
    await expect(requests[1]?.runId).not.toBe(requests[0]?.runId)
    await expect(requests[1]?.input?.[0]).toMatchObject({
      type: 'permission-decision',
      requestId: 'approval-1',
      decision: 'allow-once',
      inputId: expect.any(String),
    })
    await expect(within(element).queryByRole('menuitem', { name: /允许这一次/ })).toBeNull()
    await expect(within(element).getByText('审批后继续')).toBeVisible()
  },
}

function FrameView() {
  const decoder = createSSEDecoder()
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\n\r\nid: 7\r\nevent: custom\r\ndata: 第一行\r\ndata: 第二行\r\n\r\n',
  )
  const messages = [
    ...decoder.push(bytes.slice(0, 57)),
    ...decoder.push(bytes.slice(57)),
    ...decoder.flush(),
  ]
  return (
    <section>
      <h3>SSE 字节帧解析</h3>
      <p>心跳不产出事件；CRLF、多行 data 与跨字节分块。</p>
      <pre data-testid="frames">{JSON.stringify(messages, null, 2)}</pre>
    </section>
  )
}

export const FrameRules: Story = {
  name: '帧规则：字节、心跳、多行、CRLF',
  render: () => <FrameView />,
  play: async ({ canvasElement }) => {
    const messages = JSON.parse(within(canvasElement).getByTestId('frames').textContent ?? '[]')
    await expect(messages).toEqual([{ event: 'custom', id: '7', data: '第一行\n第二行' }])
  },
}
