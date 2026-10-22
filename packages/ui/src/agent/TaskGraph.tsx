'use client'

import type { Agent, TodoItem } from '@xinjiyuan97/chat-core'
import { useMemo, type CSSProperties, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'
import { TaskActions, TaskOwner, TaskStatusIndicator, type TaskActionsProps } from './TaskBoard'

export const TASK_GRAPH_NODE_WIDTH = 188
export const TASK_GRAPH_NODE_HEIGHT = 92
const COLUMN_GAP = 112
const ROW_GAP = 28
const GRAPH_PADDING = 28
const LANE_GAP = 14
const ROUTE_PADDING = 30

export type TaskGraphPoint = { x: number; y: number }

export type TaskGraphNodeLayout = {
  item: TodoItem
  column: number
  row: number
  x: number
  y: number
  width: number
  height: number
}

export type TaskGraphEdgeLayout = {
  id: string
  from: string
  to: string
  points: TaskGraphPoint[]
  kind: 'forward' | 'long' | 'back'
  lane: number
  channelX?: number
  routeY?: number
}

export type TaskGraphLayout = {
  nodes: TaskGraphNodeLayout[]
  edges: TaskGraphEdgeLayout[]
  width: number
  height: number
  columns: number
}

function uniqueKnownDeps(item: TodoItem, known: Map<string, TodoItem>) {
  return (item.deps ?? []).filter(
    (dep, index, deps) => known.has(dep) && deps.indexOf(dep) === index,
  )
}

function getColumns(items: TodoItem[]) {
  const known = new Map(items.map((item) => [item.id, item]))
  const memo = new Map<string, number>()
  const visiting = new Set<string>()

  const depth = (id: string): number => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    const item = known.get(id)
    if (!item) return 0
    visiting.add(id)
    const result = uniqueKnownDeps(item, known).reduce(
      (max, dep) => Math.max(max, depth(dep) + 1),
      0,
    )
    visiting.delete(id)
    memo.set(id, result)
    return result
  }

  return { known, columns: new Map(items.map((item) => [item.id, depth(item.id)])) }
}

function roundedPolyline(points: TaskGraphPoint[], radius = 10) {
  if (points.length < 2) return ''
  const path: string[] = [`M ${points[0]!.x} ${points[0]!.y}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]!
    const incomingLength = Math.min(
      Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y),
      radius,
    )
    const outgoingLength = Math.min(
      Math.abs(next.x - current.x) + Math.abs(next.y - current.y),
      radius,
    )
    const incoming = {
      x: current.x + Math.sign(previous.x - current.x) * incomingLength,
      y: current.y + Math.sign(previous.y - current.y) * incomingLength,
    }
    const outgoing = {
      x: current.x + Math.sign(next.x - current.x) * outgoingLength,
      y: current.y + Math.sign(next.y - current.y) * outgoingLength,
    }
    path.push(
      `L ${incoming.x} ${incoming.y}`,
      `Q ${current.x} ${current.y} ${outgoing.x} ${outgoing.y}`,
    )
  }
  const last = points[points.length - 1]!
  path.push(`L ${last.x} ${last.y}`)
  return path.join(' ')
}

function edgeSort(a: TaskGraphEdgeLayout, b: TaskGraphEdgeLayout) {
  return a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.id.localeCompare(b.id)
}

export function computeTaskGraphLayout(items: TodoItem[]): TaskGraphLayout {
  const { known, columns } = getColumns(items)
  const maxColumn = Math.max(0, ...columns.values())
  const byColumn = Array.from({ length: maxColumn + 1 }, () => [] as TodoItem[])
  for (const item of items) byColumn[columns.get(item.id) ?? 0]!.push(item)

  const nodeById = new Map<string, TaskGraphNodeLayout>()
  let maxRows = 0
  byColumn.forEach((columnItems, column) => {
    maxRows = Math.max(maxRows, columnItems.length)
    columnItems.forEach((item, row) => {
      nodeById.set(item.id, {
        item,
        column,
        row,
        x: GRAPH_PADDING + column * (TASK_GRAPH_NODE_WIDTH + COLUMN_GAP),
        y: GRAPH_PADDING + row * (TASK_GRAPH_NODE_HEIGHT + ROW_GAP),
        width: TASK_GRAPH_NODE_WIDTH,
        height: TASK_GRAPH_NODE_HEIGHT,
      })
    })
  })

  const edges: TaskGraphEdgeLayout[] = []
  const pairCounts = new Map<string, number>()
  for (const item of items) {
    for (const dep of uniqueKnownDeps(item, known)) {
      const from = nodeById.get(dep)!
      const to = nodeById.get(item.id)!
      const key = `${from.column}:${to.column}`
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }
  }
  const pairSeen = new Map<string, number>()
  const backCount = items.reduce((count, item) => {
    return (
      count +
      uniqueKnownDeps(item, known).filter(
        (dep) => (columns.get(dep) ?? 0) >= (columns.get(item.id) ?? 0),
      ).length
    )
  }, 0)
  let backIndex = 0
  const bottom =
    GRAPH_PADDING + maxRows * TASK_GRAPH_NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP
  const longBase = bottom + ROUTE_PADDING
  const backBase = longBase + Math.max(1, items.length) * LANE_GAP + ROUTE_PADDING

  for (const item of items) {
    for (const dep of uniqueKnownDeps(item, known)) {
      const from = nodeById.get(dep)!
      const to = nodeById.get(item.id)!
      const fromColumn = from.column
      const toColumn = to.column
      const pairKey = `${fromColumn}:${toColumn}`
      const lane = pairSeen.get(pairKey) ?? 0
      pairSeen.set(pairKey, lane + 1)
      const isBack = fromColumn >= toColumn
      const isLong = !isBack && toColumn - fromColumn >= 3
      const sourceRight = { x: from.x + from.width, y: from.y + from.height / 2 }
      const targetLeft = { x: to.x, y: to.y + to.height / 2 }
      const sourceBottom = { x: from.x + from.width / 2, y: from.y + from.height }
      const targetBottom = { x: to.x + to.width / 2, y: to.y + to.height }
      let points: TaskGraphPoint[]
      let channelX: number | undefined
      let routeY: number | undefined
      let kind: TaskGraphEdgeLayout['kind'] = 'forward'

      if (isBack) {
        kind = 'back'
        routeY = backBase + backIndex * LANE_GAP
        backIndex += 1
        points = [
          sourceBottom,
          { x: sourceRight.x + 16, y: sourceBottom.y },
          { x: sourceRight.x + 16, y: routeY },
          { x: targetBottom.x + TASK_GRAPH_NODE_WIDTH / 2 + 16, y: routeY },
          { x: targetBottom.x + TASK_GRAPH_NODE_WIDTH / 2 + 16, y: targetBottom.y },
          targetBottom,
        ]
      } else if (isLong) {
        kind = 'long'
        routeY = longBase + lane * LANE_GAP
        points = [
          sourceBottom,
          { x: sourceRight.x + 16, y: sourceBottom.y },
          { x: sourceRight.x + 16, y: routeY },
          { x: targetBottom.x + TASK_GRAPH_NODE_WIDTH / 2 + 16, y: routeY },
          { x: targetBottom.x + TASK_GRAPH_NODE_WIDTH / 2 + 16, y: targetBottom.y },
          targetBottom,
        ]
      } else {
        const count = pairCounts.get(pairKey) ?? 1
        const center = (count - 1) / 2
        const offset = (lane - center) * LANE_GAP
        const left = Math.max(
          from.x + from.width + 18,
          from.x + from.width + COLUMN_GAP / 2 + offset,
        )
        channelX = left
        points = [
          sourceRight,
          { x: channelX, y: sourceRight.y },
          { x: channelX, y: targetLeft.y },
          targetLeft,
        ]
      }
      edges.push({
        id: `${dep}->${item.id}`,
        from: dep,
        to: item.id,
        points,
        kind,
        lane,
        channelX,
        routeY,
      })
    }
  }
  edges.sort(edgeSort)
  const width = GRAPH_PADDING * 2 + (maxColumn + 1) * TASK_GRAPH_NODE_WIDTH + maxColumn * COLUMN_GAP
  const height =
    backCount > 0 ? backBase + backCount * LANE_GAP + GRAPH_PADDING : bottom + GRAPH_PADDING
  return { nodes: [...nodeById.values()], edges, width, height, columns: maxColumn + 1 }
}

export function taskGraphEdgePath(edge: TaskGraphEdgeLayout) {
  if (edge.kind !== 'back') return roundedPolyline(edge.points)
  const source = edge.points[0]!
  const sourceExit = edge.points[1]!
  const trunkStart = edge.points[2]!
  const trunkEnd = edge.points[3]!
  const targetEntry = edge.points[4]!
  const target = edge.points[5]!
  const controlOffset = Math.max(18, Math.abs(trunkEnd.x - trunkStart.x) / 4)
  return [
    `M ${source.x} ${source.y}`,
    `L ${sourceExit.x} ${sourceExit.y}`,
    `L ${trunkStart.x} ${trunkStart.y}`,
    `C ${trunkStart.x + controlOffset} ${trunkStart.y + 18}, ${trunkEnd.x - controlOffset} ${trunkEnd.y + 18}, ${trunkEnd.x} ${trunkEnd.y}`,
    `L ${targetEntry.x} ${targetEntry.y}`,
    `L ${target.x} ${target.y}`,
  ].join(' ')
}

export type TaskGraphProps = {
  items: TodoItem[]
  agents?: Agent[]
  onOpen?: (item: TodoItem) => void
  renderNode?: (item: TodoItem) => ReactNode
  onReassign?: TaskActionsProps['onReassign']
  onRetry?: TaskActionsProps['onRetry']
  onCancel?: TaskActionsProps['onCancel']
  onPriority?: TaskActionsProps['onPriority']
  className?: string
}

function estimateTitleWidth(title: string) {
  return [...title].reduce((width, char) => width + (char.charCodeAt(0) > 0xff ? 1 : 0.6), 0)
}

function compactTitle(title: string) {
  const max = 24
  if (estimateTitleWidth(title) <= max) return title
  let width = 0
  let result = ''
  for (const char of title) {
    const next = char.charCodeAt(0) > 0xff ? 1 : 0.6
    if (width + next + 1 > max) break
    result += char
    width += next
  }
  return `${result}…`
}

export function TaskGraph({
  items,
  agents,
  onOpen,
  renderNode,
  onReassign,
  onRetry,
  onCancel,
  onPriority,
  className,
}: TaskGraphProps) {
  const locale = useLocale()
  const layout = useMemo(() => computeTaskGraphLayout(items), [items])
  const agentsById = useMemo(() => new Map(agents?.map((agent) => [agent.id, agent])), [agents])
  const hasActions = Boolean(onReassign || onRetry || onCancel || onPriority)

  return (
    <section
      className={cn(
        'min-w-0 max-w-full rounded-cc-md border border-cc-border bg-cc-surface p-3',
        className,
      )}
      data-cc-task-graph
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-cc-border pb-3">
        <h2 className="text-cc-sm font-semibold text-cc-fg">{locale.taskGraph}</h2>
        <span className="text-cc-xs text-cc-faint">{locale.taskGraphDependencyHint}</span>
      </div>
      <div className="max-w-full overflow-auto" data-cc-task-graph-canvas>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            height={layout.height}
            width={layout.width}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            data-cc-task-graph-edges
          >
            <defs>
              <marker
                id="cc-task-graph-arrow"
                markerHeight="7"
                markerWidth="7"
                orient="auto"
                refX="6"
                refY="3.5"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
              </marker>
            </defs>
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={taskGraphEdgePath(edge)}
                fill="none"
                markerEnd="url(#cc-task-graph-arrow)"
                opacity="0.72"
                stroke="currentColor"
                strokeWidth="1.8"
                data-cc-task-graph-edge={edge.id}
                data-cc-task-graph-edge-kind={edge.kind}
                data-cc-task-graph-lane={edge.lane}
              />
            ))}
          </svg>
          {layout.nodes.map((node) => {
            const owner = node.item.owner
            const knownAgent = owner && agentsById.get(owner.agentId)
            const displayItem =
              owner && knownAgent && !owner.name
                ? { ...node.item, owner: { ...owner, name: knownAgent.name } }
                : node.item
            const style = {
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
            } satisfies CSSProperties
            return (
              <article
                key={node.item.id}
                className="absolute flex flex-col overflow-hidden rounded-cc-sm border border-cc-border bg-cc-surface px-2.5 py-2 shadow-cc-card"
                style={style}
                data-cc-task-graph-node={node.item.id}
                data-cc-task-graph-column={node.column}
                data-cc-task-graph-row={node.row}
              >
                {renderNode ? (
                  renderNode(displayItem)
                ) : (
                  <>
                    <div className="flex min-w-0 items-start gap-2">
                      <TaskStatusIndicator item={displayItem} />
                      <div className="min-w-0 flex-1">
                        {onOpen ? (
                          <button
                            type="button"
                            className="block max-w-full truncate text-left text-cc-sm font-medium text-cc-fg hover:underline"
                            onClick={() => onOpen(node.item)}
                          >
                            {compactTitle(displayItem.title)}
                          </button>
                        ) : (
                          <h3
                            className="truncate text-cc-sm font-medium text-cc-fg"
                            title={displayItem.title}
                          >
                            {compactTitle(displayItem.title)}
                          </h3>
                        )}
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-cc-xs text-cc-faint">
                          <span className="truncate">{displayItem.status}</span>
                          {displayItem.attempt ? <span>{displayItem.attempt}×</span> : null}
                        </div>
                        <TaskOwner item={displayItem} />
                      </div>
                    </div>
                    {hasActions ? (
                      <TaskActions
                        item={node.item}
                        onReassign={onReassign}
                        onRetry={onRetry}
                        onCancel={onCancel}
                        onPriority={onPriority}
                      />
                    ) : null}
                  </>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
