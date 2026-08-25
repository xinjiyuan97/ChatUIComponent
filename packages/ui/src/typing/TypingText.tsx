'use client'

import { useSmoothText } from '@xinjiyuan97/core'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { useChatTheme } from '../provider/ChatThemeProvider'

export type TypingTextProps = {
  text: string
  /** The stream is still open. Controls whether the caret is shown at the end. */
  streaming?: boolean
  /** Overrides the provider-level typewriter setting for this instance. */
  enabled?: boolean
  charsPerSecond?: number
  className?: string
  /** Receives the smoothed text; use for Markdown or any custom rendering. */
  children?: (displayed: string, isTyping: boolean) => ReactNode
}

/**
 * Reveals text at an even rate as it streams in.
 *
 * The caret is tied to `isTyping`, not to `streaming`: when the network finishes ahead of
 * the animation the caret must stay until the last character is on screen, and when the
 * animation has caught up but the server is still thinking it should keep blinking.
 */
export function TypingText({
  text,
  streaming = false,
  enabled,
  charsPerSecond,
  className,
  children,
}: TypingTextProps) {
  const { typewriter } = useChatTheme()
  const active = enabled ?? typewriter

  const { displayed, isTyping } = useSmoothText(text, {
    enabled: active && streaming,
    charsPerSecond,
  })

  if (children) return <>{children(displayed, isTyping)}</>

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {displayed}
      {(isTyping || streaming) && <StreamingCursor />}
    </span>
  )
}

/**
 * The caret at the leading edge of streaming text.
 *
 * Drawn as a styled element rather than a `▍` character: a block glyph varies in width and
 * baseline between fonts, and in a mixed CJK/Latin paragraph that variation is visible.
 */
export function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.12em] rounded-full',
        'bg-cc-fg/70 animate-cc-blink',
        className,
      )}
    />
  )
}

/** Three-dot indicator for the gap between sending and the first token. */
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1 rounded-full bg-cc-muted animate-cc-dot"
          // Staggering by a third of the period keeps exactly one dot lit at a time.
          style={{ animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </span>
  )
}

/**
 * A sweeping highlight over text that is being generated but not yet shown, used on the
 * reasoning header while the model thinks.
 */
export function LoadingShimmer({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'bg-clip-text text-transparent animate-cc-shimmer',
        'bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,var(--color-cc-faint)_20%,var(--color-cc-fg)_50%,var(--color-cc-faint)_80%)]',
        className,
      )}
    >
      {children}
    </span>
  )
}
