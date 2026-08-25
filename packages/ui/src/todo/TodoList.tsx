'use client'

import { useTodoProgress, type TodoItem, type TodoStatus } from '@xinjiyuan97/chat-core'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/cn'
import { CheckIcon, CircleDotIcon, CircleIcon, CloseIcon, ListChecksIcon } from '../icons'
import { Collapsible } from '../primitives/Collapsible'
import { useLocale } from '../provider/ChatThemeProvider'
import type { ChatLocale } from '../provider/locale'

export type TodoListProps = {
  items: TodoItem[]
  /** Header label. Defaults to the locale's word for a task list. */
  title?: string
  /**
   * Makes rows checkable. Omit for the normal case — the plan belongs to the agent, and a
   * row the user can click but that changes nothing is worse than a row they cannot.
   */
  onToggle?: (item: TodoItem, next: TodoStatus) => void
  /** Force the initial state; by default the list follows the rule below. */
  defaultOpen?: boolean
  className?: string
}

/**
 * The agent's plan, with progress.
 *
 * Open while there is work left and closed once everything is done — the same rule as the
 * reasoning block, for the same reason: a checklist is worth reading while it is being
 * worked through and is pure noise afterwards. A manual toggle wins permanently.
 */
export function TodoList({ items, title, onToggle, defaultOpen, className }: TodoListProps) {
  const locale = useLocale()
  const progress = useTodoProgress(items)

  const [open, setOpen] = useState(defaultOpen ?? !progress.done)
  const touched = useRef(defaultOpen !== undefined)
  const wasDone = useRef(progress.done)

  useEffect(() => {
    if (touched.current) return
    if (progress.done && !wasDone.current) setOpen(false)
    if (!progress.done && wasDone.current) setOpen(true)
    wasDone.current = progress.done
  }, [progress.done])

  const header = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <ListChecksIcon size={13} className="shrink-0 text-cc-faint" />
      <span className="shrink-0 font-medium text-cc-fg">{title ?? locale.todos}</span>

      {/* Collapsed, the one thing worth showing is what the agent is on right now. */}
      {!open && progress.current && !progress.done && (
        <>
          <span className="shrink-0 text-cc-faint">·</span>
          <span className="truncate text-cc-xs text-cc-muted">
            {progress.current.activeTitle ?? progress.current.title}
          </span>
        </>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {progress.total > 0 && (
          <span className="tabular-nums text-cc-xs text-cc-faint">
            {progress.done
              ? locale.todoAllDone
              : locale.todoProgress(progress.completed, progress.total)}
          </span>
        )}
        <ProgressBar ratio={progress.ratio} />
      </span>
    </span>
  )

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'my-1.5 rounded-cc-sm border border-cc-border bg-cc-surface/60 px-2.5 py-2',
          'text-cc-xs text-cc-faint',
          className,
        )}
      >
        {locale.todoEmpty}
      </div>
    )
  }

  return (
    <div className={cn('my-1.5 rounded-cc-sm border border-cc-border bg-cc-surface/60', className)}>
      <Collapsible
        open={open}
        onOpenChange={(next) => {
          touched.current = true
          setOpen(next)
        }}
        header={header}
        headerClassName="px-2.5"
        contentClassName="px-2.5 pb-2.5"
      >
        <ul className="space-y-0.5 border-t border-cc-border pt-2">
          {items.map((item) => (
            <TodoRow key={item.id} item={item} onToggle={onToggle} />
          ))}
        </ul>
      </Collapsible>
    </div>
  )
}

function TodoRow({
  item,
  onToggle,
}: {
  item: TodoItem
  onToggle?: (item: TodoItem, next: TodoStatus) => void
}) {
  const locale = useLocale()
  const done = item.status === 'completed'
  const cancelled = item.status === 'cancelled'
  const running = item.status === 'in-progress'

  const body = (
    <>
      <StatusIcon status={item.status} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-cc-sm leading-[1.55]',
            running && 'font-medium text-cc-fg',
            !running && !done && !cancelled && 'text-cc-muted',
            // Struck through rather than hidden: what was dropped is part of the record.
            (done || cancelled) && 'text-cc-faint line-through decoration-cc-faint/60',
          )}
        >
          {running ? (item.activeTitle ?? item.title) : item.title}
        </span>
        {item.note && (
          <span className="mt-0.5 text-cc-xs leading-[1.5] text-cc-faint">{item.note}</span>
        )}
      </span>
      <span className="sr-only">{statusLabel(item.status, locale)}</span>
    </>
  )

  if (!onToggle) {
    return <li className="flex items-start gap-2 px-1 py-1">{body}</li>
  }

  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={locale.todoToggle(item.title)}
        // Cancelled items are the agent's decision to drop the step; un-cancelling it from
        // a checkbox would put the list out of sync with the plan the agent is following.
        disabled={cancelled}
        onClick={() => onToggle(item, done ? 'pending' : 'completed')}
        className={cn(
          'flex w-full items-start gap-2 rounded-cc-xs px-1 py-1 text-left',
          'transition-colors duration-150 ease-cc hover:bg-cc-subtle',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          'disabled:pointer-events-none',
        )}
      >
        {body}
      </button>
    </li>
  )
}

function StatusIcon({ status }: { status: TodoStatus }) {
  if (status === 'completed') {
    return <CheckIcon size={13} className="mt-[3px] shrink-0 text-cc-success" />
  }
  if (status === 'cancelled') {
    return <CloseIcon size={13} className="mt-[3px] shrink-0 text-cc-faint" />
  }
  if (status === 'in-progress') {
    return <CircleDotIcon size={13} className="mt-[3px] shrink-0 text-cc-fg" />
  }
  return <CircleIcon size={13} className="mt-[3px] shrink-0 text-cc-faint" />
}

/**
 * A 2px rule, not a bar with a track background.
 *
 * Filled in the same green as the check marks so the header and the rows read as one
 * statement — and so the accent stays reserved for the one action on screen.
 */
function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <span
      className="h-[2px] w-10 shrink-0 overflow-hidden rounded-cc-full bg-cc-sunken"
      aria-hidden="true"
    >
      <span
        className="block h-full rounded-cc-full bg-cc-success transition-[width] duration-200 ease-cc"
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </span>
  )
}

function statusLabel(status: TodoStatus, locale: ChatLocale): string {
  if (status === 'completed') return locale.todoCompleted
  if (status === 'in-progress') return locale.todoInProgress
  if (status === 'cancelled') return locale.todoCancelled
  return locale.todoPending
}
