'use client'

import { useMemo } from 'react'

import type { Conversation } from '../types'

/** Group keys are semantic; the UI layer maps them to localised labels. */
export type ConversationGroupKey =
  'pinned' | 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'older'

export type ConversationGroup = {
  key: ConversationGroupKey
  conversations: Conversation[]
}

export type UseConversationListOptions = {
  conversations: Conversation[]
  /** Case-insensitive substring match against title and preview. */
  query?: string
  groupBy?: 'date' | 'none'
  /** Injected for deterministic tests and stories. */
  now?: number
}

export type UseConversationListResult = {
  groups: ConversationGroup[]
  /** Flat, sorted, filtered list — useful for keyboard navigation and virtualisation. */
  flat: Conversation[]
  total: number
  isEmpty: boolean
  /** True when a query is active but matched nothing. */
  isFilteredEmpty: boolean
}

const DAY = 24 * 60 * 60 * 1000

export function useConversationList(
  options: UseConversationListOptions,
): UseConversationListResult {
  const { conversations, query = '', groupBy = 'date', now = Date.now() } = options

  return useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? conversations.filter(
          (c) =>
            c.title.toLowerCase().includes(needle) ||
            (c.preview?.toLowerCase().includes(needle) ?? false),
        )
      : conversations

    const sorted = [...matched].sort((a, b) => b.updatedAt - a.updatedAt)

    if (groupBy === 'none') {
      return {
        groups: sorted.length ? [{ key: 'today' as const, conversations: sorted }] : [],
        flat: sorted,
        total: sorted.length,
        isEmpty: conversations.length === 0,
        isFilteredEmpty: conversations.length > 0 && sorted.length === 0,
      }
    }

    // Bucket against calendar day boundaries, not rolling 24h windows — a message from
    // 11pm yesterday should read as "yesterday", not "today".
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const todayMs = startOfToday.getTime()

    const buckets = new Map<ConversationGroupKey, Conversation[]>()
    const push = (key: ConversationGroupKey, conversation: Conversation) => {
      const list = buckets.get(key)
      if (list) list.push(conversation)
      else buckets.set(key, [conversation])
    }

    for (const conversation of sorted) {
      if (conversation.pinned) {
        push('pinned', conversation)
      } else if (conversation.updatedAt >= todayMs) {
        push('today', conversation)
      } else if (conversation.updatedAt >= todayMs - DAY) {
        push('yesterday', conversation)
      } else if (conversation.updatedAt >= todayMs - 7 * DAY) {
        push('last7Days', conversation)
      } else if (conversation.updatedAt >= todayMs - 30 * DAY) {
        push('last30Days', conversation)
      } else {
        push('older', conversation)
      }
    }

    const order: ConversationGroupKey[] = [
      'pinned',
      'today',
      'yesterday',
      'last7Days',
      'last30Days',
      'older',
    ]
    const groups = order
      .map((key) => ({ key, conversations: buckets.get(key) ?? [] }))
      .filter((group) => group.conversations.length > 0)

    return {
      groups,
      flat: groups.flatMap((group) => group.conversations),
      total: sorted.length,
      isEmpty: conversations.length === 0,
      isFilteredEmpty: conversations.length > 0 && sorted.length === 0,
    }
  }, [conversations, query, groupBy, now])
}
