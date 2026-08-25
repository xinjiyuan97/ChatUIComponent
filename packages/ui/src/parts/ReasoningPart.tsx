'use client'

import type { ReasoningPart as ReasoningPartData } from '@xinjiyuan97/chat-core'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/cn'
import { formatDuration } from '../lib/format'
import { ThinkingIcon } from '../icons'
import { Collapsible } from '../primitives/Collapsible'
import { useLocale } from '../provider/ChatThemeProvider'
import { LoadingShimmer, TypingText } from '../typing/TypingText'

export type ReasoningPartProps = {
  part: ReasoningPartData
  /** This block is the one currently receiving tokens. */
  streaming?: boolean
  /** Force the initial state; by default the block follows the streaming rule below. */
  defaultOpen?: boolean
  className?: string
}

/**
 * The model's thinking, shown live and then folded away.
 *
 * Reasoning is interesting while it happens and noise once the answer exists, so the block
 * opens itself when tokens start arriving and closes when they stop. A manual toggle wins
 * permanently after that — nothing is worse than an expander that keeps re-collapsing
 * under the reader's cursor.
 */
export function ReasoningPart({
  part,
  streaming = false,
  defaultOpen,
  className,
}: ReasoningPartProps) {
  const locale = useLocale()
  const [open, setOpen] = useState(defaultOpen ?? streaming)
  const touched = useRef(defaultOpen !== undefined)
  const wasStreaming = useRef(streaming)

  useEffect(() => {
    if (touched.current) return
    if (streaming && !wasStreaming.current) setOpen(true)
    if (!streaming && wasStreaming.current) setOpen(false)
    wasStreaming.current = streaming
  }, [streaming])

  const elapsed = useElapsed(part.startedAt, streaming)
  const duration = part.durationMs ?? (streaming ? elapsed : undefined)
  const formatted = formatDuration(duration)

  const header = (
    <span className="flex min-w-0 items-center gap-1.5">
      <ThinkingIcon size={13} className="shrink-0 text-cc-faint" />
      {streaming ? (
        <LoadingShimmer className="font-medium">{locale.thinking}</LoadingShimmer>
      ) : (
        <span className="truncate">
          {formatted ? locale.thoughtFor(formatted) : locale.reasoning}
        </span>
      )}
      {streaming && formatted && <span className="tabular-nums text-cc-faint">{formatted}</span>}
    </span>
  )

  if (!part.text && !streaming) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        touched.current = true
        setOpen(next)
      }}
      header={header}
      className={cn('my-1', className)}
      contentClassName="pt-1"
    >
      {/* A hairline rule rather than a filled panel: reasoning is an aside, and giving it
          a background would make it compete with the answer it precedes. */}
      <div
        className={cn(
          'ml-[6px] border-l border-cc-border pl-3.5',
          'whitespace-pre-wrap text-cc-sm leading-[1.7] text-cc-muted',
        )}
      >
        <TypingText text={part.text} streaming={streaming} />
      </div>
    </Collapsible>
  )
}

/**
 * Ticks while a block is open-ended so the header shows a live counter.
 *
 * Deliberately coarse at 100ms: a counter that updates every frame is unreadable, and this
 * re-renders the whole reasoning block each tick.
 */
function useElapsed(startedAt: number | undefined, active: boolean): number | undefined {
  const [now, setNow] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!active || startedAt === undefined) {
      setNow(undefined)
      return
    }
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [active, startedAt])

  if (startedAt === undefined || now === undefined) return undefined
  return Math.max(0, now - startedAt)
}
