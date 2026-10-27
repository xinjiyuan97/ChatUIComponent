import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import type { AgentGraphConnection } from '@xinjiyuan97/chat-core'

export type GraphFlowEdge = Edge<
  {
    connection: AgentGraphConnection
    showLabel: boolean
    lane: number
    returnEdge: boolean
    terminalLabel: string
    onInspect: () => void
  },
  'subscription'
>

export function GraphEdge(props: EdgeProps<GraphFlowEdge>) {
  const {
    id,
    data,
    selected,
    markerEnd,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props
  const lane = data?.lane ?? 0
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
    offset: 34 + lane * 28,
    ...(data?.returnEdge
      ? sourcePosition === 'left'
        ? { centerX: Math.min(sourceX, targetX) - 56 - lane * 32 }
        : sourcePosition === 'right'
          ? { centerX: Math.max(sourceX, targetX) + 56 + lane * 32 }
          : { centerY: Math.min(sourceY, targetY) - 56 - lane * 32 }
      : sourcePosition === 'right'
        ? { centerX: (sourceX + targetX) / 2 + lane * 28 }
        : { centerY: (sourceY + targetY) / 2 + lane * 28 }),
  })
  const events = data?.connection.events ?? []
  const label = data?.connection.kind === 'terminal' ? data.terminalLabel : events[0]
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{
          stroke: selected ? 'var(--color-cc-accent)' : 'var(--color-cc-border-strong)',
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: data?.connection.kind === 'terminal' ? '5 5' : undefined,
        }}
      />
      {data?.showLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="cc-graph-edge-label nodrag nopan"
            data-selected={selected}
            style={{
              maxWidth:
                !data.returnEdge && sourcePosition === 'right'
                  ? Math.max(64, Math.abs(targetX - sourceX) - 12)
                  : 240,
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (data.returnEdge ? 0 : lane * 26)}px)`,
            }}
            title={events.join('\n')}
            aria-label={events.join(', ')}
            onClick={(event) => {
              event.stopPropagation()
              data.onInspect()
            }}
          >
            {label}
            {events.length > 1 && data.connection.kind !== 'terminal' && (
              <span> +{events.length - 1}</span>
            )}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
