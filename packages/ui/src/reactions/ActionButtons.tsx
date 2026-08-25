'use client'

import {
  getMessageText,
  useCopyToClipboard,
  type ChatMessage,
  type QuotedMessage,
} from '@xinjiyuan97/core'

import { cn } from '../lib/cn'
import {
  CheckIcon,
  CopyIcon,
  EditIcon,
  QuoteIcon,
  RegenerateIcon,
  ShareIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'

export type CopyButtonProps = {
  text: string
  size?: 'sm' | 'md'
  className?: string
  onCopy?: (ok: boolean) => void
}

/**
 * Copy, with the icon itself as the confirmation.
 *
 * A toast for a copy is disproportionate — the action is trivial and instant. Swapping the
 * glyph for a checkmark for a moment confirms it exactly where the user is already looking.
 */
export function CopyButton({ text, size = 'sm', className, onCopy }: CopyButtonProps) {
  const locale = useLocale()
  const { copied, copy } = useCopyToClipboard()

  return (
    <IconButton
      size={size}
      className={className}
      label={copied ? locale.copied : locale.copy}
      icon={copied ? <CheckIcon size={14} className="text-cc-success" /> : <CopyIcon size={14} />}
      onClick={() => void copy(text).then((ok) => onCopy?.(ok))}
    />
  )
}

export type RegenerateButtonProps = {
  onClick: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function RegenerateButton({
  onClick,
  disabled,
  size = 'sm',
  className,
}: RegenerateButtonProps) {
  const locale = useLocale()
  return (
    <IconButton
      size={size}
      className={className}
      disabled={disabled}
      label={locale.regenerate}
      icon={<RegenerateIcon size={14} />}
      onClick={onClick}
    />
  )
}

export type EditButtonProps = {
  onClick: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function EditButton({ onClick, size = 'sm', className }: EditButtonProps) {
  const locale = useLocale()
  return (
    <IconButton
      size={size}
      className={className}
      label={locale.edit}
      icon={<EditIcon size={14} />}
      onClick={onClick}
    />
  )
}

export type QuoteButtonProps = {
  message: ChatMessage
  /** Shown as the strip's title above the composer. */
  author?: string
  onQuote: (quote: QuotedMessage, message: ChatMessage) => void
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Longest quote we hand back.
 *
 * The fallback for "nothing selected" is the entire message, and a whole 4000-word answer
 * quoted back at the model is not a quote — it is a resend. Clipping keeps the strip, and
 * whatever the host puts in the next request, proportionate.
 */
const MAX_QUOTE_LENGTH = 2000

/**
 * Quote this reply.
 *
 * Prefers the user's *selection* — the two sentences actually worth answering — and falls
 * back to the whole message when nothing inside it is selected. That is the behaviour
 * people already expect from Slack and Telegram, and it is why the button reads the DOM
 * instead of just passing `message` along.
 */
export function QuoteButton({
  message,
  author,
  onQuote,
  size = 'sm',
  className,
}: QuoteButtonProps) {
  const locale = useLocale()

  return (
    <IconButton
      size={size}
      className={className}
      label={locale.quote}
      icon={<QuoteIcon size={14} />}
      // Without this the mousedown collapses the selection before the click handler can
      // read it, and the button would always fall back to the whole message.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const selected = selectionWithin(messageRoot(message.id))
        const text = (selected || getMessageText(message)).trim()
        if (!text) return
        onQuote(
          {
            messageId: message.id,
            author,
            text: text.length > MAX_QUOTE_LENGTH ? `${text.slice(0, MAX_QUOTE_LENGTH)}…` : text,
          },
          message,
        )
      }}
    />
  )
}

/** The rendered `Message` element, found by the `data-cc-message-id` its root carries. */
function messageRoot(id: string): Element | null {
  if (typeof document === 'undefined') return null
  return document.querySelector(`[data-cc-message-id="${CSS.escape(id)}"]`)
}

/**
 * The current selection, but only if it lies inside `root`.
 *
 * The containment check is the whole point: a selection in a *different* message must not
 * be quoted as this one, and text selected in the composer must not be quoted at all.
 */
function selectionWithin(root: Element | null): string {
  if (!root || typeof window === 'undefined') return ''
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return ''
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return ''
  return selection.toString()
}

export type ShareButtonProps = {
  /** Passed to the Web Share API, with a clipboard copy as the fallback. */
  url?: string
  title?: string
  text?: string
  size?: 'sm' | 'md'
  className?: string
}

export function ShareButton({ url, title, text, size = 'sm', className }: ShareButtonProps) {
  const locale = useLocale()
  const { copy } = useCopyToClipboard()

  const share = async () => {
    const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')
    // `navigator.share` only exists in a secure context and mostly on mobile; falling back
    // to the clipboard keeps one button meaningful everywhere.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url: target, title, text })
        return
      } catch {
        // A cancelled share dialog also lands here; copying is a reasonable outcome.
      }
    }
    await copy(target)
  }

  return (
    <IconButton
      size={size}
      className={className}
      label={locale.share}
      icon={<ShareIcon size={14} />}
      onClick={() => void share()}
    />
  )
}

export type FeedbackButtonsProps = {
  liked?: boolean
  disliked?: boolean
  onFeedback: (value: 'like' | 'dislike') => void
  size?: 'sm' | 'md'
  className?: string
}

/** Thumbs up / down as a mutually exclusive pair. */
export function FeedbackButtons({
  liked,
  disliked,
  onFeedback,
  size = 'sm',
  className,
}: FeedbackButtonsProps) {
  const locale = useLocale()
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <IconButton
        size={size}
        active={liked}
        label={locale.like}
        icon={<ThumbUpIcon size={14} />}
        onClick={() => onFeedback('like')}
      />
      <IconButton
        size={size}
        active={disliked}
        label={locale.dislike}
        icon={<ThumbDownIcon size={14} />}
        onClick={() => onFeedback('dislike')}
      />
    </div>
  )
}
