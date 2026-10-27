'use client'

import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type NodeChange,
} from '@xyflow/react'
import {
  buildAgentGraph,
  type AgentGraphConnection,
  type AgentGraphDefinition,
  type AgentGraphNode,
} from '@xinjiyuan97/chat-core'

import { CloseIcon, DiagramIcon, FitIcon, RegenerateIcon, ZoomInIcon, ZoomOutIcon } from '../icons'
import { cn } from '../lib/cn'
import { JsonViewer } from '../parts/JsonViewer'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { GraphNode, type AgentGraphNodeStatus, type GraphFlowNode } from './GraphNode'
import { GraphEdge, type GraphFlowEdge } from './GraphEdge'
import { GraphConfigDialog, type AgentGraphConfigSave } from './GraphConfigDialog'
import { graphLocales, type AgentGraphLabels } from './locale'
import {
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  layoutAgentGraph,
  type AgentGraphDirection,
  type AgentGraphPositions,
} from './layout'

export type AgentGraphSelection =
  { kind: 'node'; node: AgentGraphNode } | { kind: 'connection'; connection: AgentGraphConnection }
export type AgentGraphProps = {
  definition: AgentGraphDefinition
  /** Display-only snapshots supplied by the host; this component does not execute a graph. */
  nodeStatuses?: Readonly<Record<string, AgentGraphNodeStatus>>
  defaultDirection?: AgentGraphDirection
  defaultPositions?: AgentGraphPositions
  onPositionsChange?: (positions: AgentGraphPositions) => void
  onSelectionChange?: (selection: AgentGraphSelection | null) => void
  /** Enable editing. Resolve after persistence and update definition in the host; reject to show an error. */
  onConfigSave?: AgentGraphConfigSave
  showInspector?: boolean
  showMinimap?: boolean
  showEventLabels?: boolean
  /** Overrides the provider's Chinese/English labels, including custom translations. */
  labels?: Partial<AgentGraphLabels>
  className?: string
  style?: CSSProperties
}

const nodeTypes = { operator: GraphNode }
const edgeTypes = { subscription: GraphEdge }

/**
 * A read-only static graph on an infinite canvas. Dragging changes presentation only.
 * Import `@xinjiyuan97/chat-ui/graph.css` in addition to the library theme stylesheet.
 */
export function AgentGraph(props: AgentGraphProps) {
  // Status/config updates preserve the viewport. Structural changes start a new view.
  const identity = JSON.stringify(props.definition, (key, value: unknown) =>
    key === 'config' ? undefined : value,
  )
  return (
    <ReactFlowProvider key={identity}>
      <AgentGraphCanvas {...props} />
    </ReactFlowProvider>
  )
}

function AgentGraphCanvas({
  definition,
  nodeStatuses,
  defaultDirection = 'LR',
  defaultPositions,
  onPositionsChange,
  onSelectionChange,
  onConfigSave,
  showInspector = true,
  showMinimap = true,
  showEventLabels = true,
  labels: labelOverrides,
  className,
  style,
}: AgentGraphProps) {
  const locale = useLocale()
  const labels = useMemo(
    () => ({
      ...graphLocales[locale.code.startsWith('zh') ? 'zh-CN' : 'en-US'],
      ...labelOverrides,
    }),
    [locale.code, labelOverrides],
  )
  const topology = useMemo(() => buildAgentGraph(definition), [definition])
  const [direction, setDirection] = useState(defaultDirection)
  const [positions, setPositions] = useState<AgentGraphPositions>(defaultPositions ?? {})
  const [configNode, setConfigNode] = useState<AgentGraphNode | null>(null)
  const [selection, setSelection] = useState<AgentGraphSelection | null>(null)
  const [labelsVisible, setLabelsVisible] = useState(showEventLabels)
  const [minimapVisible, setMinimapVisible] = useState(showMinimap)
  const layout = useMemo(() => layoutAgentGraph(topology, direction), [topology, direction])
  const { fitView, zoomIn, zoomOut } = useReactFlow<GraphFlowNode, GraphFlowEdge>()
  const { zoom } = useViewport()
  const select = useCallback(
    (value: AgentGraphSelection | null) => {
      setSelection(value)
      onSelectionChange?.(value)
    },
    [onSelectionChange],
  )
  const actualPositions = useMemo(() => ({ ...layout, ...positions }), [layout, positions])
  const nodes: GraphFlowNode[] = topology.nodes.map((node) => ({
    id: node.id,
    type: 'operator',
    position: actualPositions[node.id] ?? { x: 0, y: 0 },
    data: {
      node,
      direction,
      labels,
      status: nodeStatuses?.[node.id],
      onConfigure: () => setConfigNode(node),
    },
    width: GRAPH_NODE_WIDTH,
    height: GRAPH_NODE_HEIGHT,
    measured: { width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT },
    selected: selection?.kind === 'node' && selection.node.id === node.id,
    ariaLabel: `${node.id}, ${node.operator?.type ?? labels[node.kind as Exclude<AgentGraphNode['kind'], 'operator'>]}`,
  }))
  const lanes = new Map<string, number>()
  const edges: GraphFlowEdge[] = topology.connections.map((connection) => {
    const source = actualPositions[connection.source] ?? { x: 0, y: 0 }
    const target = actualPositions[connection.target] ?? { x: 0, y: 0 }
    const sameColumn = Math.abs(target.x - source.x) < 1
    const sameRow = Math.abs(target.y - source.y) < 1
    const self = connection.source === connection.target
    const returning =
      direction === 'LR'
        ? target.x < source.x || (sameColumn && target.y < source.y)
        : target.y < source.y || (sameRow && target.x < source.x)
    const laneKey = returning
      ? `return:${connection.target}`
      : JSON.stringify([connection.source, connection.target])
    const lane = lanes.get(laneKey) ?? 0
    lanes.set(laneKey, lane + 1)
    const terminal = connection.kind === 'terminal'
    const sourceSide = terminal
      ? direction === 'LR'
        ? 'top'
        : 'left'
      : self
        ? 'right'
        : returning
          ? sameColumn || direction === 'TB'
            ? 'right'
            : 'top'
          : sameColumn
            ? 'bottom'
            : sameRow
              ? 'right'
              : direction === 'LR'
                ? 'right'
                : 'bottom'
    const targetSide = terminal
      ? direction === 'LR'
        ? 'top'
        : 'left'
      : self
        ? 'top'
        : returning
          ? sameColumn || direction === 'TB'
            ? 'right'
            : 'top'
          : sameColumn
            ? 'top'
            : sameRow
              ? 'left'
              : direction === 'LR'
                ? 'left'
                : 'top'
    return {
      id: connection.id,
      type: 'subscription',
      source: connection.source,
      target: connection.target,
      sourceHandle: `out-${sourceSide}`,
      targetHandle: `in-${targetSide}`,
      selected: selection?.kind === 'connection' && selection.connection.id === connection.id,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--color-cc-border-strong)',
        width: 16,
        height: 16,
      },
      ariaLabel: `${connection.source} → ${connection.target}: ${connection.events.join(', ')}`,
      data: {
        connection,
        showLabel: labelsVisible,
        lane: terminal ? 3 : lane,
        returnEdge: returning || terminal,
        terminalLabel: labels.terminal,
        onInspect: () => select({ kind: 'connection', connection }),
      },
    }
  })
  const changeNodes = useCallback(
    (changes: NodeChange<GraphFlowNode>[]) => {
      setPositions((previous) => {
        const next = { ...previous }
        for (const change of changes) {
          if (change.type === 'position' && change.position) next[change.id] = change.position
        }
        return next
      })
      for (const change of changes) {
        if (change.type === 'select' && change.selected) {
          const node = topology.nodes.find((item) => item.id === change.id)
          if (node) select({ kind: 'node', node })
        }
      }
    },
    [select, topology.nodes],
  )
  const relayout = (nextDirection: AgentGraphDirection) => {
    setDirection(nextDirection)
    setPositions({})
    const next = layoutAgentGraph(topology, nextDirection)
    onPositionsChange?.(next)
    // Fit against the new coordinates directly instead of racing the React render.
    void fitView({
      nodes: topology.nodes.map((node) => ({
        id: node.id,
        position: next[node.id]!,
        width: GRAPH_NODE_WIDTH,
        height: GRAPH_NODE_HEIGHT,
      })),
      padding: 0.18,
      maxZoom: 1,
    })
  }
  const empty = Object.keys(definition.operators).length === 0
  const invalid = topology.issues.length > 0

  return (
    <section
      className={cn('cc-graph h-[600px]', className)}
      style={style}
      aria-label={`${labels.title}: ${definition.name}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) select(null)
      }}
    >
      <header className="cc-graph-header">
        <DiagramIcon size={19} />
        <div className="cc-graph-title">
          <strong title={definition.name}>{definition.name || labels.title}</strong>
          <span>
            {Object.keys(definition.operators).length} {labels.operators} ·{' '}
            {definition.subscriptions.length} {labels.subscriptions}
          </span>
        </div>
        <span className="cc-graph-badge">
          {labels.static} v{definition.schema_version}
        </span>
      </header>
      <div className="cc-graph-body">
        {empty || invalid ? (
          <div className="cc-graph-empty" role={empty ? 'status' : 'alert'}>
            <DiagramIcon size={32} />
            <strong>{empty ? labels.empty : labels.invalid}</strong>
            <p>{empty ? labels.emptyHint : labels.invalidHint}</p>
            {!empty && (
              <ul>
                {topology.issues.map((issue, index) => (
                  <li key={index}>
                    <code>{issue.path}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="cc-graph-canvas">
              <ReactFlow<GraphFlowNode, GraphFlowEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={changeNodes}
                onEdgesChange={(changes) => {
                  const selected = changes.find(
                    (change) => change.type === 'select' && change.selected,
                  )
                  const connection =
                    selected?.type === 'select' &&
                    topology.connections.find((edge) => edge.id === selected.id)
                  if (connection) select({ kind: 'connection', connection })
                }}
                onPaneClick={() => select(null)}
                onNodeDragStop={(_, node) =>
                  onPositionsChange?.({ ...actualPositions, [node.id]: node.position })
                }
                nodesConnectable={false}
                edgesReconnectable={false}
                deleteKeyCode={null}
                minZoom={0.15}
                maxZoom={2}
                fitView
                fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
                attributionPosition="bottom-right"
                ariaLabelConfig={{
                  'node.a11yDescription.default': labels.select,
                  'edge.a11yDescription.default': labels.select,
                }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="var(--color-cc-border-strong)"
                />
                {minimapVisible && (
                  <MiniMap
                    pannable
                    zoomable
                    position="bottom-right"
                    ariaLabel={labels.minimap}
                    nodeColor="var(--color-cc-subtle)"
                    nodeStrokeColor="var(--color-cc-border-strong)"
                    nodeBorderRadius={5}
                    maskColor="var(--color-cc-canvas)"
                    maskStrokeColor="var(--color-cc-border-strong)"
                  />
                )}
              </ReactFlow>
              <div className="cc-graph-controls" role="toolbar" aria-label={labels.title}>
                <IconButton
                  label={labels.zoomOut}
                  icon={<ZoomOutIcon />}
                  onClick={() => void zoomOut()}
                  className="size-9"
                />
                <span className="cc-graph-zoom" aria-live="polite">
                  {Math.round(zoom * 100)}%
                </span>
                <IconButton
                  label={labels.zoomIn}
                  icon={<ZoomInIcon />}
                  onClick={() => void zoomIn()}
                  className="size-9"
                />
                <span className="cc-graph-divider" />
                <IconButton
                  label={labels.fit}
                  icon={<FitIcon />}
                  onClick={() => void fitView({ padding: 0.18, maxZoom: 1 })}
                  className="size-9"
                />
                <IconButton
                  label={labels.reset}
                  icon={<RegenerateIcon />}
                  onClick={() => relayout(direction)}
                  className="size-9"
                />
              </div>
              <div className="cc-graph-options">
                <select
                  aria-label={direction === 'LR' ? labels.horizontal : labels.vertical}
                  value={direction}
                  onChange={(event) => relayout(event.target.value as AgentGraphDirection)}
                >
                  <option value="LR">{labels.horizontal}</option>
                  <option value="TB">{labels.vertical}</option>
                </select>
                <button
                  type="button"
                  aria-pressed={labelsVisible}
                  onClick={() => setLabelsVisible((value) => !value)}
                >
                  {labels.labels}
                </button>
                <button
                  type="button"
                  aria-pressed={minimapVisible}
                  onClick={() => setMinimapVisible((value) => !value)}
                >
                  {labels.minimap}
                </button>
              </div>
            </div>
            {showInspector && selection && (
              <aside className="cc-graph-inspector" aria-label={labels.details}>
                <div className="cc-graph-inspector-heading">
                  <strong>{labels.details}</strong>
                  <IconButton
                    label={labels.close}
                    icon={<CloseIcon />}
                    onClick={() => select(null)}
                  />
                </div>
                <GraphInspector
                  selection={
                    selection.kind === 'node'
                      ? {
                          ...selection,
                          node:
                            topology.nodes.find((node) => node.id === selection.node.id) ??
                            selection.node,
                        }
                      : selection
                  }
                  definition={definition}
                  labels={labels}
                  select={select}
                  connections={topology.connections}
                  onConfigure={setConfigNode}
                />
              </aside>
            )}
          </>
        )}
      </div>
      {configNode && (
        <GraphConfigDialog
          node={configNode}
          labels={labels}
          onSave={onConfigSave}
          onClose={() => setConfigNode(null)}
        />
      )}
      <footer className="cc-graph-footer">
        <span>{labels.hint}</span>
        <span>
          {definition.limits.timeout_ms / 1000}s ·{' '}
          {definition.limits.max_deliveries.toLocaleString(locale.code)} {labels.deliveries}
        </span>
      </footer>
    </section>
  )
}

function GraphInspector({
  selection,
  definition,
  labels,
  connections,
  select,
  onConfigure,
}: {
  selection: AgentGraphSelection
  definition: AgentGraphDefinition
  labels: AgentGraphLabels
  connections: AgentGraphConnection[]
  select: (selection: AgentGraphSelection) => void
  onConfigure: (node: AgentGraphNode) => void
}) {
  if (selection.kind === 'connection') {
    const { connection } = selection
    return (
      <div className="cc-graph-detail-content">
        <code className="cc-graph-detail-title">
          {connection.subscription?.id ?? labels.lifecycle}
        </code>
        <p className="cc-graph-route">
          {connection.source} → {connection.target}
        </p>
        {connection.kind === 'terminal' && <p>{labels.observer}</p>}
        <h4>{labels.events}</h4>
        <ul className="cc-graph-event-list">
          {connection.events.map((event) => (
            <li key={event}>
              <code>{event}</code>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  const { node } = selection
  const incoming = connections.filter((edge) => edge.target === node.id)
  const outgoing = connections.filter((edge) => edge.source === node.id)
  return (
    <div className="cc-graph-detail-content">
      <code className="cc-graph-detail-title">{node.id}</code>
      {node.operator && (
        <p>
          {node.operator.type}@{node.operator.version}
        </p>
      )}
      {node.kind === 'terminal' && <p>{labels.observer}</p>}
      {node.operator && (
        <>
          <h4>
            <button
              type="button"
              className="cc-graph-config-button"
              aria-haspopup="dialog"
              onClick={() => onConfigure(node)}
            >
              {labels.configuration} ↗
            </button>
          </h4>
          <JsonViewer value={node.operator.config} defaultExpandedDepth={2} />
        </>
      )}
      {node.kind === 'input' && definition.schema_version === 1 && (
        <>
          <h4>{labels.events}</h4>
          <code>{definition.lifecycle.start.event}</code>
        </>
      )}
      {node.trigger && (
        <>
          <h4>
            <button
              type="button"
              className="cc-graph-config-button"
              aria-haspopup="dialog"
              onClick={() => onConfigure(node)}
            >
              {labels.configuration} ↗
            </button>
          </h4>
          <JsonViewer value={node.trigger} />
        </>
      )}
      {node.kind === 'terminal' && (
        <>
          <h4>{labels.lifecycle}</h4>
          <JsonViewer value={definition.lifecycle.terminal} />
        </>
      )}
      {(
        [
          [labels.incoming, incoming],
          [labels.outgoing, outgoing],
        ] as const
      ).map(
        ([title, edges]) =>
          edges.length > 0 && (
            <div key={title}>
              <h4>
                {title} <span>{edges.length}</span>
              </h4>
              <div className="cc-graph-detail-links">
                {edges.map((edge) => (
                  <button
                    type="button"
                    key={edge.id}
                    onClick={() => select({ kind: 'connection', connection: edge })}
                  >
                    <span>
                      {edge.source} → {edge.target}
                    </span>
                    <code>{edge.events.join('\n')}</code>
                  </button>
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  )
}

export type { AgentGraphLabels } from './locale'
export type { AgentGraphNodeStatus } from './GraphNode'
export type { AgentGraphDirection, AgentGraphPosition, AgentGraphPositions } from './layout'

export type { AgentGraphConfigChange, AgentGraphConfigSave } from './GraphConfigDialog'
