import type { ChatEvent } from '../events'
import type { A2UINode } from '../types'
import type { ChatTransport, SendRequest, TransportContext } from './types'

export type MockStep = {
  /** Milliseconds to wait *before* emitting this event. */
  delay?: number
  event: ChatEvent
}

export type MockScript = MockStep[] | ((request: SendRequest) => MockStep[] | Promise<MockStep[]>)

export type MockTransportOptions = {
  /** Multiplies every delay. Set to 0 in tests to run the whole script synchronously. */
  speed?: number
}

/**
 * Scripted transport for stories and tests.
 *
 * Every Storybook story and every store test drives the UI through this, so the visual
 * layer is exercised with exactly the same event stream a real provider produces.
 */
export function createMockTransport(
  script: MockScript,
  options: MockTransportOptions = {},
): ChatTransport {
  const speed = options.speed ?? 1

  return {
    async *send(request: SendRequest, context: TransportContext) {
      const steps = typeof script === 'function' ? await script(request) : script

      for (const step of steps) {
        if (context.signal.aborted) return
        const delay = (step.delay ?? 0) * speed
        if (delay > 0) await sleep(delay, context.signal)
        if (context.signal.aborted) return
        yield step.event
      }
    },
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

/* ------------------------------------------------------------------ script builders */

export type ChunkOptions = {
  /** Characters per chunk. Roughly matches how providers emit tokens. */
  chunkSize?: number
  /** Delay between chunks in ms. */
  delay?: number
}

/**
 * Splits text into delta steps. Chunks break on whitespace where possible so words don't
 * visibly tear mid-render — real tokenisers behave similarly.
 */
export function mockText(text: string, options: ChunkOptions = {}): MockStep[] {
  const { chunkSize = 6, delay = 22 } = options
  const steps: MockStep[] = [{ event: { type: 'text-start' } }]
  for (const chunk of chunkText(text, chunkSize)) {
    steps.push({ delay, event: { type: 'text-delta', delta: chunk } })
  }
  steps.push({ event: { type: 'text-end' } })
  return steps
}

export function mockReasoning(text: string, options: ChunkOptions = {}): MockStep[] {
  const { chunkSize = 8, delay = 18 } = options
  const steps: MockStep[] = [{ event: { type: 'reasoning-start' } }]
  for (const chunk of chunkText(text, chunkSize)) {
    steps.push({ delay, event: { type: 'reasoning-delta', delta: chunk } })
  }
  steps.push({ event: { type: 'reasoning-end' } })
  return steps
}

export type MockToolOptions = {
  toolCallId?: string
  name: string
  input: unknown
  output?: unknown
  error?: string
  /** How long the tool "runs" for, between complete arguments and a result. */
  runMs?: number
  delay?: number
}

export function mockTool(options: MockToolOptions): MockStep[] {
  const {
    toolCallId = `call_${options.name}_${options.name.length}`,
    name,
    input,
    output,
    error,
    runMs = 900,
    delay = 25,
  } = options

  const steps: MockStep[] = [{ event: { type: 'tool-input-start', toolCallId, name } }]
  // Stream the arguments as partial JSON, the way providers actually send them.
  for (const chunk of chunkText(JSON.stringify(input, null, 0), 12)) {
    steps.push({ delay, event: { type: 'tool-input-delta', toolCallId, delta: chunk } })
  }
  steps.push({ delay, event: { type: 'tool-executing', toolCallId } })
  steps.push(
    error !== undefined
      ? { delay: runMs, event: { type: 'tool-error', toolCallId, error } }
      : { delay: runMs, event: { type: 'tool-output', toolCallId, output } },
  )
  return steps
}

export function mockA2UI(
  surfaceId: string,
  spec: A2UINode,
  data?: Record<string, unknown>,
): MockStep[] {
  return [{ delay: 120, event: { type: 'a2ui', surfaceId, spec, data } }]
}

/** Wraps a body script with the start/end events a full turn needs. */
export function mockTurn(...groups: MockStep[][]): MockStep[] {
  return [
    { event: { type: 'message-start' } },
    ...groups.flat(),
    { delay: 60, event: { type: 'message-end', finishReason: 'stop' } },
  ]
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  let index = 0
  while (index < text.length) {
    let end = Math.min(index + size, text.length)
    // Prefer breaking after whitespace, but never produce an empty chunk.
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end)
      if (space > index) end = space + 1
    }
    chunks.push(text.slice(index, end))
    index = end
  }
  return chunks
}
