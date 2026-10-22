import type { TodoItem } from '@xinjiyuan97/chat-core'
import { render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChatThemeProvider } from '../provider/ChatThemeProvider'
import {
  computeTaskGraphLayout,
  TASK_GRAPH_NODE_HEIGHT,
  TASK_GRAPH_NODE_WIDTH,
  TaskGraph,
  type TaskGraphPoint,
} from './TaskGraph'

const items: TodoItem[] = [
  { id: 'start', title: 'Start', status: 'completed' },
  { id: 'left', title: 'Left branch', status: 'in-progress', deps: ['start'] },
  { id: 'right', title: 'Right branch', status: 'blocked', deps: ['start'] },
  { id: 'merge', title: 'Merge', status: 'pending', deps: ['left', 'right'] },
  { id: 'later', title: 'Later', status: 'pending', deps: ['merge'] },
  { id: 'finish', title: 'Finish', status: 'failed', deps: ['later'] },
  { id: 'long', title: 'Long edge', status: 'pending', deps: ['start', 'cycle'] },
  { id: 'cycle', title: 'Cycle return', status: 'pending', deps: ['finish', 'merge'] },
  { id: 'loop', title: 'Loop edge', status: 'pending', deps: ['loop'] },
  { id: 'dangling', title: 'Dangling dependency', status: 'pending', deps: ['does-not-exist'] },
]

function orientation(a: TaskGraphPoint, b: TaskGraphPoint) {
  return Math.abs(a.x - b.x) > Math.abs(a.y - b.y) ? 'horizontal' : 'vertical'
}

function segments(points: TaskGraphPoint[]) {
  return points.slice(1).map((point, index) => ({ from: points[index]!, to: point }))
}

function intersects(
  segment: { from: TaskGraphPoint; to: TaskGraphPoint },
  node: { x: number; y: number; width: number; height: number },
) {
  const { from, to } = segment
  const horizontal = orientation(from, to) === 'horizontal'
  if (horizontal) {
    const y = from.y
    const left = Math.min(from.x, to.x)
    const right = Math.max(from.x, to.x)
    return y > node.y && y < node.y + node.height && right > node.x && left < node.x + node.width
  }
  const x = from.x
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  return x > node.x && x < node.x + node.width && bottom > node.y && top < node.y + node.height
}

describe('computeTaskGraphLayout', () => {
  it('is deterministic and places known dependencies in earlier columns', () => {
    const first = computeTaskGraphLayout(items)
    const second = computeTaskGraphLayout(items)
    expect(second).toEqual(first)
    const columns = new Map(first.nodes.map((node) => [node.item.id, node.column]))
    for (const edge of first.edges) {
      if (edge.kind !== 'back') expect(columns.get(edge.from)).toBeLessThan(columns.get(edge.to)!)
    }
    expect(first.nodes.find((node) => node.item.id === 'dangling')?.column).toBe(0)
  })

  it('keeps every edge segment outside every node rectangle', () => {
    const layout = computeTaskGraphLayout(items)
    const output: string[] = []
    for (const edge of layout.edges) {
      for (const segment of segments(edge.points)) {
        for (const node of layout.nodes) {
          if (intersects(segment, node)) {
            throw new Error(
              `edge ${edge.id} segment ${JSON.stringify(segment)} intersects ${node.item.id}`,
            )
          }
        }
      }
      output.push(`${edge.id}:${edge.kind}:${edge.points.length}points`)
    }
    console.info(`TaskGraph geometry: ${output.join(', ')}`)
    expect(output.length).toBe(layout.edges.length)
    expect(output.some((entry) => entry.includes(':long:'))).toBe(true)
    expect(output.some((entry) => entry.includes(':back:'))).toBe(true)
  })

  it('uses distinct lanes for parallel edges between the same columns', () => {
    const parallelItems: TodoItem[] = [
      { id: 'a', title: 'A', status: 'pending' },
      { id: 'b', title: 'B', status: 'pending', deps: ['a'] },
      { id: 'c', title: 'C', status: 'pending', deps: ['a'] },
      { id: 'd', title: 'D', status: 'pending', deps: ['a'] },
    ]
    const edges = computeTaskGraphLayout(parallelItems).edges
    expect(new Set(edges.map((edge) => edge.channelX)).size).toBe(3)
  })
})

describe('TaskGraph', () => {
  it('does not render clickable controls without callbacks and survives dangling deps', () => {
    const { container } = render(
      <ChatThemeProvider locale="en-US">
        <TaskGraph items={items} />
      </ChatThemeProvider>,
    )
    expect(within(container).getByRole('heading', { name: 'Task dependency graph' })).toBeVisible()
    const nodes = container.querySelectorAll('[data-cc-task-graph-node]')
    expect(nodes).toHaveLength(items.length)
    for (const node of nodes) expect(within(node as HTMLElement).queryByRole('button')).toBeNull()
    expect(container.querySelector('[data-cc-task-graph-node="dangling"]')).not.toBeNull()
    expect(TASK_GRAPH_NODE_WIDTH).toBeGreaterThan(0)
    expect(TASK_GRAPH_NODE_HEIGHT).toBeGreaterThan(0)
  })
})
