'use client'

import type { Attachment } from '@agent-chat/core'

import { cn } from '../lib/cn'
import { formatBytes } from '../lib/format'
import { CloseIcon, FileIcon, SpinnerIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

export type { Attachment }

export type AttachmentListProps = {
  attachments: Attachment[]
  onRemove?: (id: string) => void
  className?: string
}

/**
 * Pending attachments, shown above the textarea.
 *
 * Images get a real thumbnail rather than a filename chip — when you attach a screenshot
 * the only thing you actually want to verify is that it is the right screenshot.
 */
export function AttachmentList({ attachments, onRemove, className }: AttachmentListProps) {
  const locale = useLocale()
  if (attachments.length === 0) return null

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {attachments.map((attachment) => {
        const preview = attachment.previewUrl ?? attachment.url
        const isImage = attachment.mediaType.startsWith('image/') && preview
        const failed = attachment.status === 'error'
        const pending = attachment.status === 'pending'

        return (
          <li
            key={attachment.id}
            className={cn(
              'group/attachment relative',
              isImage
                ? 'size-14 overflow-hidden rounded-cc-sm border'
                : 'flex items-center gap-2 rounded-cc-sm border bg-cc-surface py-1 pl-1 pr-2.5',
              failed ? 'border-cc-danger/40' : 'border-cc-border',
            )}
          >
            {isImage ? (
              <>
                <img
                  src={preview}
                  alt={attachment.name}
                  className={cn(
                    'size-full object-cover transition-opacity duration-150 ease-cc',
                    pending && 'opacity-50',
                  )}
                />
                {pending && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <SpinnerIcon size={16} className="animate-cc-spin text-cc-fg/70" />
                  </span>
                )}
                {failed && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-cc-danger/85 px-1 py-0.5 text-center text-cc-xs text-white">
                    {attachment.error}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-cc-xs bg-cc-subtle">
                  {pending ? (
                    <SpinnerIcon size={13} className="animate-cc-spin text-cc-muted" />
                  ) : (
                    <FileIcon size={14} className={failed ? 'text-cc-danger' : 'text-cc-faint'} />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block max-w-40 truncate text-cc-xs text-cc-fg">
                    {attachment.name}
                  </span>
                  <span
                    className={cn('block text-cc-xs', failed ? 'text-cc-danger' : 'text-cc-faint')}
                  >
                    {failed
                      ? attachment.error
                      : pending
                        ? locale.uploading
                        : formatBytes(attachment.size)}
                  </span>
                </span>
              </>
            )}

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                aria-label={locale.removeAttachment(attachment.name)}
                className={cn(
                  'absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center',
                  'rounded-cc-full border border-cc-border bg-cc-surface text-cc-muted shadow-cc-card',
                  'opacity-0 transition-opacity duration-150 ease-cc',
                  'hover:text-cc-fg group-hover/attachment:opacity-100 focus-visible:opacity-100',
                  'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                )}
              >
                <CloseIcon size={9} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export type SuggestionChipsProps = {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  className?: string
}

/** Starter prompts for the empty state. */
export function SuggestionChips({ suggestions, onSelect, className }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className={cn(
            'rounded-cc-full border border-cc-border bg-cc-surface px-3 py-1.5',
            'text-cc-sm text-cc-muted transition-colors duration-150 ease-cc',
            'hover:border-cc-border-strong hover:text-cc-fg',
            'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
