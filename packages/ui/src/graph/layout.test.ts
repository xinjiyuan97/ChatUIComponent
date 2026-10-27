import { describe, expect, it } from 'vitest'
import type { AgentGraphTopology } from '@xinjiyuan97/chat-core'
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH, layoutAgentGraph } from './layout'

const graph: AgentGraphTopology = {
  nodes: ['a', 'b', 'c'].map((id) => ({ id, kind: 'operator' })),
  connections: [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'a'],
    ['a', 'a'],
  ].map(([source, target], index) => ({
    id: String(index),
    source: source!,
    target: target!,
    kind: 'subscription',
    events: ['event.v1'],
  })),
  issues: [],
}
describe('layoutAgentGraph', () => {
  it.each(['LR', 'TB'] as const)(
    'lays out cycles and self-loops without dropping or overlapping nodes (%s)',
    (direction) => {
      const result = layoutAgentGraph(graph, direction)
      expect(Object.keys(result)).toEqual(['a', 'b', 'c'])
      const positions = Object.values(result)
      positions.forEach((position) => {
        expect(Number.isFinite(position.x) && Number.isFinite(position.y)).toBe(true)
      })
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(
            Math.abs(positions[i]!.x - positions[j]!.x) >= GRAPH_NODE_WIDTH ||
              Math.abs(positions[i]!.y - positions[j]!.y) >= GRAPH_NODE_HEIGHT,
          ).toBe(true)
        }
      }
      expect(result).toEqual(layoutAgentGraph(graph, direction))
    },
  )
  it('does not attempt layout when references are invalid', () => {
    expect(
      layoutAgentGraph(
        { ...graph, issues: [{ path: 'subscriptions[0].from', message: 'Unknown event source' }] },
        'LR',
      ),
    ).toEqual({})
  })
})
