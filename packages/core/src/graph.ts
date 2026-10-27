/** Serializable Mina definitions. v1 is display-only compatibility, not engine migration. */
export type AgentGraphDefinition = AgentGraphDefinitionV1 | AgentGraphDefinitionV2

type AgentGraphBase = {
  name: string
  operators: Readonly<Record<string, AgentGraphOperator>>
  subscriptions: readonly AgentGraphSubscription[]
  limits: { timeout_ms: number; max_deliveries: number }
}
export type AgentGraphTerminal = {
  from: string
  completed: string
  failed: string
  cancelled: string
}
export type AgentGraphDefinitionV1 = AgentGraphBase & {
  schema_version: 1
  lifecycle: { start: { event: string }; terminal: AgentGraphTerminal }
}
export type AgentGraphDefinitionV2 = AgentGraphBase & {
  schema_version: 2
  triggers: Readonly<Record<string, AgentGraphTrigger>>
  lifecycle: { start: { trigger: string }; terminal: AgentGraphTerminal }
}
export type AgentGraphTrigger = {
  type: string
  version: number
  event: string
  config: Readonly<Record<string, unknown>>
}

export type AgentGraphOperator = {
  type: string
  version: number
  config: Readonly<Record<string, unknown>>
}

export type AgentGraphSubscription = {
  id: string
  subscriber: string
  from: string
  events: readonly string[]
}

export type AgentGraphNode = {
  id: string
  kind: 'operator' | 'trigger' | 'input' | 'external' | 'engine' | 'terminal'
  operator?: AgentGraphOperator
  trigger?: AgentGraphTrigger
}

export type AgentGraphConnection = {
  id: string
  source: string
  target: string
  events: readonly string[]
  /** A lifecycle observation is not an executable subscription. */
  kind: 'subscription' | 'terminal'
  subscription?: AgentGraphSubscription
}

export type AgentGraphIssue = { path: string; message: string }
export type AgentGraphTopology = {
  nodes: AgentGraphNode[]
  connections: AgentGraphConnection[]
  issues: AgentGraphIssue[]
}

/**
 * Derives a renderer-independent view without changing the definition. This checks only
 * display structure; protocol schemas, resource binding and reachability belong to Mina.
 * Cycles and multiple subscriptions between the same operators remain intact.
 */
export function buildAgentGraph(definition: AgentGraphDefinition): AgentGraphTopology {
  const nodes: AgentGraphNode[] = []
  const connections: AgentGraphConnection[] = []
  const issues: AgentGraphIssue[] = []
  const issue = (path: string, message: string) => issues.push({ path, message })
  if (definition.schema_version !== 1 && definition.schema_version !== 2)
    issue('schema_version', 'Expected schema version 1 or 2')

  for (const [id, operator] of Object.entries(definition.operators)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) issue(`operators.${id}`, 'Invalid operator instance ID')
    nodes.push({ id, kind: 'operator', operator })
  }
  const operators = new Set(nodes.map((node) => node.id))
  if (definition.schema_version === 2) {
    for (const [id, trigger] of Object.entries(definition.triggers)) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || operators.has(id))
        issue(`triggers.${id}`, 'Invalid or duplicate trigger instance ID')
      nodes.unshift({ id, kind: 'trigger', trigger })
    }
    if (!Object.hasOwn(definition.triggers, definition.lifecycle.start.trigger)) {
      issue('lifecycle.start.trigger', 'Unknown default trigger')
    }
  } else {
    nodes.unshift({ id: '$input', kind: 'input' })
  }
  for (const source of ['$external', '$engine'] as const) {
    if (definition.subscriptions.some((subscription) => subscription.from === source)) {
      nodes.push({ id: source, kind: source === '$external' ? 'external' : 'engine' })
    }
  }
  const sources = new Set(nodes.map((node) => node.id))
  const subscriptionIds = new Set<string>()
  const deliveries = new Set<string>()
  definition.subscriptions.forEach((subscription, index) => {
    const path = `subscriptions[${index}]`
    if (subscriptionIds.has(subscription.id)) issue(`${path}.id`, 'Duplicate subscription ID')
    subscriptionIds.add(subscription.id)
    if (!sources.has(subscription.from)) issue(`${path}.from`, 'Unknown event source')
    if (!operators.has(subscription.subscriber)) issue(`${path}.subscriber`, 'Unknown operator')
    if (!subscription.events.length) issue(`${path}.events`, 'Expected at least one event')
    subscription.events.forEach((event) => {
      const key = JSON.stringify([subscription.from, subscription.subscriber, event])
      if (deliveries.has(key)) issue(`${path}.events`, 'Duplicate event subscription')
      deliveries.add(key)
    })
    connections.push({
      id: `subscription:${subscription.id}`,
      source: subscription.from,
      target: subscription.subscriber,
      events: subscription.events,
      kind: 'subscription',
      subscription,
    })
  })

  const terminal = definition.lifecycle.terminal
  if (!operators.has(terminal.from)) issue('lifecycle.terminal.from', 'Unknown terminal operator')
  nodes.push({ id: '$terminal', kind: 'terminal' })
  connections.push({
    id: 'lifecycle:terminal',
    source: terminal.from,
    target: '$terminal',
    events: [terminal.completed, terminal.failed, terminal.cancelled],
    kind: 'terminal',
  })
  return { nodes, connections, issues }
}
