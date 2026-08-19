'use client'

import { useStickToBottom } from '@agent-chat/core'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { ArrowDownIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

export type ChatContainerProps = {
  children: ReactNode
  className?: string
}

/** Full-height column: scrolling transcript on top, composer pinned at the bottom. */
export function ChatContainer({ children, className }: ChatContainerProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col bg-cc-canvas text-cc-fg', className)}>
      {children}
    </div>
  )
}

export type ChatViewportProps = {
  children: ReactNode
  /** Rendered above the composer, inside the sticky area — e.g. suggestion chips. */
  footer?: ReactNode
  className?: string
  contentClassName?: string
  /** Turns off the initial jump to the bottom, for a read-only transcript. */
  followOnMount?: boolean
}

/**
 * The scrolling area, pinned to the bottom while content streams.
 *
 * The scroll-to-bottom button appears only once the user has actually scrolled away, and
 * it overlays the viewport rather than occupying layout, so nothing shifts when it
 * appears mid-stream.
 */
export function ChatViewport({
  children,
  footer,
  className,
  contentClassName,
  followOnMount = true,
}: ChatViewportProps) {
  const locale = useLocale()
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    initial: followOnMount,
  })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}
      >
        <div
          ref={contentRef}
          className={cn('mx-auto w-full max-w-cc-measure px-4 py-6 sm:px-6', contentClassName)}
        >
          {children}
        </div>
      </div>

      {!isAtBottom && (
        <ScrollToBottomButton label={locale.scrollToBottom} onClick={() => scrollToBottom()} />
      )}

      {footer}
    </div>
  )
}

export function ScrollToBottomButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute bottom-4 left-1/2 z-10 inline-flex size-8 -translate-x-1/2',
        'items-center justify-center rounded-cc-full border border-cc-border',
        'bg-cc-surface text-cc-muted shadow-cc-raised animate-cc-rise',
        'transition-colors duration-150 ease-cc hover:text-cc-fg',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      <ArrowDownIcon size={15} />
    </button>
  )
}

export type ChatMessageListProps = {
  children: ReactNode
  /** True while a reply is streaming; suppresses screen-reader announcements. */
  busy?: boolean
  className?: string
}

/**
 * The list wrapper.
 *
 * `aria-live="polite"` announces completed replies without interrupting, and `aria-busy`
 * suppresses announcements while tokens are still arriving — without it a screen reader
 * re-reads the message on every delta.
 */
export function ChatMessageList({ children, busy, className }: ChatMessageListProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-busy={busy || undefined}
      className={cn('flex flex-col gap-[var(--cc-message-gap,2rem)]', className)}
    >
      {children}
    </div>
  )
}

export type ChatEmptyStateProps = {
  title?: string
  subtitle?: string
  icon?: ReactNode
  children?: ReactNode
  className?: string
}

/** Shown before the first message. */
export function ChatEmptyState({
  title,
  subtitle,
  icon,
  children,
  className,
}: ChatEmptyStateProps) {
  const locale = useLocale()

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-20 text-center',
        className,
      )}
    >
      {icon && <div className="mb-1 text-cc-faint">{icon}</div>}
      <h2 className="text-[1.05rem] font-medium text-cc-fg">{title ?? locale.emptyTitle}</h2>
      <p className="max-w-md text-cc-sm leading-[1.6] text-cc-muted">
        {subtitle ?? locale.emptySubtitle}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
