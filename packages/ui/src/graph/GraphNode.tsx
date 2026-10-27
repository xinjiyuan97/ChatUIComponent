import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import type { AgentGraphNode } from '@xinjiyuan97/chat-core'

import {
  AgentIcon,
  CodeIcon,
  DiagramIcon,
  FileIcon,
  PlayIcon,
  ShieldIcon,
  StopIcon,
  ToolIcon,
} from '../icons'
import type { AgentGraphLabels } from './locale'
import type { AgentGraphDirection } from './layout'

export type AgentGraphNodeStatus =
  'idle' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'
export type GraphFlowNode = Node<
  {
    node: AgentGraphNode
    direction: AgentGraphDirection
    labels: AgentGraphLabels
    status?: AgentGraphNodeStatus
    onConfigure: () => void
  },
  'operator'
>

const roles = {
  'agent.context': { title: 'Context', description: 'context', Icon: FileIcon },
  'agent.model': { title: 'Model', description: 'model', Icon: AgentIcon },
  'agent.gate': { title: 'Gate', description: 'gate', Icon: DiagramIcon },
  'agent.tool_policy': { title: 'ToolPolicy', description: 'policy', Icon: ShieldIcon },
  'agent.tools': { title: 'Tools', description: 'tools', Icon: ToolIcon },
  'agent.wait': { title: 'Wait', description: 'wait', Icon: StopIcon },
} as const

export function GraphNode({ data, selected }: NodeProps<GraphFlowNode>) {
  const { node, labels, status } = data
  const role = node.operator ? roles[node.operator.type as keyof typeof roles] : undefined
  const Icon =
    role?.Icon ??
    (node.kind === 'input' || node.kind === 'trigger'
      ? PlayIcon
      : node.kind === 'terminal'
        ? StopIcon
        : CodeIcon)
  const title = node.kind === 'operator' ? (role?.title ?? labels.custom) : labels[node.kind]
  return (
    <div
      className="cc-graph-node"
      data-selected={selected}
      data-kind={node.kind}
      data-status={status}
    >
      <div className="cc-graph-node-heading">
        <span className="cc-graph-node-icon">
          <Icon size={17} />
        </span>
        <strong>{title}</strong>
        {node.operator && <span className="cc-graph-version">v{node.operator.version}</span>}
      </div>
      <div className="cc-graph-node-id" title={node.id}>
        {node.id}
      </div>
      <div className="cc-graph-node-caption">
        <span className="cc-graph-node-description">
          {status ? (
            <span className="cc-graph-status">
              <i />
              {labels[status]}
            </span>
          ) : node.kind === 'operator' ? (
            labels[role?.description ?? 'custom']
          ) : node.kind === 'terminal' ? (
            labels.terminalHint
          ) : (
            labels.sourceHint
          )}
        </span>
        {(node.operator || node.trigger) && (
          <button
            type="button"
            className="cc-graph-config-button nodrag nopan"
            aria-label={`${labels.configuration} ${node.id}`}
            aria-haspopup="dialog"
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onConfigure()
            }}
          >
            {labels.configuration}
          </button>
        )}
      </div>
      {/* Distinct return ports keep cycles visible without changing the subscription. */}
      {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
        <span key={side}>
          <Handle
            id={`in-${side}`}
            type="target"
            position={
              Position[
                side === 'left'
                  ? 'Left'
                  : side === 'right'
                    ? 'Right'
                    : side === 'top'
                      ? 'Top'
                      : 'Bottom'
              ]
            }
            isConnectable={false}
          />
          <Handle
            id={`out-${side}`}
            type="source"
            position={
              Position[
                side === 'left'
                  ? 'Left'
                  : side === 'right'
                    ? 'Right'
                    : side === 'top'
                      ? 'Top'
                      : 'Bottom'
              ]
            }
            isConnectable={false}
          />
        </span>
      ))}
    </div>
  )
}
