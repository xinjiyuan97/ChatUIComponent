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
 *
 * When there is no reasoning *text* — several providers report only that thinking happened
 * and for how long — this degrades to a one-line receipt rather than disappearing. An
 * unexplained pause in the transcript is worse than a dim line saying what it was.
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
      {streaming && formatted && (
        <span className="tabular-nums text-cc-xs text-cc-faint">{formatted}</span>
      )}
    </span>
  )

  /* No text to disclose. Rendering the same header without a disclosure — rather than a
   * chevron over an empty panel — is the honest shape: there is nothing to open, and an
   * expander that rewards a click with blank space is a small betrayal. */
  if (!part.text) {
    // Nothing happened worth reporting at all: no text, no timing, not flagged, not live.
    if (!streaming && !part.redacted && formatted === '') return null

    return (
      <div
        // `pl-5` matches the chevron column of an expandable block (14px glyph + 6px gap),
        // so a run of reasoning rows keeps one icon column instead of zig-zagging.
        className={cn(
          'my-1 flex min-w-0 items-center py-1 pl-5 text-cc-sm text-cc-muted',
          className,
        )}
        data-cc-reasoning="empty"
      >
        {streaming ? (
          header
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <ThinkingIcon size={13} className="shrink-0 text-cc-faint" />
            <span className="truncate">
              {formatted ? locale.thoughtFor(formatted) : locale.reasoningHidden}
            </span>
          </span>
        )}
      </div>
    )
  }

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
