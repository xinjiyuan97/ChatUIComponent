'use client'

import type { PromptQueueController, QueuedPrompt } from '@xinjiyuan97/chat-core'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../lib/cn'
import { CloseIcon, PaperclipIcon, StopIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { ThinkingDots } from '../typing/TypingText'

export type StreamingStatusProps = {
  onStop: () => void
  /** Overrides the default 「生成中」 wording. */
  label?: string
  className?: string
}

/**
 * The "still generating" bar above the composer, which is also the stop button.
 *
 * The whole row is the click target rather than just the icon on its right. Interrupting
 * is the single most common thing a reader wants while an answer is running long, and
 * shrinking that action down to a 13px glyph is exactly backwards.
 */
export function StreamingStatus({ onStop, label, className }: StreamingStatusProps) {
  const locale = useLocale()

  return (
    <button
      type="button"
      onClick={onStop}
      aria-label={locale.stopGenerating}
      className={cn(
        'group/stop mb-1.5 flex w-full items-center gap-2 rounded-cc-sm border border-cc-border',
        'bg-cc-surface px-2.5 py-1.5 text-left transition-colors duration-150 ease-cc',
        'hover:border-cc-border-strong hover:bg-cc-subtle',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      <ThinkingDots />
      <span className="min-w-0 flex-1 truncate text-cc-xs text-cc-muted">
        {label ?? locale.generating}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 text-cc-xs',
          'text-cc-faint transition-colors duration-150 ease-cc group-hover/stop:text-cc-fg',
        )}
      >
        <StopIcon size={11} />
        {locale.stopGenerating}
      </span>
    </button>
  )
}

export type PromptQueueProps = {
  queue: PromptQueueController
  className?: string
}

/**
 * Messages waiting their turn, listed above the composer.
 *
 * They stay visible and editable until they are actually sent: a queued follow-up written
 * two minutes ago is often wrong by the time the agent gets to it, and a queue you can
 * only watch is worse than no queue at all.
 */
export function PromptQueue({ queue, className }: PromptQueueProps) {
  const locale = useLocale()
  const [editingId, setEditingId] = useState<string | null>(null)

  if (queue.items.length === 0) return null

  return (
    <div className={cn('mb-1.5 flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-cc-xs text-cc-faint">{locale.queued(queue.items.length)}</span>
        {/* Held means the user stopped, so nothing will go out until they say so. The
            resume control has to live next to the queue it releases — a paused queue with
            no visible way to restart it is indistinguishable from a broken one. */}
        {queue.held && (
          <>
            <span className="text-cc-xs text-cc-faint">·</span>
            <span className="text-cc-xs text-cc-faint">{locale.queuePaused}</span>
            <button
              type="button"
              onClick={queue.resume}
              className={cn(
                'ml-auto inline-flex h-5 items-center rounded-cc-xs px-1.5 text-cc-xs',
                'text-cc-accent transition-colors duration-150 ease-cc hover:bg-cc-accent-subtle',
                'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
              )}
            >
              {locale.queueResume}
            </button>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {queue.items.map((item) =>
          editingId === item.id ? (
            <li key={item.id}>
              <QueuedEditor
                item={item}
                onCancel={() => setEditingId(null)}
                onSubmit={(text) => {
                  setEditingId(null)
                  queue.update(item.id, text)
                }}
              />
            </li>
          ) : (
            <li key={item.id}>
              <QueuedRow
                item={item}
                onEdit={() => setEditingId(item.id)}
                onRemove={() => queue.remove(item.id)}
              />
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

function QueuedRow({
  item,
  onEdit,
  onRemove,
}: {
  item: QueuedPrompt
  onEdit: () => void
  onRemove: () => void
}) {
  const locale = useLocale()
  const attachments = item.parts?.length ?? 0

  return (
    <div
      className={cn(
        'group/queued flex items-center gap-2 rounded-cc-sm border border-cc-border',
        'bg-cc-surface/60 py-1.5 pl-2.5 pr-1 transition-colors duration-150 ease-cc',
        'hover:bg-cc-subtle',
      )}
    >
      {/* A dim marker rather than a number: the order is already the reading order, and a
          numbered list invites the reader to check whether the count is right. */}
      <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-cc-faint" />

      <button
        type="button"
        onClick={onEdit}
        title={locale.editQueued}
        className={cn(
          'min-w-0 flex-1 truncate text-left text-cc-sm text-cc-muted',
          'transition-colors duration-150 ease-cc hover:text-cc-fg',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45 rounded-cc-xs',
        )}
      >
        {item.text || locale.queuedAttachmentsOnly}
      </button>

      {attachments > 0 && (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-cc-xs text-cc-faint">
          <PaperclipIcon size={11} />
          {attachments}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={locale.removeFromQueue}
        title={locale.removeFromQueue}
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-cc-xs',
          'text-cc-faint opacity-0 transition-[opacity,color] duration-150 ease-cc',
          'hover:text-cc-fg group-hover/queued:opacity-100 focus-visible:opacity-100',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        )}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  )
}

/** Inline rewrite of one queued prompt. Enter saves, Escape abandons the edit. */
function QueuedEditor({
  item,
  onSubmit,
  onCancel,
}: {
  item: QueuedPrompt
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(item.text)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // The same IME rule as the composer: while a candidate window is open, Enter picks a
    // candidate and Escape dismisses it — neither belongs to us.
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit(value)
    }
  }

  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onSubmit(value)}
      className={cn(
        'w-full resize-none rounded-cc-sm border border-cc-border-strong bg-cc-surface',
        'px-2.5 py-1.5 text-cc-sm text-cc-fg outline-none',
        'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
      )}
    />
  )
}
