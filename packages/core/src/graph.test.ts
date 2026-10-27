import { describe, expect, it } from 'vitest'
import { buildAgentGraph, type AgentGraphDefinitionV1, type AgentGraphDefinitionV2 } from './graph'

const graph: AgentGraphDefinitionV1 = {
  schema_version: 1,
  name: 'cycle',
  operators: {
    context: { type: 'agent.context', version: 1, config: { max_steps: 8 } },
    model: { type: 'agent.model', version: 1, config: { model: 'primary' } },
    gate: { type: 'agent.gate', version: 1, config: {} },
  },
  subscriptions: [
    { id: 'start', from: '$input', subscriber: 'context', events: ['agent.start.v1'] },
    { id: 'model', from: 'context', subscriber: 'model', events: ['model.requested.v1'] },
    { id: 'failure', from: 'context', subscriber: 'model', events: ['context.failed.v1'] },
    { id: 'batch', from: 'model', subscriber: 'gate', events: ['stop.tool_calls.v1'] },
    { id: 'return', from: 'gate', subscriber: 'context', events: ['gate.completed.v1'] },
  ],
  lifecycle: {
    start: { event: 'agent.start.v1' },
    terminal: {
      from: 'model',
      completed: 'stop.completed.v1',
      failed: 'stop.failed.v1',
      cancelled: 'stop.cancelled.v1',
    },
  },
  limits: { timeout_ms: 10000, max_deliveries: 100 },
}
const v2: AgentGraphDefinitionV2 = {
  ...graph,
  schema_version: 2,
  triggers: { start: { type: 'manual', version: 1, event: 'agent.start.v1', config: {} } },
  subscriptions: graph.subscriptions.map((edge) => ({
    ...edge,
    from: edge.from === '$input' ? 'start' : edge.from,
  })),
  lifecycle: { ...graph.lifecycle, start: { trigger: 'start' } },
}

describe('buildAgentGraph', () => {
  it('preserves cycles, separate subscriptions and the definition', () => {
    const before = JSON.stringify(graph)
    const result = buildAgentGraph(graph)
    expect(result.issues).toEqual([])
    expect(
      result.connections.filter((edge) => edge.source === 'context' && edge.target === 'model'),
    ).toHaveLength(2)
    expect(result.connections.find((edge) => edge.subscription?.id === 'return')).toMatchObject({
      source: 'gate',
      target: 'context',
    })
    expect(JSON.stringify(graph)).toBe(before)
  })
  it('distinguishes lifecycle observation from subscriptions and operators', () => {
    const result = buildAgentGraph(graph)
    expect(result.nodes.find((node) => node.id === '$terminal')).toEqual({
      id: '$terminal',
      kind: 'terminal',
    })
    expect(result.connections.find((edge) => edge.kind === 'terminal')).toMatchObject({
      source: 'model',
      events: ['stop.completed.v1', 'stop.failed.v1', 'stop.cancelled.v1'],
    })
    expect(result.nodes.filter((node) => node.kind === 'operator')).toHaveLength(3)
  })
  it('adds only referenced external sources', () => {
    const result = buildAgentGraph({
      ...graph,
      subscriptions: [
        ...graph.subscriptions,
        { id: 'wake', from: '$external', subscriber: 'context', events: ['wait.woken.v1'] },
        { id: 'end', from: '$engine', subscriber: 'context', events: ['engine.terminal.v1'] },
      ],
    })
    expect(result.issues).toEqual([])
    expect(result.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(['external', 'engine']),
    )
    expect(buildAgentGraph(graph).nodes.some((node) => node.id === '$external')).toBe(false)
  })
  it('reports dangling references and duplicate event delivery at their definition paths', () => {
    const result = buildAgentGraph({
      ...graph,
      subscriptions: [
        ...graph.subscriptions,
        { id: 'start', from: 'missing', subscriber: 'missing', events: [] },
        { ...graph.subscriptions[0]!, id: 'duplicate' },
      ],
    })
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'subscriptions[5].id',
      'subscriptions[5].from',
      'subscriptions[5].subscriber',
      'subscriptions[5].events',
      'subscriptions[6].events',
    ])
  })
  it('renders v2 triggers as sources without inventing an implicit input', () => {
    const result = buildAgentGraph(v2)
    expect(result.issues).toEqual([])
    expect(result.nodes.find((node) => node.id === 'start')).toMatchObject({
      kind: 'trigger',
      trigger: v2.triggers.start,
    })
    expect(result.nodes.some((node) => node.id === '$input')).toBe(false)
  })
  it('rejects trigger/operator collisions, trigger subscribers and missing default triggers', () => {
    const result = buildAgentGraph({
      ...v2,
      triggers: { context: v2.triggers.start! },
      subscriptions: [
        { id: 'bad', from: 'context', subscriber: 'start', events: ['agent.start.v1'] },
      ],
    })
    expect(result.issues.map((issue) => issue.path)).toEqual([
      'triggers.context',
      'lifecycle.start.trigger',
      'subscriptions[0].subscriber',
    ])
  })
  it('allows independent manual trigger sources and custom operators', () => {
    const result = buildAgentGraph({
      ...v2,
      triggers: { ...v2.triggers, api: v2.triggers.start! },
      operators: { ...v2.operators, custom: { type: 'app.review', version: 7, config: {} } },
      subscriptions: [
        ...v2.subscriptions,
        { id: 'api-start', from: 'api', subscriber: 'custom', events: ['agent.start.v1'] },
      ],
    })
    expect(result.issues).toEqual([])
    expect(result.nodes.filter((node) => node.kind === 'trigger')).toHaveLength(2)
    expect(result.nodes.find((node) => node.id === 'custom')?.operator?.version).toBe(7)
  })
})
