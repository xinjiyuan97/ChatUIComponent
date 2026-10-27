import { graphlib, layout } from '@dagrejs/dagre'
import type { AgentGraphTopology } from '@xinjiyuan97/chat-core'

export type AgentGraphDirection = 'LR' | 'TB'
export type AgentGraphPosition = { x: number; y: number }
export type AgentGraphPositions = Readonly<Record<string, AgentGraphPosition>>

export const GRAPH_NODE_WIDTH = 224
export const GRAPH_NODE_HEIGHT = 100

/**
 * Rank strongly connected components as groups, then fold each loop into a short snake.
 * A tool loop therefore uses the canvas height instead of becoming a six-column strip.
 * Grouping affects coordinates only: every subscription still has its original endpoints.
 */
export function layoutAgentGraph(
  topology: AgentGraphTopology,
  direction: AgentGraphDirection,
): Record<string, AgentGraphPosition> {
  if (topology.issues.length) return {}
  const graph = new graphlib.Graph()
  topology.nodes.forEach((node) => graph.setNode(node.id))
  topology.connections.forEach((edge) => graph.setEdge(edge.source, edge.target))
  const components = graphlib.alg.tarjan(graph)
  const componentOf = new Map<string, number>()
  components.forEach((ids, index) => ids.forEach((id) => componentOf.set(id, index)))
  const groups = new graphlib.Graph()
  groups.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80, marginx: 48, marginy: 64 })
  groups.setDefaultEdgeLabel(() => ({}))
  const localPositions: Record<string, AgentGraphPosition> = {}
  components.forEach((ids, index) => {
    const members = new Set(ids)
    const order = topology.nodes.filter((node) => members.has(node.id)).map((node) => node.id)
    let current =
      topology.connections.find((edge) => members.has(edge.target) && !members.has(edge.source))
        ?.target ?? order[0]!
    const visited = new Set<string>()
    const ordered: string[] = []
    while (ordered.length < ids.length) {
      ordered.push(current)
      visited.add(current)
      current =
        topology.connections.find(
          (edge) =>
            edge.source === current && members.has(edge.target) && !visited.has(edge.target),
        )?.target ?? order.find((id) => !visited.has(id))!
    }
    const columns = Math.ceil(Math.sqrt(ids.length))
    ordered.forEach((id, offset) => {
      const row = Math.floor(offset / columns)
      const column = row % 2 === 0 ? offset % columns : columns - 1 - (offset % columns)
      localPositions[id] =
        direction === 'LR'
          ? { x: column * (GRAPH_NODE_WIDTH + 100), y: row * (GRAPH_NODE_HEIGHT + 100) }
          : { x: row * (GRAPH_NODE_WIDTH + 100), y: column * (GRAPH_NODE_HEIGHT + 100) }
    })
    groups.setNode(String(index), {
      width: Math.max(...ids.map((id) => localPositions[id]!.x)) + GRAPH_NODE_WIDTH,
      height: Math.max(...ids.map((id) => localPositions[id]!.y)) + GRAPH_NODE_HEIGHT,
    })
  })
  topology.connections.forEach((edge) => {
    const source = componentOf.get(edge.source)!
    const target = componentOf.get(edge.target)!
    if (source !== target) groups.setEdge(String(source), String(target))
  })
  layout(groups)
  const positions: Record<string, AgentGraphPosition> = Object.fromEntries(
    topology.nodes.map(({ id }) => {
      const group = groups.node(String(componentOf.get(id)))
      const local = localPositions[id]!
      return [
        id,
        { x: group.x - group.width / 2 + local.x, y: group.y - group.height / 2 + local.y },
      ]
    }),
  )
  // Host inputs to an existing Run sit outside the operator loop, near their consumers.
  const hostSources = topology.nodes.filter(
    (node) => node.kind === 'external' || node.kind === 'engine',
  )
  const businessPositions = topology.nodes
    .filter((node) => node.kind === 'operator')
    .map((node) => positions[node.id]!)
  hostSources.forEach((node, index) => {
    const targets = topology.connections
      .filter((edge) => edge.source === node.id)
      .map((edge) => positions[edge.target]!)
    if (!targets.length || !businessPositions.length) return
    positions[node.id] =
      direction === 'LR'
        ? {
            x: targets.reduce((sum, point) => sum + point.x, 0) / targets.length,
            y:
              Math.max(...businessPositions.map((point) => point.y)) +
              GRAPH_NODE_HEIGHT +
              120 +
              index * 180,
          }
        : {
            x:
              Math.max(...businessPositions.map((point) => point.x)) +
              GRAPH_NODE_WIDTH +
              120 +
              index * 324,
            y: targets.reduce((sum, point) => sum + point.y, 0) / targets.length,
          }
  })
  return positions
}
