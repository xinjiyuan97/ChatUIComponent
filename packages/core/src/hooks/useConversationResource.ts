'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatMessage, Conversation } from '../types'

export type ConversationResourceApi = {
  list: () => Promise<Conversation[]>
  create: (input?: { title?: string }) => Promise<Conversation>
  rename: (id: string, title: string) => Promise<void>
  archive: (id: string) => Promise<void>
  messages: (id: string) => Promise<ChatMessage[]>
}

export type UseConversationResourceOptions = {
  api: ConversationResourceApi
  storageKey?: string
}

export type UseConversationResourceResult = {
  conversations: Conversation[]
  activeId?: string
  messages: ChatMessage[]
  loading: boolean
  error: Error | null
  select: (id: string) => void
  create: (input?: { title?: string }) => Promise<Conversation | undefined>
  rename: (id: string, title: string) => Promise<void>
  archive: (id: string) => Promise<void>
  refresh: () => Promise<void>
  invalidate: () => void
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export function useConversationResource({
  api,
  storageKey,
}: UseConversationResourceOptions): UseConversationResourceResult {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [mutationLoading, setMutationLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mountedRef = useRef(true)
  const activeIdRef = useRef<string | undefined>(undefined)
  const listRequestRef = useRef<{ id: number; promise: Promise<void> } | undefined>(undefined)
  const listSequenceRef = useRef(0)
  const messageSequenceRef = useRef(0)
  const mutationSequenceRef = useRef(0)
  const messagesCacheRef = useRef(new Map<string, ChatMessage[]>())

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const persistActiveId = useCallback(
    (id: string | undefined) => {
      if (!storageKey || typeof window === 'undefined') return
      if (id) window.localStorage.setItem(storageKey, id)
      else window.localStorage.removeItem(storageKey)
    },
    [storageKey],
  )

  const loadMessages = useCallback(
    async (id: string) => {
      const cached = messagesCacheRef.current.get(id)
      if (cached) {
        if (mountedRef.current && activeIdRef.current === id) setMessages(cached)
        return
      }

      const requestId = ++messageSequenceRef.current
      setMessagesLoading(true)
      setError(null)
      try {
        const nextMessages = await api.messages(id)
        messagesCacheRef.current.set(id, nextMessages)
        if (
          mountedRef.current &&
          requestId === messageSequenceRef.current &&
          activeIdRef.current === id
        ) {
          setMessages(nextMessages)
        }
      } catch (value) {
        if (
          mountedRef.current &&
          requestId === messageSequenceRef.current &&
          activeIdRef.current === id
        ) {
          setError(toError(value))
        }
      } finally {
        if (mountedRef.current && requestId === messageSequenceRef.current) {
          setMessagesLoading(false)
        }
      }
    },
    [api],
  )

  const select = useCallback(
    (id: string) => {
      activeIdRef.current = id
      setActiveId(id)
      persistActiveId(id)
      setError(null)
      const cached = messagesCacheRef.current.get(id)
      if (cached) {
        setMessages(cached)
        return
      }
      setMessages([])
      void loadMessages(id)
    },
    [loadMessages, persistActiveId],
  )

  const refresh = useCallback(async () => {
    const existing = listRequestRef.current
    if (existing) return existing.promise

    const requestId = ++listSequenceRef.current
    setListLoading(true)
    setError(null)
    const promise = api
      .list()
      .then((nextConversations) => {
        if (!mountedRef.current || requestId !== listSequenceRef.current) return
        setConversations(nextConversations)
        const storedId =
          storageKey && typeof window !== 'undefined'
            ? (window.localStorage.getItem(storageKey) ?? undefined)
            : undefined
        const nextActiveId =
          activeIdRef.current && nextConversations.some((item) => item.id === activeIdRef.current)
            ? activeIdRef.current
            : storedId && nextConversations.some((item) => item.id === storedId)
              ? storedId
              : undefined
        activeIdRef.current = nextActiveId
        setActiveId(nextActiveId)
        if (nextActiveId) void loadMessages(nextActiveId)
        else setMessages([])
      })
      .catch((value) => {
        if (mountedRef.current && requestId === listSequenceRef.current) setError(toError(value))
      })
      .finally(() => {
        if (mountedRef.current && requestId === listSequenceRef.current) setListLoading(false)
        if (listRequestRef.current?.id === requestId) listRequestRef.current = undefined
      })

    listRequestRef.current = { id: requestId, promise }
    return promise
  }, [api, loadMessages, storageKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (input?: { title?: string }) => {
      const requestId = ++mutationSequenceRef.current
      setMutationLoading(true)
      setError(null)
      try {
        const conversation = await api.create(input)
        if (mountedRef.current && requestId === mutationSequenceRef.current) {
          setConversations((current) => [
            conversation,
            ...current.filter((item) => item.id !== conversation.id),
          ])
          activeIdRef.current = conversation.id
          setActiveId(conversation.id)
          persistActiveId(conversation.id)
          setMessages([])
          void loadMessages(conversation.id)
        }
        return conversation
      } catch (value) {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setError(toError(value))
        return undefined
      } finally {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setMutationLoading(false)
      }
    },
    [api, loadMessages, persistActiveId],
  )

  const rename = useCallback(
    async (id: string, title: string) => {
      const requestId = ++mutationSequenceRef.current
      setMutationLoading(true)
      setError(null)
      try {
        await api.rename(id, title)
        if (mountedRef.current && requestId === mutationSequenceRef.current) {
          setConversations((current) =>
            current.map((conversation) =>
              conversation.id === id ? { ...conversation, title } : conversation,
            ),
          )
        }
      } catch (value) {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setError(toError(value))
      } finally {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setMutationLoading(false)
      }
    },
    [api],
  )

  const archive = useCallback(
    async (id: string) => {
      const requestId = ++mutationSequenceRef.current
      setMutationLoading(true)
      setError(null)
      try {
        await api.archive(id)
        if (mountedRef.current && requestId === mutationSequenceRef.current) {
          setConversations((current) => current.filter((conversation) => conversation.id !== id))
          messagesCacheRef.current.delete(id)
          if (activeIdRef.current === id) {
            activeIdRef.current = undefined
            setActiveId(undefined)
            persistActiveId(undefined)
            setMessages([])
          }
        }
      } catch (value) {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setError(toError(value))
      } finally {
        if (mountedRef.current && requestId === mutationSequenceRef.current)
          setMutationLoading(false)
      }
    },
    [api, persistActiveId],
  )

  const invalidate = useCallback(() => {
    messagesCacheRef.current.clear()
    void refresh()
  }, [refresh])

  return {
    conversations,
    activeId,
    messages,
    loading: listLoading || messagesLoading || mutationLoading,
    error,
    select,
    create,
    rename,
    archive,
    refresh,
    invalidate,
  }
}
