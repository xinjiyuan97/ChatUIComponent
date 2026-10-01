import type { ChatEvent, ChatInput, ChatMessage, TokenUsage } from '@xinjiyuan97/chat-core'
import { scriptedProvider, type AgentProvider } from './provider.ts'
import { scenarioOf, type Scenario } from './scenarios.ts'
import type { StoredFrame } from './frames.ts'

export type Run = {
  id: string
  events: StoredFrame[]
  nextEventId: number
  done: boolean
  cancelled: boolean
  waiters: Set<() => void>
  scenario: Scenario
}
type Turn = {
  id: string
  runs: Map<string, Run>
  inputRuns: Map<string, string>
  inputIds: Set<string>
}
export type Envelope = {
  protocol?: string
  conversationId?: string
  turnId?: string
  runId?: string
  messages?: ChatMessage[]
  input?: ChatInput[]
  resume?: { lastEventId?: number }
  metadata?: { scenario?: string }
}

const REPLAY_WINDOW = 256
const turns = new Map<string, Turn>()
const wake = (run: Run) => {
  for (const resolve of run.waiters) resolve()
  run.waiters.clear()
}
const usage = (inputTokens: number, outputTokens: number): TokenUsage => ({
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
})
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

export class AgentEngine {
  private readonly provider: AgentProvider
  constructor(provider: AgentProvider = scriptedProvider) {
    this.provider = provider
  }
  getTurn(id?: string): Turn {
    const turnId = id ?? makeId('turn')
    let turn = turns.get(turnId)
    if (!turn) {
      turn = { id: turnId, runs: new Map(), inputRuns: new Map(), inputIds: new Set() }
      turns.set(turnId, turn)
    }
    return turn
  }
  append(run: Run, event: ChatEvent) {
    if (run.done) return
    const id = run.nextEventId++
    run.events.push({ id, event: { ...event, eventId: id } })
    if (run.events.length > REPLAY_WINDOW) run.events.shift()
    wake(run)
  }
  finish(run: Run, reason: string, finalUsage = usage(1, 1)) {
    if (run.done) return
    this.append(run, { type: 'message-end', finishReason: reason, usage: finalUsage })
    run.done = true
    wake(run)
  }
  async produce(turn: Turn, run: Run, body: Envelope, input: ChatInput[]) {
    const text =
      body.messages
        ?.at(-1)
        ?.parts.filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(' ') ?? ''
    const events = this.provider({
      scenario: run.scenario,
      input,
      text,
      resumed: input.some(
        (item) => item.type === 'permission-decision' || item.type === 'tool-result',
      ),
    })
    for await (const event of events) {
      if (run.cancelled) break
      if (run.scenario === 'usage' && event.type === 'message-end')
        this.append(run, { type: 'custom', name: 'usage-snapshot', data: { usage: usage(1, 1) } })
      this.append(run, event)
      if (run.scenario === 'duplicate-out-of-order' && run.events.length === 4) {
        const prior = run.events[1]
        const first = run.events[0]
        if (prior && first) run.events.push(prior, first)
      }
      if (event.type === 'message-end') {
        run.done = true
        wake(run)
        break
      }
    }
    if (run.cancelled) this.finish(run, 'cancelled')
  }
  start(body: Envelope, input: ChatInput[]): Run {
    const turn = this.getTurn(body.turnId)
    const scenario = scenarioOf(
      body.metadata?.scenario ??
        input
          .find((item) => item.type === 'message')
          ?.parts.find((part) => part.type === 'text')
          ?.text.match(/^scenario:(\S+)/)?.[1],
    )
    const runId = body.runId ?? makeId('run')
    const nextEventId =
      Math.max(
        0,
        ...[...turn.runs.values()].flatMap((candidate) =>
          candidate.events.map((event) => event.id),
        ),
      ) + 1
    const run: Run = turn.runs.get(runId) ?? {
      id: runId,
      events: [],
      nextEventId,
      done: false,
      cancelled: false,
      waiters: new Set(),
      scenario,
    }
    turn.runs.set(runId, run)
    for (const item of input) {
      turn.inputIds.add(item.inputId)
      turn.inputRuns.set(item.inputId, run.id)
    }
    if (run.events.length === 0)
      void this.produce(turn, run, body, input).catch((error) => {
        this.append(run, {
          type: 'error',
          error: String(error),
          scope: 'transport',
          code: 'internal',
          retryable: true,
        })
        this.finish(run, 'error')
      })
    return run
  }
  cancel(body: Envelope, item: Extract<ChatInput, { type: 'cancel' }>) {
    const turn = this.getTurn(body.turnId)
    if (turn.inputIds.has(item.inputId)) return
    turn.inputIds.add(item.inputId)
    const run = turn.runs.get(body.runId ?? turn.runs.keys().next().value ?? '')
    if (run) {
      run.cancelled = true
      this.finish(run, 'cancelled')
    }
  }
  duplicate(body: Envelope, input: ChatInput[]) {
    const turn = this.getTurn(body.turnId)
    const old = input.find((item) => turn.inputIds.has(item.inputId))
    return old ? turn.runs.get(turn.inputRuns.get(old.inputId) ?? '') : undefined
  }
  replayExpired(run: Run, cursor: number) {
    const first = run.events[0]?.id
    return first !== undefined && cursor < first - 1
  }
  stream(
    run: Run,
    cursor: number,
    signal: AbortSignal,
    onFrame: (frame: StoredFrame) => void,
    onEnd: () => void,
  ) {
    let next = cursor + 1
    const pump = async () => {
      while (!signal.aborted) {
        for (const frame of run.events)
          if (frame.id >= next) {
            onFrame(frame)
            next = frame.id + 1
          }
        if (run.done || run.scenario === 'disconnect') break
        await new Promise<void>((resolve) => run.waiters.add(resolve))
      }
      onEnd()
    }
    void pump()
  }
}
