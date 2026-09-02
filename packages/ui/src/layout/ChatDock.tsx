'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '../lib/cn'

export type ChatDockProps = {
  /** True before the first message: the composer group sits on the vertical centre line. */
  centered: boolean
  /** The scrolling transcript — normally a `ChatViewport`. */
  transcript: ReactNode
  /**
   * Shown above the composer while `centered`, and collapsed away in step with the slide.
   *
   * The greeting and the starter prompts go here. Rendering them conditionally from the
   * host instead would make them pop out of existence halfway through the transition.
   */
  intro?: ReactNode
  /** The composer. */
  children: ReactNode
  className?: string
  /** Wraps the composer group — use it for the measure and the horizontal padding. */
  contentClassName?: string
}

/**
 * Transcript above, composer below, with a centred first-run state.
 *
 * An empty conversation puts the greeting, the composer and the starter prompts together
 * on the centre line; sending the first message slides the composer down to the bottom and
 * hands the space to the transcript.
 *
 * The motion is a `grid-template-rows` transition from `1fr` to `0fr` on a trailing spacer
 * row — the same technique `Collapsible` uses, and for the same reason: it animates to a
 * real layout with no magic numbers. The alternative, FLIP, means reading
 * `getBoundingClientRect` in a layout effect on a subtree that re-renders on every
 * keystroke, which is both more expensive and far easier to get wrong.
 *
 * Opt-in. Hosts that want the composer permanently docked keep assembling `ChatViewport`
 * and their composer directly under `ChatContainer`.
 */
export function ChatDock({
  centered,
  transcript,
  intro,
  children,
  className,
  contentClassName,
}: ChatDockProps) {
  /**
   * Keeps the collapsed `intro` out of the tab order and the accessibility tree.
   *
   * A starter prompt clipped to zero height is still focusable, and `aria-hidden` is not
   * the fix — hiding a subtree that still holds focusable children from assistive tech is
   * invalid ARIA rather than a remedy. `inert` is exactly the right tool, but React only
   * learned it as a typed boolean prop in 19 while the peer range here still allows 18, and
   * every string/boolean spelling warns on one major or the other. Setting the DOM property
   * sidesteps React's attribute handling entirely and is clean on both.
   */
  const introRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (introRef.current) introRef.current.inert = !centered
  }, [centered])

  return (
    <div
      data-cc-dock={centered ? 'centered' : 'docked'}
      className={cn(
        'grid min-h-0 flex-1',
        'transition-[grid-template-rows] duration-300 ease-cc',
        // Rows: transcript / composer group / trailing spacer. Collapsing the spacer is
        // what moves the composer, so only one value changes between the two states.
        centered ? 'grid-rows-[1fr_auto_1fr]' : 'grid-rows-[1fr_auto_0fr]',
        className,
      )}
    >
      {/* `min-h-0` is required for a grid row to be allowed to shrink below its content,
          and `overflow-hidden` keeps the transcript from spilling while it resizes. */}
      <div className="flex min-h-0 flex-col overflow-hidden">{transcript}</div>

      <div className={cn('min-w-0', contentClassName)}>
        {intro && (
          <div
            ref={introRef}
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-300 ease-cc',
              centered ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="min-h-0 overflow-hidden">{intro}</div>
          </div>
        )}
        {children}
      </div>

      {/* Pure spacer. It has no content, so it needs no `min-h-0` of its own to reach 0. */}
      <div aria-hidden="true" />
    </div>
  )
}
