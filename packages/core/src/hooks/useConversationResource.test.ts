import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ChatMessage, Conversation } from '../types'
import { type ConversationResourceApi, useConversationResource } from './useConversationResource'

const conversations: Conversation[] = [
  { id: 'one', title: 'One', updatedAt: 1 },
  { id: 'two', title: 'Two', updatedAt: 2 },
]

const messages: ChatMessage[] = [
  { id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function makeApi(overrides: Partial<ConversationResourceApi> = {}): ConversationResourceApi {
  return {
    list: vi.fn().mockResolvedValue(conversations),
    create: vi.fn().mockResolvedValue({ id: 'three', title: 'Three', updatedAt: 3 }),
    rename: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    messages: vi.fn().mockResolvedValue(messages),
    ...overrides,
  }
}

describe('useConversationResource', () => {
  it('loads, creates, renames, archives, and loads messages', async () => {
    const api = makeApi()
    const { result } = renderHook(() => useConversationResource({ api }))

    await waitFor(() => expect(result.current.conversations).toEqual(conversations))
    expect(api.list).toHaveBeenCalledTimes(1)

    let created: Conversation | undefined
    await act(async () => {
      created = await result.current.create({ title: 'Three' })
    })
    expect(created).toEqual({ id: 'three', title: 'Three', updatedAt: 3 })
    expect(api.create).toHaveBeenCalledWith({ title: 'Three' })
    await waitFor(() => expect(result.current.messages).toEqual(messages))
    expect(result.current.activeId).toBe('three')

    await act(async () => {
      await result.current.rename('three', 'Renamed')
    })
    expect(api.rename).toHaveBeenCalledWith('three', 'Renamed')
    expect(result.current.conversations[0]).toMatchObject({ id: 'three', title: 'Renamed' })

    await act(async () => {
      await result.current.archive('three')
    })
    expect(api.archive).toHaveBeenCalledWith('three')
    expect(result.current.conversations.some((conversation) => conversation.id === 'three')).toBe(
      false,
    )
    expect(result.current.activeId).toBeUndefined()
    expect(result.current.messages).toEqual([])
    expect(api.messages).toHaveBeenCalledWith('three')
  })

  it('does not let a slow message response overwrite the latest selection', async () => {
    const first = deferred<ChatMessage[]>()
    const second = deferred<ChatMessage[]>()
    const api = makeApi({
      messages: vi.fn((id: string) => (id === 'one' ? first.promise : second.promise)),
    })
    const { result } = renderHook(() => useConversationResource({ api }))

    await waitFor(() => expect(result.current.conversations).toEqual(conversations))
    act(() => result.current.select('one'))
    act(() => result.current.select('two'))
    await act(async () => {
      second.resolve([{ id: 'two-message', role: 'assistant', parts: [] }])
      await second.promise
    })
    expect(result.current.messages[0]?.id).toBe('two-message')

    await act(async () => {
      first.resolve([{ id: 'one-message', role: 'assistant', parts: [] }])
      await first.promise
    })
    expect(result.current.activeId).toBe('two')
    expect(result.current.messages[0]?.id).toBe('two-message')
  })

  it('captures client failures without throwing from the hook', async () => {
    const failure = new Error('list failed')
    const api = makeApi({ list: vi.fn().mockRejectedValue(failure) })
    const { result } = renderHook(() => useConversationResource({ api }))

    await waitFor(() => expect(result.current.error).toBe(failure))
    expect(result.current.loading).toBe(false)
  })

  it('deduplicates invalidations while a list request is in flight', async () => {
    const pending = deferred<Conversation[]>()
    const api = makeApi({ list: vi.fn(() => pending.promise) })
    const { result } = renderHook(() => useConversationResource({ api }))

    act(() => {
      result.current.invalidate()
      result.current.invalidate()
    })
    expect(api.list).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(conversations)
      await pending.promise
    })
    await waitFor(() => expect(result.current.conversations).toEqual(conversations))
  })
})
