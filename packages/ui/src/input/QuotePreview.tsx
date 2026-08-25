'use client'

import type { QuotedMessage } from '@xinjiyuan97/core'

import { cn } from '../lib/cn'
import { CloseIcon, QuoteIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'

export type QuotePreviewProps = {
  quote: QuotedMessage
  onRemove?: () => void
  className?: string
}

/**
 * The "replying to…" strip above the composer.
 *
 * Deliberately quiet: an accent hairline, two clamped lines, and a dismiss button. The
 * quote is context for what the user is about to write, not a second message — give it a
 * card and a full-height excerpt and it starts competing with the thing being composed.
 *
 * The text is rendered as plain text, never as Markdown. It comes from a model's reply, and
 * a quoted `# heading` or image must stay a quoted character sequence rather than becoming
 * a rendered element inside the composer.
 */
export function QuotePreview({ quote, onRemove, className }: QuotePreviewProps) {
  const locale = useLocale()

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-cc-sm bg-cc-accent-subtle/40 py-1.5 pl-2 pr-1',
        'animate-cc-fade-in',
        className,
      )}
      data-cc-quote={quote.messageId}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 w-[2px] shrink-0 self-stretch rounded-cc-full bg-cc-accent"
      />

      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-cc-xs font-medium text-cc-accent">
          <QuoteIcon size={11} className="shrink-0" />
          <span className="truncate">{quote.author || locale.quoteReply}</span>
        </span>
        {/* `whitespace-pre-wrap` keeps the line breaks of the selected passage; the clamp
            keeps a selected wall of text from pushing the textarea off-screen. */}
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-cc-xs leading-[1.5] text-cc-muted">
          {quote.text}
        </p>
      </div>

      {onRemove && (
        <IconButton
          size="sm"
          className="shrink-0"
          label={locale.removeQuote}
          icon={<CloseIcon size={13} />}
          onClick={onRemove}
        />
      )}
    </div>
  )
}
