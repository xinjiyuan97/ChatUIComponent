'use client'

import {
  getMessageText,
  useReactions,
  type ChatMessage,
  type QuotedMessage,
  type Reaction,
} from '@agent-chat/core'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import {
  CopyButton,
  EditButton,
  FeedbackButtons,
  QuoteButton,
  RegenerateButton,
  ShareButton,
} from '../reactions/ActionButtons'
import { ReactionBar } from '../reactions/ReactionBar'

export type MessageActionsProps = {
  message: ChatMessage
  onRegenerate?: () => void
  onEdit?: () => void
  onFeedback?: (value: 'like' | 'dislike', message: ChatMessage) => void
  onReactionChange?: (reactions: Reaction[], message: ChatMessage) => void
  /**
   * Enables the quote button. The selected passage — or the whole message if nothing is
   * selected — comes back as a `QuotedMessage` for the composer's `quote` prop.
   */
  onQuote?: (quote: QuotedMessage, message: ChatMessage) => void
  /** Title shown on the composer's quote strip, e.g. the assistant's display name. */
  quoteAuthor?: string
  /** Enables the emoji picker row. Off by default — most assistants don't need it. */
  showReactions?: boolean
  showShare?: boolean
  /** Keeps the row visible instead of revealing it on hover. */
  alwaysVisible?: boolean
  children?: ReactNode
  className?: string
}

/**
 * The action row under a message.
 *
 * Hidden until the message is hovered *or* something inside it takes keyboard focus. The
 * focus half is not optional: an opacity-0 row is still in the tab order, so without it a
 * keyboard user tabs into buttons they cannot see.
 */
export function MessageActions({
  message,
  onRegenerate,
  onEdit,
  onFeedback,
  onReactionChange,
  onQuote,
  quoteAuthor,
  showReactions = false,
  showShare = false,
  alwaysVisible = false,
  children,
  className,
}: MessageActionsProps) {
  const { reactions, isActive, toggle } = useReactions({
    reactions: message.reactions,
    onChange: (next) => onReactionChange?.(next, message),
  })

  const isAssistant = message.role === 'assistant'
  const text = getMessageText(message)

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 pt-1',
        'transition-opacity duration-150 ease-cc',
        alwaysVisible
          ? 'opacity-100'
          : 'opacity-0 group-hover/message:opacity-100 group-focus-within/message:opacity-100',
        className,
      )}
    >
      {text && <CopyButton text={text} />}

      {isAssistant && onRegenerate && <RegenerateButton onClick={onRegenerate} />}
      {!isAssistant && onEdit && <EditButton onClick={onEdit} />}

      {onQuote && <QuoteButton message={message} author={quoteAuthor} onQuote={onQuote} />}

      {isAssistant && onFeedback && (
        <FeedbackButtons
          liked={isActive('like')}
          disliked={isActive('dislike')}
          onFeedback={(value) => {
            toggle(value)
            onFeedback(value, message)
          }}
        />
      )}

      {showShare && <ShareButton text={text} />}

      {showReactions && (
        <ReactionBar
          className="ml-1"
          // The like/dislike pair lives in its own control above; showing it again as
          // emoji pills would let the same opinion be expressed twice.
          reactions={reactions.filter((r) => r.key !== 'like' && r.key !== 'dislike')}
          onToggle={toggle}
        />
      )}

      {children}
    </div>
  )
}
