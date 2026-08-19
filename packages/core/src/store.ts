import { createStore, type StoreApi } from 'zustand/vanilla'

import type { ChatEvent } from './events'
import { generateId } from './id'
import { applyEvent } from './reducer'
import type { ChatTransport, SendRequest } from './transport/types'
import type { ChatMessage, ChatStatus, MessagePart, Reaction } from './types'

export type ChatStoreState = {
  messages: ChatMessage[]
  status: ChatStatus
  error: Error | null
}

export type SendOptions = {
  /** Extra parts to attach alongside the text, e.g. file attachments. */
  parts?: MessagePart[]
  body?: Record<string, unknown>
  headers?: Record<string, string>
}

export type ChatStoreActions = {
  send: (text: string, options?: SendOptions) => Promise<void>
  /** Sends without appending a user message — used for tool results and A2UI actions. */
  submit: (options?: SendOptions & { regenerate?: boolean }) => Promise<void>
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
  /** Injected in tests to make durations deterministic. */
  now?: () => number
}

export function createChatStore(options: CreateChatStoreOptions): ChatStore {
  const now = options.now ?? (() => Date.now())

  let abortController: AbortController | null = null
  /** Id of the assistant message currently being streamed into. */
  let activeMessageId: string | null = null

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

    function flush() {
      if (frame !== null) {
        cancelFrame(frame)
        frame = null
      }
      if (pending.length === 0) return

      const batch = pending
      pending = []
      const targetId = activeMessageId
      if (!targetId) return

      set((state) => {
        const index = state.messages.findIndex((m) => m.id === targetId)
        if (index === -1) return state
        let message = state.messages[index] as ChatMessage
        const timestamp = now()
        for (const event of batch) {
          message = applyEvent(message, event, timestamp)
        }
        const messages = state.messages.slice()
        messages[index] = message
        return { ...state, messages }
      })
    }

    function enqueue(event: ChatEvent) {
      options.onEvent?.(event)
      pending.push(event)

      // Terminal and structural events flush immediately: status must be correct the
      // moment the stream ends, and a delayed `message-start` would lose its id.
      if (
        event.type === 'message-end' ||
        event.type === 'error' ||
        event.type === 'message-start'
      ) {
        flush()
        return
      }
      if (frame === null) frame = requestFrame(flush)
    }

    async function run(request: SendRequest) {
      abortController?.abort()
      const controller = new AbortController()
      abortController = controller

      const assistant: ChatMessage = {
        id: generateId('asst'),
        role: 'assistant',
        parts: [],
        createdAt: now(),
        status: 'streaming',
      }
      activeMessageId = assistant.id

      set((state) => ({
        ...state,
        status: 'submitted',
        error: null,
        messages: [...state.messages, assistant],
      }))

      try {
        for await (const event of options.transport.send(request, { signal: controller.signal })) {
          if (controller.signal.aborted) break
          if (get().status !== 'streaming') set((state) => ({ ...state, status: 'streaming' }))
          enqueue(event)
        }
        flush()

        if (controller.signal.aborted) {
          markActive({ status: 'aborted' })
          set((state) => ({ ...state, status: 'idle' }))
        } else {
          markActive({ status: 'complete' })
          set((state) => ({ ...state, status: 'idle' }))
          const finished = get().messages.find((m) => m.id === activeMessageId)
          if (finished) options.onFinish?.(finished)
        }
      } catch (rawError) {
        flush()
        // An abort surfaces as an exception in most fetch implementations; it is a
        // user action, not a failure, and must not render an error bubble.
        if (isAbortError(rawError) || controller.signal.aborted) {
          markActive({ status: 'aborted' })
          set((state) => ({ ...state, status: 'idle' }))
        } else {
          const error = rawError instanceof Error ? rawError : new Error(String(rawError))
          markActive(
            { status: 'error' },
            { type: 'error', message: error.message, retryable: true },
          )
          set((state) => ({ ...state, status: 'error', error }))
          options.onError?.(error)
        }
      } finally {
        if (abortController === controller) abortController = null
        activeMessageId = null
      }
    }

    /** Patches the streaming message after the stream settles. */
    function markActive(patch: Partial<ChatMessage>, extraPart?: MessagePart) {
      const targetId = activeMessageId
      if (!targetId) return
      set((state) => {
        const index = state.messages.findIndex((m) => m.id === targetId)
        if (index === -1) return state
        const message = state.messages[index] as ChatMessage
        const messages = state.messages.slice()
        messages[index] = {
          ...message,
          ...patch,
          parts: extraPart ? [...message.parts, extraPart] : message.parts,
        }
        return { ...state, messages }
      })
    }

    /* ---------------------------------------------------------------- actions */

    return {
      messages: options.initialMessages ?? [],
      status: 'idle',
      error: null,

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
        })
      },

      async submit(submitOptions) {
        await run({
          messages: get().messages,
          body: submitOptions?.body,
          headers: submitOptions?.headers,
          regenerate: submitOptions?.regenerate,
        })
      },

      stop() {
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
        activeMessageId = null
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

/** rAF where available, timer fallback for SSR and jsdom. */
function requestFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
  return setTimeout(callback, 16) as unknown as number
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else clearTimeout(handle)
}
