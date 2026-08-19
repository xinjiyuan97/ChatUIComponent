'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'

import type { ChatEvent } from '../events'
import type { ChatStore, SendOptions } from '../store'
import { createChatStore } from '../store'
import type { ChatTransport } from '../transport/types'
import type { ChatMessage, ChatStatus } from '../types'

export type UseChatOptions = {
  transport: ChatTransport
  /** Seeds the store on first render. Ignored afterwards. */
  initialMessages?: ChatMessage[]
  /**
   * Providing this switches to controlled mode: the parent owns the message array and
   * receives every update through `onMessagesChange`.
   */
  messages?: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
  onFinish?: (message: ChatMessage) => void
  onError?: (error: Error) => void
  onEvent?: (event: ChatEvent) => void
}

export type UseChatResult = {
  messages: ChatMessage[]
  status: ChatStatus
  error: Error | null
  /** True while a request is in flight, whether or not tokens have started arriving. */
  isLoading: boolean
  send: (text: string, options?: SendOptions) => Promise<void>
  submit: (options?: SendOptions) => Promise<void>
  stop: () => void
  regenerate: () => Promise<void>
  editAndResend: (messageId: string, text: string) => Promise<void>
  setMessages: (messages: ChatMessage[]) => void
  appendMessage: (message: ChatMessage) => void
  removeMessage: (messageId: string) => void
  toggleReaction: (messageId: string, key: string) => void
  resolveA2UISurface: (messageId: string, surfaceId: string) => void
  clear: () => void
  /** Escape hatch for advanced use: subscribe directly or read outside React. */
  store: ChatStore
}

export function useChat(options: UseChatOptions): UseChatResult {
  // Keep the latest callbacks and transport in a ref so the store is created exactly
  // once. Recreating it on every render would drop in-flight streams.
  const latest = useRef(options)
  latest.current = options

  const [store] = useState<ChatStore>(() =>
    createChatStore({
      transport: {
        send: (request, context) => latest.current.transport.send(request, context),
      } satisfies ChatTransport,
      initialMessages: options.messages ?? options.initialMessages,
      onFinish: (message) => latest.current.onFinish?.(message),
      onError: (error) => latest.current.onError?.(error),
      onEvent: (event) => latest.current.onEvent?.(event),
    }),
  )

  const messages = useStore(store, (state) => state.messages)
  const status = useStore(store, (state) => state.status)
  const error = useStore(store, (state) => state.error)

  const controlled = options.messages !== undefined
  /** Last array we handed to the parent, so echoes don't bounce back in. */
  const lastEmitted = useRef<ChatMessage[] | null>(null)

  // Controlled mode, inbound: adopt the parent's array unless it is our own echo.
  useEffect(() => {
    if (!controlled) return
    const incoming = options.messages as ChatMessage[]
    if (incoming === lastEmitted.current) return
    if (incoming === store.getState().messages) return
    store.setState((state) => ({ ...state, messages: incoming }))
  }, [controlled, options.messages, store])

  // Controlled mode, outbound: publish every internal change to the parent.
  useEffect(() => {
    if (!controlled) return
    return store.subscribe((state, previous) => {
      if (state.messages === previous.messages) return
      lastEmitted.current = state.messages
      latest.current.onMessagesChange?.(state.messages)
    })
  }, [controlled, store])

  // Abort any in-flight request when the component unmounts.
  useEffect(() => () => store.getState().stop(), [store])

  const send = useCallback(
    (text: string, sendOptions?: SendOptions) => store.getState().send(text, sendOptions),
    [store],
  )
  const submit = useCallback(
    (sendOptions?: SendOptions) => store.getState().submit(sendOptions),
    [store],
  )
  const stop = useCallback(() => store.getState().stop(), [store])
  const regenerate = useCallback(() => store.getState().regenerate(), [store])
  const editAndResend = useCallback(
    (messageId: string, text: string) => store.getState().editAndResend(messageId, text),
    [store],
  )
  const setMessages = useCallback(
    (next: ChatMessage[]) => store.getState().setMessages(next),
    [store],
  )
  const appendMessage = useCallback(
    (message: ChatMessage) => store.getState().appendMessage(message),
    [store],
  )
  const removeMessage = useCallback(
    (messageId: string) => store.getState().removeMessage(messageId),
    [store],
  )
  const toggleReaction = useCallback(
    (messageId: string, key: string) => store.getState().toggleReaction(messageId, key),
    [store],
  )
  const resolveA2UISurface = useCallback(
    (messageId: string, surfaceId: string) =>
      store.getState().resolveA2UISurface(messageId, surfaceId),
    [store],
  )
  const clear = useCallback(() => store.getState().clear(), [store])

  return useMemo(
    () => ({
      messages,
      status,
      error,
      isLoading: status === 'submitted' || status === 'streaming',
      send,
      submit,
      stop,
      regenerate,
      editAndResend,
      setMessages,
      appendMessage,
      removeMessage,
      toggleReaction,
      resolveA2UISurface,
      clear,
      store,
    }),
    [
      messages,
      status,
      error,
      send,
      submit,
      stop,
      regenerate,
      editAndResend,
      setMessages,
      appendMessage,
      removeMessage,
      toggleReaction,
      resolveA2UISurface,
      clear,
      store,
    ],
  )
}
