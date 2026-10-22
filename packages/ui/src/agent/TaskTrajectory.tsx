'use client'

import type { Agent, TodoItem } from '@xinjiyuan97/chat-core'
import { useState } from 'react'

import { AgentBadge, AgentAvatar } from './AgentIdentity'
import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'

export type TaskTrajectoryKind =
  | 'created'
  | 'assigned'
  | 'started'
  | 'tool'
  | 'handoff'
  | 'blocked'
  | 'retry'
  | 'completed'
  | 'failed'

export type TaskTrajectoryStep = {
  id: string
  at?: string | number | Date
  agentId?: string
  kind: TaskTrajectoryKind
  title?: string
  detail?: string
  status?: string
}

export type TaskTrajectoryProps = {
  item: TodoItem
  steps: TaskTrajectoryStep[]
  agents?: Agent[]
  currentStepId?: string
  onStepToggle?: (step: TaskTrajectoryStep, expanded: boolean) => void
  onRetry?: (item: TodoItem, step: TaskTrajectoryStep) => void
  className?: string
}

function stepTone(kind: TaskTrajectoryKind): string {
  if (kind === 'blocked') return 'border-cc-warning bg-cc-warning-subtle/30 text-cc-warning'
  if (kind === 'failed') return 'border-cc-danger bg-cc-danger-subtle/30 text-cc-danger'
  if (kind === 'completed') return 'border-cc-success bg-cc-success-subtle/30 text-cc-success'
  return 'border-cc-border bg-cc-surface text-cc-fg'
}

function formatStepTime(at: TaskTrajectoryStep['at']): string | undefined {
  if (at === undefined) return undefined
  const date = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(date.getTime())) return String(at)
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function stepAgent(step: TaskTrajectoryStep, agents: Agent[] | undefined): Agent | undefined {
  return step.agentId ? agents?.find((agent) => agent.id === step.agentId) : undefined
}

export function TaskTrajectory({
  item,
  steps,
  agents,
  currentStepId,
  onStepToggle,
  onRetry,
  className,
}: TaskTrajectoryProps) {
  const locale = useLocale()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const activeStepId = currentStepId ?? steps.at(-1)?.id

  return (
    <section className={cn('min-w-0', className)} data-cc-task-trajectory data-cc-task-id={item.id}>
      <header className="mb-3">
        <h3 className="text-cc-sm font-semibold text-cc-fg">{locale.taskTrajectory}</h3>
        <p className="text-cc-xs text-cc-muted">{item.title}</p>
      </header>
      <ol className="space-y-3" aria-label={locale.taskTrajectory}>
        {steps.map((step) => {
          const isCurrent = step.id === activeStepId
          const isExpanded = expanded[step.id] ?? false
          const time = formatStepTime(step.at)
          const agent = stepAgent(step, agents)
          const displayAgentName = agent?.name ?? step.agentId
          return (
            <li
              key={step.id}
              className={cn('relative pl-8', isCurrent && 'rounded-cc-sm ring-1 ring-cc-accent/60')}
              data-cc-task-trajectory-step={step.id}
              data-cc-task-trajectory-kind={step.kind}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'absolute left-1 top-3 size-3 rounded-cc-full border-2 border-cc-surface',
                  step.kind === 'blocked'
                    ? 'bg-cc-warning'
                    : step.kind === 'failed'
                      ? 'bg-cc-danger'
                      : step.kind === 'completed'
                        ? 'bg-cc-success'
                        : 'bg-cc-accent',
                )}
                aria-hidden="true"
              />
              <div className={cn('rounded-cc-sm border p-3', stepTone(step.kind))}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-cc-xs font-semibold uppercase tracking-wide">
                        {locale.taskTrajectoryKind(step.kind)}
                      </span>
                      {isCurrent && (
                        <span className="text-cc-xs font-medium text-cc-accent">
                          {locale.taskTrajectoryCurrent}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-cc-sm font-medium">{step.title ?? step.kind}</p>
                    {time && (
                      <time
                        className="mt-1 block tabular-nums text-cc-xs text-cc-faint"
                        dateTime={step.at instanceof Date ? step.at.toISOString() : String(step.at)}
                        aria-label={locale.taskTrajectoryStepAt(time)}
                      >
                        {time}
                      </time>
                    )}
                  </div>
                  {displayAgentName && (
                    <span className="inline-flex items-center gap-1.5">
                      <AgentAvatar
                        agent={agent}
                        name={agent ? undefined : displayAgentName}
                        size="sm"
                      />
                      <AgentBadge agent={agent} name={agent ? undefined : displayAgentName} />
                    </span>
                  )}
                </div>
                {step.detail && (isExpanded || !onStepToggle) && (
                  <p className="mt-2 whitespace-pre-wrap text-cc-sm text-cc-muted">{step.detail}</p>
                )}
                {(onStepToggle ||
                  (onRetry && (step.kind === 'blocked' || step.kind === 'failed'))) && (
                  <div className="mt-2 flex gap-3 border-t border-cc-border pt-2">
                    {onStepToggle && step.detail && (
                      <button
                        type="button"
                        className="text-cc-xs text-cc-muted hover:text-cc-fg"
                        aria-expanded={isExpanded}
                        onClick={() => {
                          const nextExpanded = !isExpanded
                          setExpanded((current) => ({ ...current, [step.id]: nextExpanded }))
                          onStepToggle(step, nextExpanded)
                        }}
                      >
                        {isExpanded
                          ? locale.taskTrajectoryHideDetail
                          : locale.taskTrajectoryShowDetail}
                      </button>
                    )}
                    {onRetry && (step.kind === 'blocked' || step.kind === 'failed') && (
                      <button
                        type="button"
                        className="text-cc-xs text-cc-muted hover:text-cc-fg"
                        onClick={() => onRetry(item, step)}
                      >
                        {locale.taskTrajectoryRetry}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
