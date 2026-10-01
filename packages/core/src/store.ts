import { createStore, type StoreApi } from 'zustand/vanilla'

import type { ChatEvent } from './events'
import { getEventBatchId } from './event-batch'
import { generateId } from './id'
import { applyEvent, closeDanglingParts, type StreamEndReason } from './reducer'
import type { ChatTransport, SendRequest } from './transport/types'
import type {
  ChatInput,
  ChatMessage,
  ChatStatus,
  A2UIActionRequest,
  MessagePart,
  PermissionResolution,
  Reaction,
  ServerHello,
} from './types'

const MINIMUM_SERVER_HELLO: ServerHello = {
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
}

export type ClientToolResult = {
  output?: unknown
  error?: string
}

export type SubmitClientToolResult = (toolCallId: string, result: ClientToolResult) => Promise<void>

export type ClientToolHandler = (
  event: Extract<ChatEvent, { type: 'tool-input-available' }>,
  submitResult: SubmitClientToolResult,
) => void | Promise<void>

export type ChatStoreState = {
  messages: ChatMessage[]
  status: ChatStatus
  error: Error | null
  lastEventId?: number
  serverHello: ServerHello
}

export type SendOptions = {
  /** Extra parts to attach alongside the text, e.g. file attachments. */
  parts?: MessagePart[]
  body?: Record<string, unknown>
  headers?: Record<string, string>
  input?: ChatInput[]
  turnId?: string
  runId?: string
}

export type ChatStoreActions = {
  send: (text: string, options?: SendOptions) => Promise<void>
  /** Sends without appending a user message — used for tool results and A2UI actions. */
  submit: (options?: SendOptions & { regenerate?: boolean }) => Promise<void>
  submitPermissionDecision: (resolution: PermissionResolution) => Promise<void>
  submitA2UIAction: (messageId: string, action: A2UIActionRequest) => Promise<void>
  stop: () => void
  /** Drops the trailing assistant turn and re-runs the last user message. */
  regenerate: () => Promise<void>
  /** Rewrites a user message, discards everything after it, and re-runs. */
  editAndResend: (messageId: string, text: string) => Promise<void>
  setMessages: (messages: ChatMessage[]) => void
  appendMessage: (message: ChatMessage) => void
  removeMessage: (messageId: string) => void
  toggleReaction: (messageId: string, key: string) => void
  /** Marks an A2UI surface as acted upon so it renders read-only. */
  resolveA2UISurface: (messageId: string, surfaceId: string) => void
  clear: () => void
}

export type ChatStore = StoreApi<ChatStoreState & ChatStoreActions>

export type CreateChatStoreOptions = {
  transport: ChatTransport
  initialMessages?: ChatMessage[]
  onFinish?: (message: ChatMessage) => void
  onError?: (error: Error) => void
  /**
   * Emitted for every event before it reaches the reducer. Useful for logging or for
   * intercepting tool calls the host wants to execute client-side.
   */
  onEvent?: (event: ChatEvent) => void
  /** Handles client-owned tools without changing the synchronous observation callback above. */
  onClientTool?: ClientToolHandler
  /** Injected in tests to make durations deterministic. */
  now?: () => number
}

export function createChatStore(options: CreateChatStoreOptions): ChatStore {
  const now = options.now ?? (() => Date.now())

  let abortController: AbortController | null = null
  let activeRequest: SendRequest | null = null
  /** Identity of the assistant message currently being streamed into. */
  let activeMessage: { id: string } | null = null
  let activeTurnId: string | null = null

  return createStore<ChatStoreState & ChatStoreActions>((set, get) => {
    /* ---------------------------------------------------------------- streaming */

    /**
     * Events are buffered and flushed on an animation frame.
     *
     * Without this, a fast stream causes one React render per token — hundreds per
     * second — and the whole message list re-reconciles each time. Coalescing to the
     * frame rate keeps rendering cost independent of token rate, and the UI can't show
     * more than one frame's worth of progress anyway.
     */
    let pending: ChatEvent[] = []
    let frame: number | null = null
    const acceptedEventBatches = new Set<symbol>()
    const droppedEventBatches = new Set<symbol>()
    const clientToolIds = new Set<string>()
    const permissionTurns = new Map<string, string>()
    const submittedPermissionRequests = new Set<string>()
    const surfaceTurns = new Map<string, string>()
    const submittedA2UIActions = new Set<string>()
    let clientToolsEnabled = true

    function flush() {
      if (frame !== null) {
        cancelFrame(frame)
        frame = null
      }
      if (pending.length === 0) return

      const batch = pending
      pending = []
      const target = activeMessage
      if (!target) return

      set((state) => {
        const index = state.messages.findIndex((m) => m.id === target.id)
        if (index === -1) return state
        let message = state.messages[index] as ChatMessage
        const timestamp = now()
        for (const event of batch) {
          message = applyEvent(message, event, timestamp)
        }
        target.id = message.id
        const messages = state.messages.slice()
        messages[index] = message
        return { ...state, messages }
      })
    }

    function enqueue(event: ChatEvent): boolean {
      const eventId = event.eventId
      if (eventId !== undefined) {
        const batchId = getEventBatchId(event)
        const isAcceptedBatch = batchId !== undefined && acceptedEventBatches.has(batchId)
        const isDroppedBatch = batchId !== undefined && droppedEventBatches.has(batchId)
        const lastEventId = get().lastEventId
        const isOutOfOrder = lastEventId !== undefined && eventId <= lastEventId

        if (isDroppedBatch || (!isAcceptedBatch && isOutOfOrder)) {
          if (batchId !== undefined) droppedEventBatches.add(batchId)
          console.warn(`Dropped duplicate or out-of-order event ${eventId}`)
          return false
        }

        if (batchId !== undefined) acceptedEventBatches.add(batchId)
        set((state) => ({
          ...state,
          lastEventId:
            state.lastEventId === undefined ? eventId : Math.max(state.lastEventId, eventId),
        }))
      }
      if (event.type === 'tool-input-start') {
        if (event.execution === 'client') clientToolIds.add(event.toolCallId)
        else clientToolIds.delete(event.toolCallId)
      }
      if (event.type === 'permission-request' && activeTurnId) {
        permissionTurns.set(event.request.id, activeTurnId)
      }
      if (event.type === 'a2ui' && activeTurnId && activeMessage) {
        surfaceTurns.set(event.surfaceId, activeTurnId)
      }
      options.onEvent?.(event)
      pending.push(event)

      if (
        event.type === 'tool-input-available' &&
        clientToolIds.has(event.toolCallId) &&
        clientToolsEnabled
      ) {
        flush()
        const submitResult: SubmitClientToolResult = submitClientToolResult
        void Promise.resolve(options.onClientTool?.(event, submitResult)).catch(() => undefined)
        return true
      }

      // Terminal and structural events flush immediately: status must be correct the
      // moment the stream ends, and a delayed `message-start` would lose its id.
      if (
        event.type === 'message-end' ||
        event.type === 'error' ||
        event.type === 'message-start'
      ) {
        flush()
        return true
      }
      if (frame === null) frame = requestFrame(flush)
      return true
    }

    async function run(request: SendRequest, resumeMessageId?: string) {
      abortController?.abort()
      const controller = new AbortController()
      abortController = controller
      const requestWithIdentity: SendRequest = {
        ...request,
        turnId: request.turnId ?? generateId('turn'),
        runId: request.runId ?? generateId('run'),
      }
      activeRequest = requestWithIdentity
      activeTurnId = requestWithIdentity.turnId ?? null
      clientToolsEnabled = true

      const existing = resumeMessageId
        ? get().messages.find((message) => message.id === resumeMessageId)
        : undefined
      const assistant: ChatMessage = existing
        ? { ...existing, status: 'streaming' }
        : {
            id: generateId('asst'),
            role: 'assistant',
            parts: [],
            createdAt: now(),
            status: 'streaming',
          }
      const target = { id: assistant.id }
      const isCurrentRun = () => activeRequest === requestWithIdentity
      activeMessage = target
      let messageEndReceived = false

      set((state) => ({
        ...state,
        status: 'submitted',
        error: null,
        serverHello: MINIMUM_SERVER_HELLO,
        messages: existing
          ? state.messages.map((message) => (message.id === existing.id ? assistant : message))
          : [...state.messages, assistant],
      }))

      try {
        for await (const event of options.transport.send(requestWithIdentity, {
          signal: controller.signal,
          onServerHello: (hello) => {
            clientToolsEnabled = hello.capabilities.clientTools !== false
            set((state) => ({ ...state, serverHello: hello }))
          },
        })) {
          if (controller.signal.aborted) break
          if (get().status !== 'streaming') set((state) => ({ ...state, status: 'streaming' }))
          if (enqueue(event) && event.type === 'message-end') messageEndReceived = true
        }
        flush()

        if (!isCurrentRun()) return

        if (controller.signal.aborted) {
          markActive(target, { status: 'aborted' }, 'cancelled')
          set((state) => ({ ...state, status: 'idle' }))
        } else if (!messageEndReceived) {
          markActive(target, { status: 'error' }, 'error')
          set((state) => ({ ...state, status: 'error' }))
        } else {
          markActive(target, {})
          set((state) => ({ ...state, status: 'idle' }))
          const finished = get().messages.find((m) => m.id === target.id)
          if (finished) options.onFinish?.(finished)
        }
      } catch (rawError) {
        flush()
        if (!isCurrentRun()) return
        // An abort surfaces as an exception in most fetch implementations; it is a
        // user action, not a failure, and must not render an error bubble.
        if (isAbortError(rawError) || controller.signal.aborted) {
          markActive(target, { status: 'aborted' }, 'cancelled')
          set((state) => ({ ...state, status: 'idle' }))
        } else {
          const error = rawError instanceof Error ? rawError : new Error(String(rawError))
          markActive(target, { status: 'error' }, 'error', {
            type: 'error',
            message: error.message,
            retryable: true,
          })
          set((state) => ({ ...state, status: 'error', error }))
          options.onError?.(error)
        }
      } finally {
        if (abortController === controller) {
          abortController = null
        }
        if (activeRequest === requestWithIdentity) activeRequest = null
        if (activeRequest === requestWithIdentity && activeMessage === target) {
          activeMessage = null
          acceptedEventBatches.clear()
          droppedEventBatches.clear()
        }
      }
    }

    async function submitPermissionDecision(resolution: PermissionResolution) {
      if (submittedPermissionRequests.has(resolution.requestId)) return

      const message = get().messages.find((candidate) =>
        candidate.parts.some(
          (part) =>
            part.type === 'permission' &&
            part.request.id === resolution.requestId &&
            part.resolution === undefined,
        ),
      )
      if (!message) return

      const turnId = permissionTurns.get(resolution.requestId) ?? activeTurnId
      if (!turnId) return

      submittedPermissionRequests.add(resolution.requestId)
      set((state) => ({
        ...state,
        messages: state.messages.map((candidate) => {
          if (candidate.id !== message.id) return candidate
          return {
            ...candidate,
            parts: candidate.parts.map((part) =>
              part.type === 'permission' && part.request.id === resolution.requestId
                ? { ...part, resolution }
                : part,
            ),
          }
        }),
      }))

      const input: Extract<ChatInput, { type: 'permission-decision' }> = {
        type: 'permission-decision',
        inputId: generateId('input'),
        requestId: resolution.requestId,
        option: resolution.option,
        decision: resolution.decision,
        ...(resolution.reason !== undefined ? { reason: resolution.reason } : {}),
      }
      await run(
        {
          messages: get().messages,
          turnId,
          runId: generateId('run'),
          input: [input],
        },
        message.id,
      )
    }

    async function submitA2UIAction(messageId: string, action: A2UIActionRequest) {
      flush()
      const message = get().messages.find((candidate) => candidate.id === messageId)
      const part = message?.parts.find(
        (candidate) => candidate.type === 'a2ui' && candidate.surfaceId === action.surfaceId,
      )
      if (part?.type !== 'a2ui' || part.resolved) return

      const key = actionKey(action)
      if (submittedA2UIActions.has(key)) return
      submittedA2UIActions.add(key)

      const input: Extract<ChatInput, { type: 'a2ui-action' }> = {
        type: 'a2ui-action',
        inputId: generateId('input'),
        surfaceId: action.surfaceId,
        action: action.action,
        ...(action.payload !== undefined ? { payload: action.payload } : {}),
      }

      if (action.resolve !== false) {
        set((state) => ({
          ...state,
          messages: state.messages.map((candidate) =>
            candidate.id !== messageId
              ? candidate
              : {
                  ...candidate,
                  parts: candidate.parts.map((candidatePart) =>
                    candidatePart.type === 'a2ui' && candidatePart.surfaceId === action.surfaceId
                      ? { ...candidatePart, resolved: true }
                      : candidatePart,
                  ),
                },
          ),
        }))
      }

      await run(
        {
          messages: get().messages,
          turnId: surfaceTurns.get(action.surfaceId),
          runId: generateId('run'),
          input: [input],
        },
        messageId,
      )
    }

    async function submitClientToolResult(toolCallId: string, result: ClientToolResult) {
      const input: Extract<ChatInput, { type: 'tool-result' }> = {
        type: 'tool-result',
        inputId: generateId('input'),
        toolCallId,
        ...(result.error !== undefined ? { error: result.error } : { output: result.output }),
      }
      let accepted = false

      set((state) => {
        const messageIndex = state.messages.findIndex((message) =>
          message.parts.some(
            (part) =>
              part.type === 'tool' &&
              part.toolCallId === toolCallId &&
              part.state === 'awaiting-client',
          ),
        )
        if (messageIndex === -1) return state

        const message = state.messages[messageIndex] as ChatMessage
        const next = applyEvent(
          message,
          result.error !== undefined
            ? { type: 'tool-error', toolCallId, error: result.error }
            : { type: 'tool-output', toolCallId, output: result.output },
          now(),
        )
        const messages = state.messages.slice()
        messages[messageIndex] = next
        accepted = true
        return { ...state, messages }
      })

      if (accepted) await get().submit({ input: [input] })
    }

    /** Patches the streaming message after the stream settles. */
    function markActive(
      target: { id: string },
      patch: Partial<ChatMessage>,
      closeReason?: StreamEndReason,
      extraPart?: MessagePart,
    ) {
      set((state) => {
        const index = state.messages.findIndex((m) => m.id === target.id)
        if (index === -1) return state
        const message = state.messages[index] as ChatMessage
        const messages = state.messages.slice()
        const parts = closeReason
          ? closeDanglingParts(message.parts, now(), closeReason)
          : message.parts
        messages[index] = {
          ...message,
          ...patch,
          parts: extraPart ? [...parts, extraPart] : parts,
        }
        return { ...state, messages }
      })
    }

    /* ---------------------------------------------------------------- actions */

    return {
      messages: options.initialMessages ?? [],
      status: 'idle',
      error: null,
      lastEventId: undefined,
      serverHello: MINIMUM_SERVER_HELLO,

      async send(text, sendOptions) {
        const trimmed = text.trim()
        const parts = sendOptions?.parts ?? []
        if (!trimmed && parts.length === 0) return

        const userMessage: ChatMessage = {
          id: generateId('user'),
          role: 'user',
          parts: [...(trimmed ? [{ type: 'text' as const, text: trimmed }] : []), ...parts],
          createdAt: now(),
          status: 'complete',
        }
        set((state) => ({ ...state, messages: [...state.messages, userMessage] }))

        await run({
          messages: get().messages,
          body: sendOptions?.body,
          headers: sendOptions?.headers,
          turnId: sendOptions?.turnId,
          runId: sendOptions?.runId,
          ...(sendOptions?.input !== undefined ? { input: sendOptions.input } : {}),
        })
      },

      async submit(submitOptions) {
        await run({
          messages: get().messages,
          body: submitOptions?.body,
          headers: submitOptions?.headers,
          regenerate: submitOptions?.regenerate,
          turnId: submitOptions?.turnId,
          runId: submitOptions?.runId,
          ...(submitOptions?.input !== undefined ? { input: submitOptions.input } : {}),
        })
      },

      submitPermissionDecision,
      submitA2UIAction,

      stop() {
        const request = activeRequest
        const cancel = options.transport.cancel
        if (cancel) {
          try {
            void Promise.resolve(
              cancel.call(options.transport, {
                turnId: request?.turnId,
                runId: request?.runId,
                input: { type: 'cancel', inputId: generateId('input'), reason: 'user' },
              }),
            ).catch(() => undefined)
          } catch {
            // Cancellation is best effort; local abort remains authoritative for the UI.
          }
        }
        abortController?.abort()
        abortController = null
      },

      async regenerate() {
        const { messages } = get()
        // Walk back past the assistant turn(s) to the last user message.
        let cut = messages.length
        while (cut > 0 && messages[cut - 1]?.role !== 'user') cut -= 1
        if (cut === 0) return

        set((state) => ({ ...state, messages: state.messages.slice(0, cut) }))
        await run({ messages: get().messages, regenerate: true })
      },

      async editAndResend(messageId, text) {
        const { messages } = get()
        const index = messages.findIndex((m) => m.id === messageId)
        if (index === -1) return

        const original = messages[index] as ChatMessage
        // Keep non-text parts (attachments) and replace only the text.
        const kept = original.parts.filter((p) => p.type !== 'text')
        const edited: ChatMessage = {
          ...original,
          parts: [{ type: 'text', text: text.trim() }, ...kept],
        }
        set((state) => ({ ...state, messages: [...state.messages.slice(0, index), edited] }))
        await run({ messages: get().messages })
      },

      setMessages(messages) {
        set((state) => ({ ...state, messages }))
      },

      appendMessage(message) {
        set((state) => ({ ...state, messages: [...state.messages, message] }))
      },

      removeMessage(messageId) {
        set((state) => ({
          ...state,
          messages: state.messages.filter((m) => m.id !== messageId),
        }))
      },

      toggleReaction(messageId, key) {
        set((state) => ({
          ...state,
          messages: state.messages.map((message) => {
            if (message.id !== messageId) return message
            return { ...message, reactions: toggle(message.reactions ?? [], key) }
          }),
        }))
      },

      resolveA2UISurface(messageId, surfaceId) {
        set((state) => ({
          ...state,
          messages: state.messages.map((message) => {
            if (message.id !== messageId) return message
            return {
              ...message,
              parts: message.parts.map((part) =>
                part.type === 'a2ui' && part.surfaceId === surfaceId
                  ? { ...part, resolved: true }
                  : part,
              ),
            }
          }),
        }))
      },

      clear() {
        abortController?.abort()
        abortController = null
        activeRequest = null
        activeMessage = null
        activeTurnId = null
        acceptedEventBatches.clear()
        droppedEventBatches.clear()
        clientToolIds.clear()
        permissionTurns.clear()
        submittedPermissionRequests.clear()
        surfaceTurns.clear()
        submittedA2UIActions.clear()
        pending = []
        set((state) => ({ ...state, messages: [], status: 'idle', error: null }))
      },
    }
  })
}

/* ------------------------------------------------------------------ helpers */

function toggle(reactions: Reaction[], key: string): Reaction[] {
  const index = reactions.findIndex((r) => r.key === key)
  if (index === -1) return [...reactions, { key, count: 1, active: true }]

  const existing = reactions[index] as Reaction
  const active = !existing.active
  const count = Math.max(0, (existing.count ?? 0) + (active ? 1 : -1))
  // Drop a reaction that nobody holds any more, rather than leaving a zero chip.
  if (!active && count === 0) return reactions.filter((_, i) => i !== index)

  const next = reactions.slice()
  next[index] = { ...existing, active, count }
  return next
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

function actionKey(action: A2UIActionRequest): string {
  try {
    return JSON.stringify([action.surfaceId, action.action, action.payload])
  } catch {
    return `${action.surfaceId}\u0000${action.action}`
  }
}

/** rAF where available, timer fallback for SSR and jsdom. */
function requestFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
  return setTimeout(callback, 16) as unknown as number
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else clearTimeout(handle)
}
