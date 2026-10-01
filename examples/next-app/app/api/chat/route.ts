import type {
  A2UINode,
  ChatEvent,
  ChatInput,
  ChatMessage,
  TokenUsage,
} from '@xinjiyuan97/chat-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROTOCOL = 'agent-chat/1'
const REPLAY_WINDOW = 256

type StoredEvent = { id: number; event: ChatEvent }

type DemoRun = {
  id: string
  events: StoredEvent[]
  nextEventId: number
  done: boolean
  cancelled: boolean
  waiters: Set<() => void>
}

type DemoTurn = {
  id: string
  runs: Map<string, DemoRun>
  inputRuns: Map<string, string>
  inputIds: Set<string>
}

type DemoRuntime = { turns: Map<string, DemoTurn> }

const globalState = globalThis as typeof globalThis & { __agentChatDemo?: DemoRuntime }
const state = (globalState.__agentChatDemo ??= { turns: new Map() })

const capabilities = {
  blockIds: true,
  resume: true,
  clientTools: true,
  permissions: true,
  a2ui: true,
}

const limits = {
  disconnectGracePeriodMs: 10_000,
  maxAttachmentBytes: 5 * 1024 * 1024,
  maxAttachmentCount: 10,
  resumeWindowEvents: REPLAY_WINDOW,
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function getTurn(turnId?: string) {
  const resolvedId = turnId ?? id('turn')
  let turn = state.turns.get(resolvedId)
  if (!turn) {
    turn = {
      id: resolvedId,
      runs: new Map(),
      inputRuns: new Map(),
      inputIds: new Set(),
    }
    state.turns.set(resolvedId, turn)
  }
  return turn
}

function wake(run: DemoRun) {
  for (const resolve of run.waiters) resolve()
  run.waiters.clear()
}

function appendEvent(run: DemoRun, event: ChatEvent) {
  if (run.done) return
  const eventId = run.nextEventId++
  run.events.push({ id: eventId, event: { ...event, eventId } })
  if (run.events.length > REPLAY_WINDOW) run.events.shift()
  wake(run)
}

function finish(run: DemoRun, finishReason: string, usage: TokenUsage) {
  if (run.done) return
  appendEvent(run, { type: 'message-end', finishReason, usage })
  run.done = true
  wake(run)
}

function usage(inputTokens: number, outputTokens: number): TokenUsage {
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
}

function inputText(messages: ChatMessage[] | undefined) {
  const last = messages?.at(-1)
  return last?.parts
    .filter(
      (part): part is Extract<ChatMessage['parts'][number], { type: 'text' }> =>
        part.type === 'text',
    )
    .map((part) => part.text)
    .join(' ')
    .trim()
}

function hasInput(input: ChatInput[], type: ChatInput['type']) {
  return input.find((candidate) => candidate.type === type)
}

async function produce(
  turn: DemoTurn,
  run: DemoRun,
  messages: ChatMessage[] | undefined,
  input: ChatInput[],
) {
  const text = inputText(messages) ?? ''
  const inputTokens = Math.max(1, text.length)
  const messageId = `assistant-${turn.id}`
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const send = (event: ChatEvent) => appendEvent(run, event)
  const emitText = async (value: string, chunk = 6, delay = 24) => {
    for (let offset = 0; offset < value.length && !run.cancelled; offset += chunk) {
      send({ type: 'text-delta', delta: value.slice(offset, offset + chunk) })
      await wait(delay)
    }
  }

  send({ type: 'server-hello', protocol: PROTOCOL, capabilities, limits })
  send({ type: 'message-start', id: messageId })

  if (run.cancelled) return

  const clientToolResult = hasInput(input, 'tool-result')
  const permissionDecision = hasInput(input, 'permission-decision')
  const a2uiAction = hasInput(input, 'a2ui-action')

  if (permissionDecision?.type === 'permission-decision') {
    send({ type: 'reasoning-start', blockId: 'permission-reasoning' })
    send({
      type: 'reasoning-delta',
      blockId: 'permission-reasoning',
      delta: '已收到你的权限决定，继续执行同一个 turn。',
    })
    send({ type: 'reasoning-end', blockId: 'permission-reasoning' })
    await emitText(
      permissionDecision.decision === 'deny' ? '好的，我会换一种方式。' : '权限已确认，继续处理。',
    )
    send({ type: 'a2ui', surfaceId: 'surface-1', spec: CONFIRM_CARD })
    finish(run, 'stop', usage(inputTokens, 22))
    return
  }

  if (clientToolResult?.type === 'tool-result') {
    await emitText('客户端工具已返回结果，服务端和浏览器的 typed input 往返正常。', 7, 18)
    finish(run, 'stop', usage(inputTokens, 18))
    return
  }

  if (a2uiAction?.type === 'a2ui-action') {
    await emitText(`已收到 A2UI action：${a2uiAction.action}。`, 6, 18)
    finish(run, 'stop', usage(inputTokens, 10))
    return
  }

  if (/不可重试|fatal|invalid/i.test(text)) {
    send({
      type: 'error',
      error: '这个 demo 输入被服务端拒绝。',
      scope: 'server',
      code: 'invalid_request',
      retryable: false,
    })
    finish(run, 'error', usage(inputTokens, 1))
    return
  }

  if (/权限|审批|permission/i.test(text)) {
    send({
      type: 'permission-request',
      request: {
        id: `permission-${turn.id}`,
        toolName: 'read_file',
        title: '读取示例文件',
        detail: '读取 src/auth.ts 以完成回答',
        options: [
          { value: 'allow-once', decision: 'allow-once' },
          { value: 'deny', decision: 'deny' },
        ],
      },
    })
    finish(run, 'awaiting-permission', usage(inputTokens, 2))
    return
  }

  if (/重放窗口|replay window/i.test(text)) {
    for (let index = 0; index < REPLAY_WINDOW + 32 && !run.cancelled; index += 1) {
      send({ type: 'text-delta', delta: `窗口事件 ${index + 1}\n` })
    }
    finish(run, 'stop', usage(inputTokens, REPLAY_WINDOW + 32))
    return
  }

  send({ type: 'reasoning-start', blockId: 'reasoning-1' })
  for (const piece of REASONING) {
    if (run.cancelled) return
    send({ type: 'reasoning-delta', blockId: 'reasoning-1', delta: piece })
    await wait(40)
  }
  send({ type: 'reasoning-end', blockId: 'reasoning-1' })

  if (/客户端工具|client tool/i.test(text)) {
    send({
      type: 'tool-input-start',
      toolCallId: 'client-call-1',
      name: 'browser_context',
      execution: 'client',
    })
    send({
      type: 'tool-input-delta',
      toolCallId: 'client-call-1',
      delta: '{"selection":"current-page"}',
    })
    send({
      type: 'tool-input-available',
      toolCallId: 'client-call-1',
      input: { selection: 'current-page' },
    })
    finish(run, 'tool-calls', usage(inputTokens, 8))
    return
  }

  send({ type: 'tool-input-start', toolCallId: 'server-call-1', name: 'read_file' })
  for (const piece of ['{"path":', '"src/auth', '.ts"}']) {
    send({ type: 'tool-input-delta', toolCallId: 'server-call-1', delta: piece })
    await wait(60)
  }
  send({
    type: 'tool-input-available',
    toolCallId: 'server-call-1',
    input: { path: 'src/auth.ts' },
  })
  send({ type: 'tool-executing', toolCallId: 'server-call-1' })
  await wait(500)
  if (run.cancelled) return
  send({
    type: 'tool-output',
    toolCallId: 'server-call-1',
    output: { lines: 80, language: 'typescript' },
  })
  await emitText(ANSWER)
  send({ type: 'a2ui', surfaceId: 'surface-1', spec: CONFIRM_CARD })
  finish(run, 'stop', usage(inputTokens, ANSWER.length + 16))
}

function startRun(
  turn: DemoTurn,
  runId: string,
  messages: ChatMessage[] | undefined,
  input: ChatInput[],
) {
  const run: DemoRun = {
    id: runId,
    events: [],
    nextEventId: 1,
    done: false,
    cancelled: false,
    waiters: new Set(),
  }
  turn.runs.set(runId, run)
  void produce(turn, run, messages, input).catch((error) => {
    appendEvent(run, {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      scope: 'transport',
      code: 'internal',
      retryable: true,
    })
    finish(run, 'error', usage(1, 1))
  })
  return run
}

function replayExpired(run: DemoRun, cursor: number) {
  const first = run.events[0]?.id
  return first !== undefined && cursor < first - 1
}

async function streamRun(
  request: Request,
  run: DemoRun,
  cursor: number,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const encoder = new TextEncoder()
  let next = cursor + 1
  const onAbort = () => wake(run)
  request.signal.addEventListener('abort', onAbort, { once: true })

  try {
    while (!request.signal.aborted) {
      for (const stored of run.events) {
        if (stored.id < next) continue
        controller.enqueue(
          encoder.encode(`id: ${stored.id}\ndata: ${JSON.stringify(stored.event)}\n\n`),
        )
        next = stored.id + 1
      }
      if (run.done) break
      if (run.events.some((stored) => stored.id >= next)) continue
      await new Promise<void>((resolve) => run.waiters.add(resolve))
    }
  } finally {
    request.signal.removeEventListener('abort', onAbort)
    controller.close()
  }
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json(
    { error: { scope: 'transport', code, message, retryable: false } },
    { status },
  )
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    protocol?: string
    turnId?: string
    runId?: string
    messages?: ChatMessage[]
    input?: ChatInput[]
    resume?: { lastEventId?: number }
  }
  const input = Array.isArray(body.input) ? body.input : []
  const turn = getTurn(body.turnId)
  const cursorHeader = Number(request.headers.get('last-event-id'))
  const cursor = Number.isFinite(cursorHeader)
    ? cursorHeader
    : typeof body.resume?.lastEventId === 'number'
      ? body.resume.lastEventId
      : 0

  const cancelInput = hasInput(input, 'cancel')
  if (cancelInput?.type === 'cancel') {
    const target = turn.runs.get(body.runId ?? turn.runs.keys().next().value)
    if (target && !turn.inputIds.has(cancelInput.inputId)) {
      turn.inputIds.add(cancelInput.inputId)
      turn.inputRuns.set(cancelInput.inputId, target.id)
      target.cancelled = true
      finish(target, 'cancelled', usage(1, 1))
    }
    return Response.json({ ok: true })
  }

  let run: DemoRun | undefined
  const duplicateInput = input.find((candidate) => turn.inputIds.has(candidate.inputId))
  if (duplicateInput) {
    run = turn.runs.get(turn.inputRuns.get(duplicateInput.inputId) ?? '')
  } else {
    for (const candidate of input) {
      turn.inputIds.add(candidate.inputId)
    }
    const runId = body.runId ?? id('run')
    const nextRun = turn.runs.get(runId) ?? startRun(turn, runId, body.messages, input)
    run = nextRun
    for (const candidate of input) turn.inputRuns.set(candidate.inputId, nextRun.id)
  }

  const selectedRun = run
  if (!selectedRun)
    return errorResponse(
      409,
      'duplicate_input_unavailable',
      'The input result is no longer available.',
    )
  if (replayExpired(selectedRun, cursor)) {
    return errorResponse(
      409,
      'resume_expired',
      'The requested replay point is outside the retention window.',
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void streamRun(request, selectedRun, cursor, controller)
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

const REASONING = [
  '这是一个服务端流式的冒烟测试。',
  '先确认 SSE 能穿过 Next.js route handler，',
  '再确认组件在 SSR 之后 hydrate 不报 mismatch。',
]

const ANSWER = `## 服务端流式跑通了

这条回复是 \`app/api/chat/route.ts\` 逐块吐出来的，走的是本库原生的 \`ChatEvent\` 格式：

上面的思考过程和工具调用同样来自这个流。现在这条链路还包含了 \`server-hello\`、事件序号、续传和 A2UI action。`

const CONFIRM_CARD: A2UINode = {
  type: 'Card',
  props: { title: '一切正常', subtitle: '这张卡片由 a2ui 事件渲染' },
  children: [
    {
      type: 'Column',
      props: { gap: 'md' },
      children: [
        { type: 'Alert', props: { tone: 'success', text: 'SSR、hydration、流式解析都没问题。' } },
        {
          type: 'Row',
          props: { gap: 'sm', justify: 'end' },
          children: [
            {
              type: 'Button',
              props: { label: '知道了', variant: 'primary', onClick: { action: 'ack' } },
            },
          ],
        },
      ],
    },
  ],
}
