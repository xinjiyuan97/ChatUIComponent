'use client'

import type { ChatMessage, MessagePart, QuotedMessage, Reaction } from '@xinjiyuan97/core'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { formatTime } from '../lib/format'
import { useChatTheme } from '../provider/ChatThemeProvider'
import { MessageActions } from './MessageActions'
import { MessageContent } from './MessageContent'

export type MessageProps = {
  message: ChatMessage
  onRegenerate?: () => void
  onEdit?: () => void
  onRetry?: () => void
  onFeedback?: (value: 'like' | 'dislike', message: ChatMessage) => void
  onReactionChange?: (reactions: Reaction[], message: ChatMessage) => void
  /** Enables the quote button. See `MessageActions`. */
  onQuote?: (quote: QuotedMessage, message: ChatMessage) => void
  quoteAuthor?: string
  renderPart?: (part: MessagePart, index: number, message: ChatMessage) => ReactNode | undefined
  showAvatar?: boolean
  showTimestamp?: boolean
  showReactions?: boolean
  /** Suppresses the action row, e.g. while this message is still streaming. */
  hideActions?: boolean
  className?: string
}

/**
 * One turn in the transcript.
 *
 * The asymmetry is deliberate and is the single biggest thing that makes a chat UI feel
 * calm: user messages are bubbles because they are short, quoted, and belong to someone;
 * assistant replies sit flat on the canvas because they are the document you came to read,
 * and wrapping a thousand words of prose in a rounded box turns reading into scanning a
 * card.
 */
export function Message(props: MessageProps) {
  const {
    message,
    onRegenerate,
    onEdit,
    onRetry,
    onFeedback,
    onReactionChange,
    onQuote,
    quoteAuthor,
    renderPart,
    showAvatar = false,
    showTimestamp = false,
    showReactions = false,
    hideActions = false,
    className,
  } = props

  const { locale, renderUserAvatar, renderAssistantAvatar } = useChatTheme()
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const streaming = message.status === 'streaming'

  if (isSystem) {
    return (
      <div className={cn('my-3 text-center text-cc-xs text-cc-faint', className)}>
        <MessageContent message={message} renderPart={renderPart} />
      </div>
    )
  }

  const avatar = isUser ? renderUserAvatar?.(message) : renderAssistantAvatar?.(message)
  const showAvatarColumn = showAvatar && avatar !== undefined

  return (
    <div
      // `group/message` is what the action row and every hover affordance below hang off.
      className={cn(
        'group/message flex w-full gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
      data-cc-role={message.role}
      // The anchor `QuoteButton` looks up to decide whether the current selection belongs
      // to *this* message. A ref would have to be threaded through every caller for the
      // same answer.
      data-cc-message-id={message.id}
      // Streaming content changes constantly; announcing every delta would make a screen
      // reader unusable, so the message is marked busy until it settles.
      aria-busy={streaming || undefined}
    >
      {showAvatarColumn && !isUser && <div className="shrink-0 pt-0.5">{avatar}</div>}

      <div className={cn('flex min-w-0 flex-col', isUser ? 'max-w-[80%] items-end' : 'w-full')}>
        <div
          className={cn(
            'min-w-0',
            isUser && [
              'rounded-cc-bubble bg-cc-subtle px-3.5 py-2.5',
              // A bubble that hugs a single word looks like a typo; a floor keeps short
              // messages from collapsing into a lozenge.
              'min-w-16 break-words',
            ],
          )}
        >
          <MessageContent message={message} onRetry={onRetry} renderPart={renderPart} />
        </div>

        <div className={cn('flex items-center gap-2', isUser && 'flex-row-reverse')}>
          {!hideActions && !streaming && (
            <MessageActions
              message={message}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onFeedback={onFeedback}
              onReactionChange={onReactionChange}
              onQuote={onQuote}
              quoteAuthor={quoteAuthor}
              showReactions={showReactions}
            />
          )}
          {showTimestamp && message.createdAt && (
            <MessageTimestamp timestamp={message.createdAt} locale={locale.code} />
          )}
        </div>
      </div>

      {showAvatarColumn && isUser && <div className="shrink-0 pt-0.5">{avatar}</div>}
    </div>
  )
}

export type MessageAvatarProps = {
  /** Image URL. Falls back to initials when absent or broken. */
  src?: string
  name?: string
  className?: string
}

/** Round avatar with an initials fallback. */
export function MessageAvatar({ src, name, className }: MessageAvatarProps) {
  const initials = (name ?? '').trim().slice(0, 1).toUpperCase()

  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 select-none items-center justify-center overflow-hidden',
        'rounded-cc-full bg-cc-subtle text-cc-xs font-medium text-cc-muted',
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials || null}
    </span>
  )
}

export function MessageTimestamp({
  timestamp,
  locale,
  className,
}: {
  timestamp: number
  locale: string
  className?: string
}) {
  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      className={cn(
        'select-none pt-1 text-cc-xs tabular-nums text-cc-faint',
        'opacity-0 transition-opacity duration-150 ease-cc group-hover/message:opacity-100',
        className,
      )}
    >
      {formatTime(timestamp, locale)}
    </time>
  )
}
