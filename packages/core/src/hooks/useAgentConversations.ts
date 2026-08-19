'use client'

import { useMemo } from 'react'

import type { Agent, Conversation } from '../types'

/** Section id for conversations with no agent, or one that isn't in the list. */
export const UNASSIGNED_AGENT_ID = '__cc_unassigned__'

export type AgentSection = {
  /** `agent.id`, or `UNASSIGNED_AGENT_ID` for the trailing bucket. */
  id: string
  agent: Agent | null
  conversations: Conversation[]
}

export type AgentGrouping = {
  sections: AgentSection[]
  /** Search hits, flattened across every agent. Empty when no query is active. */
  matches: Conversation[]
  searching: boolean
  /** Which agent a conversation belongs to — for labelling flattened search results. */
  agentOf: (conversationId: string) => Agent | null
  isEmpty: boolean
  /** True when a query is active but matched nothing. */
  isFilteredEmpty: boolean
}

export type GroupConversationsByAgentOptions = {
  agents: Agent[]
  conversations: Conversation[]
  /** Case-insensitive substring match against title and preview. */
  query?: string
}

function matchesQuery(conversation: Conversation, needle: string): boolean {
  return (
    conversation.title.toLowerCase().includes(needle) ||
    (conversation.preview?.toLowerCase().includes(needle) ?? false)
  )
}

/** Pinned first, then most recently updated. Pinning is per-section here, not global. */
function byPinnedThenRecent(a: Conversation, b: Conversation): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
  return b.updatedAt - a.updatedAt
}

/**
 * Buckets conversations under their agent.
 *
 * Kept as a plain function so it can be unit-tested without rendering anything; the hook
 * below is a `useMemo` around it.
 */
export function groupConversationsByAgent(
  options: GroupConversationsByAgentOptions,
): AgentGrouping {
  const { agents, conversations, query = '' } = options

  const needle = query.trim().toLowerCase()
  const searching = needle.length > 0

  const known = new Map(agents.map((agent) => [agent.id, agent]))
  const owner = new Map<string, Agent | null>()

  const buckets = new Map<string, Conversation[]>()
  const unassigned: Conversation[] = []

  for (const conversation of conversations) {
    /* An id that doesn't resolve is treated as unassigned rather than dropped: a stale
     * reference should leave the conversation reachable, not make it disappear. */
    const agent = conversation.agentId ? known.get(conversation.agentId) : undefined
    owner.set(conversation.id, agent ?? null)

    if (searching && !matchesQuery(conversation, needle)) continue

    if (!agent) {
      unassigned.push(conversation)
      continue
    }
    const bucket = buckets.get(agent.id)
    if (bucket) bucket.push(conversation)
    else buckets.set(agent.id, [conversation])
  }

  const sections: AgentSection[] = []
  for (const agent of agents) {
    const list = buckets.get(agent.id) ?? []
    // An agent with nothing in it still gets a header — otherwise "new chat in this
    // agent" has nowhere to live. While searching, an empty section is just noise.
    if (searching && list.length === 0) continue
    sections.push({ id: agent.id, agent, conversations: list.sort(byPinnedThenRecent) })
  }
  if (unassigned.length > 0) {
    sections.push({
      id: UNASSIGNED_AGENT_ID,
      agent: null,
      conversations: unassigned.sort(byPinnedThenRecent),
    })
  }

  /* `filter` already copies, so sorting in place here does not touch the caller's array. */
  const matches = searching
    ? conversations.filter((c) => matchesQuery(c, needle)).sort(byPinnedThenRecent)
    : []

  return {
    sections,
    matches,
    searching,
    agentOf: (conversationId) => owner.get(conversationId) ?? null,
    isEmpty: conversations.length === 0,
    isFilteredEmpty: searching && conversations.length > 0 && matches.length === 0,
  }
}

export type UseAgentConversationsOptions = GroupConversationsByAgentOptions

export function useAgentConversations(options: UseAgentConversationsOptions): AgentGrouping {
  const { agents, conversations, query } = options
  return useMemo(
    () => groupConversationsByAgent({ agents, conversations, query }),
    [agents, conversations, query],
  )
}
