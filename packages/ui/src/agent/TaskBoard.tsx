'use client'

import type { TodoItem, TodoStatus } from '@xinjiyuan97/chat-core'
import { useId, useMemo, useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'
import { AgentBadge, AgentPresence, type AgentStatus } from './AgentIdentity'
import type { ChatLocale } from '../provider/locale'

export type TaskBoardProps = {
  items: TodoItem[]
  title?: string
  groupBy?: 'status' | 'owner'
  layout?: 'columns' | 'stack'
  onDescriptionExpandedChange?: (item: TodoItem, expanded: boolean) => void
  now?: number
  onReassign?: (item: TodoItem) => void
  onRetry?: (item: TodoItem) => void
  onCancel?: (item: TodoItem) => void
  onPriority?: (item: TodoItem) => void
  onOpen?: (item: TodoItem) => void
  children?: ReactNode
  className?: string
}

const statuses: TodoStatus[] = [
  'completed',
  'in-progress',
  'pending',
  'blocked',
  'failed',
  'cancelled',
]

function taskStatus(item: TodoItem): TodoStatus {
  // Phase A inferred blocked from pending + owner; retain this fallback for existing hosts only.
  return item.status === 'pending' && item.owner !== undefined ? 'blocked' : item.status
}

function statusLabel(status: TodoStatus, locale: ChatLocale): string {
  return {
    completed: locale.agentDone,
    'in-progress': locale.agentActive,
    pending: locale.todoPending,
    blocked: locale.agentBlocked,
    failed: locale.agentFailed,
    cancelled: locale.todoCancelled,
  }[status]
}

export function TaskBoard({
  items,
  title = 'Tasks',
  groupBy: initialGroupBy = 'status',
  layout = 'columns',
  onDescriptionExpandedChange,
  onReassign,
  onRetry,
  onCancel,
  onPriority,
  onOpen,
  children,
  className,
}: TaskBoardProps) {
  const locale = useLocale()
  const [groupBy, setGroupBy] = useState(initialGroupBy)
  const knownOwners = useMemo(() => {
    const result = new Map<string, string>()
    for (const item of items) {
      const key = item.owner ? `owner:${item.owner.agentId}` : 'unassigned'
      result.set(key, item.owner?.name ?? item.owner?.agentId ?? locale.taskUnassigned)
    }
    return result
  }, [items, locale.taskUnassigned])
  const groups = useMemo(() => {
    const result = new Map<string, TodoItem[]>(
      (groupBy === 'status' ? statuses : [...knownOwners.keys()]).map((key) => [key, []]),
    )
    for (const item of items) {
      const key =
        groupBy === 'owner'
          ? item.owner
            ? `owner:${item.owner.agentId}`
            : 'unassigned'
          : taskStatus(item)
      result.set(key, [...(result.get(key) ?? []), item])
    }
    return result
  }, [groupBy, items, knownOwners])
  const counts = statuses.reduce<Record<TodoStatus, number>>(
    (result, status) => ({
      ...result,
      [status]: items.filter((item) => taskStatus(item) === status).length,
    }),
    { completed: 0, 'in-progress': 0, pending: 0, cancelled: 0, blocked: 0, failed: 0 },
  )

  return (
    <section
      className={cn(
        'min-w-0 max-w-full rounded-cc-md border border-cc-border bg-cc-surface p-3 shadow-cc-card',
        className,
      )}
      data-cc-task-board
      data-cc-task-layout={layout}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-cc-border pb-3">
        <h2 className="text-cc-sm font-semibold text-cc-fg">
          {title === 'Tasks' ? locale.agentTasks : title}
        </h2>
        <div
          className="flex flex-wrap gap-2 text-cc-xs tabular-nums text-cc-faint"
          aria-label={locale.taskSummary}
        >
          <span>
            {counts.completed} {locale.agentDone}
          </span>
          <span>
            {counts['in-progress']} {locale.agentActive}
          </span>
          <span className={counts.blocked > 0 ? 'text-cc-warning' : undefined}>
            {counts.blocked} {locale.agentBlocked}
          </span>
          <span>
            {counts.failed} {locale.agentFailed}
          </span>
        </div>
        <div className="ml-auto flex rounded-cc-xs border border-cc-border p-0.5 text-cc-xs">
          {(['status', 'owner'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={groupBy === value}
              onClick={() => setGroupBy(value)}
              className={cn(
                'rounded-cc-xs px-2 py-1 text-cc-faint',
                groupBy === value && 'bg-cc-subtle text-cc-fg',
              )}
            >
              {value === 'status' ? locale.agentGroupStatus : locale.agentGroupOwner}
            </button>
          ))}
        </div>
      </header>
      <div
        className={cn(
          'mt-3',
          layout === 'columns'
            ? 'flex snap-x snap-proximity gap-4 overflow-x-auto pb-2'
            : 'space-y-4',
        )}
        data-cc-task-groups
      >
        {[...groups].map(([group, groupItems]) => (
          <div
            key={group}
            className={layout === 'columns' ? 'w-72 shrink-0 snap-start' : undefined}
            data-cc-task-group={group}
          >
            <h3 className="mb-1 text-cc-xs font-medium uppercase tracking-wide text-cc-faint">
              {groupBy === 'status'
                ? statusLabel(group as TodoStatus, locale)
                : knownOwners.get(group)}{' '}
              <span className="tabular-nums" data-cc-task-count>
                {groupItems.length}
              </span>
            </h3>
            <div className="space-y-2">
              {groupItems.map((item) => (
                <TaskCard
                  key={item.id}
                  item={item}
                  onReassign={onReassign}
                  onRetry={onRetry}
                  onCancel={onCancel}
                  onPriority={onPriority}
                  onOpen={onOpen}
                  onDescriptionExpandedChange={onDescriptionExpandedChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {children}
    </section>
  )
}

export type TaskCardProps = Omit<
  TaskBoardProps,
  'items' | 'title' | 'groupBy' | 'layout' | 'now' | 'children' | 'className'
> & {
  item: TodoItem
  children?: ReactNode
  renderStream?: (item: TodoItem) => ReactNode
}

export type TaskStatusIndicatorProps = {
  item: TodoItem
  status?: TodoStatus
}

export function TaskStatusIndicator({ item, status = taskStatus(item) }: TaskStatusIndicatorProps) {
  const blocked = status === 'blocked'
  return (
    <span
      className={cn(
        'mt-1.5 size-2 shrink-0 rounded-cc-full',
        blocked
          ? 'bg-cc-warning'
          : status === 'failed'
            ? 'bg-cc-danger'
            : item.status === 'in-progress'
              ? 'bg-cc-accent'
              : item.status === 'completed'
                ? 'bg-cc-success'
                : 'bg-cc-faint',
      )}
    />
  )
}

const presenceStatus: Record<TodoStatus, AgentStatus> = {
  completed: 'done',
  'in-progress': 'thinking',
  pending: 'idle',
  blocked: 'blocked',
  failed: 'error',
  cancelled: 'idle',
}

export type TaskCardHeaderProps = Pick<
  TaskCardProps,
  'item' | 'onOpen' | 'onDescriptionExpandedChange'
>

export function TaskCardHeader({ item, onOpen, onDescriptionExpandedChange }: TaskCardHeaderProps) {
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const descriptionId = useId()
  return (
    <div className="min-w-0 flex-1">
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="text-left text-cc-sm font-medium text-cc-fg hover:underline"
        >
          {item.title}
        </button>
      ) : (
        <h4 className="text-cc-sm font-medium text-cc-fg">{item.title}</h4>
      )}
      {item.labels?.length ? (
        <div role="group" aria-label={locale.taskLabels} className="mt-1 flex flex-wrap gap-1">
          {item.labels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="rounded-cc-xs bg-cc-subtle px-1.5 py-0.5 text-cc-xs text-cc-muted"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {item.description && (
        <div className="mt-2">
          <p
            id={descriptionId}
            className={cn(
              'whitespace-pre-wrap text-cc-sm text-cc-muted',
              !expanded && 'line-clamp-3',
            )}
          >
            {item.description}
          </p>
          {onDescriptionExpandedChange && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={descriptionId}
              className="mt-1 text-cc-xs text-cc-muted hover:text-cc-fg"
              onClick={() => {
                setExpanded(!expanded)
                onDescriptionExpandedChange(item, !expanded)
              }}
            >
              {expanded ? locale.taskDescriptionCollapse : locale.taskDescriptionExpand}
            </button>
          )}
        </div>
      )}
      {item.note && <p className="mt-0.5 text-cc-xs text-cc-faint">{item.note}</p>}
      <TaskOwner item={item} status={taskStatus(item)} />
      <div className="mt-1 flex flex-wrap items-center gap-2 text-cc-xs text-cc-faint">
        <span>{statusLabel(taskStatus(item), locale)}</span>
        {item.attempt && <span>{item.attempt}×</span>}
      </div>
      <TaskDependencies item={item} />
      <TaskArtifacts item={item} />
    </div>
  )
}

export type TaskOwnerProps = { item: TodoItem; status?: TodoStatus }

export function TaskOwner({ item, status = taskStatus(item) }: TaskOwnerProps) {
  if (!item.owner) return null
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2">
      <AgentPresence name={item.owner.name ?? item.owner.agentId} status={presenceStatus[status]} />
      <AgentBadge name={item.owner.name ?? item.owner.agentId} model={item.owner.model} />
    </div>
  )
}

export type TaskDependenciesProps = { item: TodoItem }

export function TaskDependencies({ item }: TaskDependenciesProps) {
  return item.deps?.length ? (
    <div className="mt-1 text-cc-xs text-cc-faint">{item.deps.join(', ')}</div>
  ) : null
}

export type TaskArtifactsProps = { item: TodoItem }

export function TaskArtifacts({ item }: TaskArtifactsProps) {
  return (
    <div className="mt-1 flex flex-wrap gap-2 text-cc-xs text-cc-faint">
      {item.artifacts?.map((artifact) => (
        <span key={artifact.id} className="rounded-cc-xs bg-cc-subtle px-1.5 py-0.5">
          {artifact.label}
        </span>
      ))}
    </div>
  )
}

export type TaskActionsProps = Pick<
  TaskCardProps,
  'item' | 'onReassign' | 'onRetry' | 'onCancel' | 'onPriority'
>

export function TaskActions({ item, onReassign, onRetry, onCancel, onPriority }: TaskActionsProps) {
  const locale = useLocale()
  const action = (label: string, callback?: (item: TodoItem) => void) =>
    callback ? (
      <button
        type="button"
        onClick={() => callback(item)}
        className="text-cc-xs text-cc-muted hover:text-cc-fg"
      >
        {label}
      </button>
    ) : null
  if (!onReassign && !onRetry && !onCancel && !onPriority) return null
  return (
    <div className="mt-2 flex gap-3 border-t border-cc-border pt-2">
      {action(locale.agentReassign, onReassign)}
      {action(locale.agentRetry, onRetry)}
      {action(locale.agentCancel, onCancel)}
      {action(locale.agentPriority, onPriority)}
    </div>
  )
}

export type TaskStreamProps = {
  item: TodoItem
  children?: ReactNode
  renderStream?: (item: TodoItem) => ReactNode
}

export function TaskStream({ item, children, renderStream }: TaskStreamProps) {
  return children ?? renderStream?.(item) ?? null
}

export function TaskCard({
  item,
  onReassign,
  onRetry,
  onCancel,
  onPriority,
  onOpen,
  onDescriptionExpandedChange,
  children,
  renderStream,
}: TaskCardProps) {
  const status = taskStatus(item)
  const blocked = status === 'blocked'
  return (
    <article
      className={cn(
        'min-w-0 break-words rounded-cc-sm border px-3 py-2 [overflow-wrap:anywhere]',
        blocked ? 'border-cc-warning/50 bg-cc-warning-subtle/30' : 'border-cc-border bg-cc-surface',
      )}
      data-cc-task={item.id}
      data-cc-task-id={item.id}
      data-cc-task-status={item.status}
      data-cc-task-effective-status={status}
    >
      <div className="flex items-start gap-2">
        <TaskStatusIndicator item={item} status={status} />
        <TaskCardHeader
          item={item}
          onOpen={onOpen}
          onDescriptionExpandedChange={onDescriptionExpandedChange}
        />
      </div>
      <TaskActions
        item={item}
        onReassign={onReassign}
        onRetry={onRetry}
        onCancel={onCancel}
        onPriority={onPriority}
      />
      <TaskStream item={item} renderStream={renderStream}>
        {children}
      </TaskStream>
    </article>
  )
}
