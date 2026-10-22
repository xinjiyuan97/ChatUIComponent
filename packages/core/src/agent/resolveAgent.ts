import type { Agent } from '../types'

export type ResolvedAgent = {
  found: boolean
  id?: string
  name?: string
  avatar?: string
  model?: string
}

/** Resolves host-owned agent identity without throwing for legacy or unknown ids. */
export function resolveAgent(agentId: string | undefined, agents: Agent[] = []): ResolvedAgent {
  if (!agentId) return { found: false }
  const agent = agents.find((candidate) => candidate.id === agentId)
  if (!agent) return { found: false }
  const model = typeof agent.metadata?.model === 'string' ? agent.metadata.model : undefined
  return { found: true, id: agent.id, name: agent.name, avatar: agent.avatar, model }
}
