import { describe, expect, it } from 'vitest'

import { UNASSIGNED_AGENT_ID, groupConversationsByAgent } from './useAgentConversations'
import type { Agent, Conversation } from '../types'

const AGENTS: Agent[] = [
  { id: 'code', name: '代码助手' },
  { id: 'data', name: '数据分析' },
  /* Deliberately owns nothing — an agent you have not talked to yet is the normal case. */
  { id: 'docs', name: '文档翻译' },
]

const CONVERSATIONS: Conversation[] = [
  { id: 'c1', title: 'token 刷新竞态', updatedAt: 300, agentId: 'code' },
  { id: 'c2', title: '重构 auth 中间件', updatedAt: 100, agentId: 'code', pinned: true },
  { id: 'c3', title: 'p99 延迟排查', updatedAt: 200, agentId: 'data', preview: 'orders 表慢查询' },
  /* Points at an agent that is not in the list — e.g. one the host has since deleted. */
  { id: 'c4', title: '旧的迁移记录', updatedAt: 400, agentId: 'ghost' },
  { id: 'c5', title: '随手记', updatedAt: 50 },
]

function group(query?: string, conversations = CONVERSATIONS, agents = AGENTS) {
  return groupConversationsByAgent({ agents, conversations, query })
}

function ids(list: Conversation[]): string[] {
  return list.map((c) => c.id)
}

describe('groupConversationsByAgent', () => {
  it('orders sections by the caller-supplied agents array, unassigned last', () => {
    const { sections } = group()
    expect(sections.map((s) => s.id)).toEqual(['code', 'data', 'docs', UNASSIGNED_AGENT_ID])
  })

  it('sorts pinned first, then most recent, inside each section', () => {
    const { sections } = group()
    // c2 is older than c1 but pinned, so it leads its own section — pinning is per-agent.
    expect(ids(sections[0]?.conversations ?? [])).toEqual(['c2', 'c1'])
  })

  it('keeps an agent with no conversations so it still has a header', () => {
    const docs = group().sections.find((s) => s.id === 'docs')
    expect(docs?.conversations).toEqual([])
  })

  it('treats an unknown agentId as unassigned rather than dropping the conversation', () => {
    const unassigned = group().sections.at(-1)
    expect(unassigned?.id).toBe(UNASSIGNED_AGENT_ID)
    expect(unassigned?.agent).toBeNull()
    expect(ids(unassigned?.conversations ?? [])).toEqual(['c4', 'c5'])
  })

  it('omits the unassigned section when every conversation has a known agent', () => {
    const assigned = CONVERSATIONS.filter((c) => c.agentId === 'code' || c.agentId === 'data')
    expect(group(undefined, assigned).sections.map((s) => s.id)).toEqual(['code', 'data', 'docs'])
  })

  it('reports the owning agent per conversation, null when there is none', () => {
    const { agentOf } = group()
    expect(agentOf('c1')?.name).toBe('代码助手')
    expect(agentOf('c4')).toBeNull() // unknown agentId
    expect(agentOf('c5')).toBeNull() // no agentId
    expect(agentOf('nope')).toBeNull() // not a conversation at all
  })

  it('leaves matches empty and searching false without a query', () => {
    expect(group().matches).toEqual([])
    expect(group().searching).toBe(false)
    // Whitespace is not a search.
    expect(group('   ').searching).toBe(false)
  })

  it('searches across every agent, matching title and preview case-insensitively', () => {
    expect(ids(group('TOKEN').matches)).toEqual(['c1'])
    // 'orders' only appears in c3's preview.
    expect(ids(group('orders').matches)).toEqual(['c3'])
  })

  it('drops sections that match nothing while searching', () => {
    const { sections, searching } = group('token')
    expect(searching).toBe(true)
    expect(sections.map((s) => s.id)).toEqual(['code'])
    expect(ids(sections[0]?.conversations ?? [])).toEqual(['c1'])
  })

  it('distinguishes an empty list from a query that matched nothing', () => {
    const empty = group(undefined, [])
    expect(empty.isEmpty).toBe(true)
    expect(empty.isFilteredEmpty).toBe(false)

    const missed = group('这个词不存在')
    expect(missed.isEmpty).toBe(false)
    expect(missed.isFilteredEmpty).toBe(true)
    expect(missed.sections).toEqual([])

    const found = group('token')
    expect(found.isFilteredEmpty).toBe(false)
  })

  it('never reorders the caller-owned arrays', () => {
    const conversations = [...CONVERSATIONS]
    group('e', conversations)
    expect(ids(conversations)).toEqual(ids(CONVERSATIONS))
  })
})
