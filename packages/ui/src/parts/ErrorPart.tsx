'use client'

import type { ErrorPart as ErrorPartData } from '@agent-chat/core'

import { cn } from '../lib/cn'
import { AlertIcon, RegenerateIcon } from '../icons'
import { Button } from '../primitives/Button'
import { useLocale } from '../provider/ChatThemeProvider'

export type ErrorPartProps = {
  part: ErrorPartData
  onRetry?: () => void
  className?: string
}

/**
 * A failed or interrupted generation.
 *
 * Kept inside the message rather than raised as a toast: the failure belongs to this turn,
 * and it should still be visible after the reader scrolls back to it an hour later.
 */
export function ErrorPart({ part, onRetry, className }: ErrorPartProps) {
  const locale = useLocale()

  return (
    <div
      role="alert"
      className={cn(
        'my-2 flex items-start gap-2.5 rounded-cc-sm border border-cc-danger/30',
        'bg-cc-danger-subtle/50 px-3 py-2.5',
        className,
      )}
    >
      <AlertIcon size={15} className="mt-px shrink-0 text-cc-danger" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="whitespace-pre-wrap break-words text-cc-sm text-cc-fg">
          {part.message || locale.streamError}
        </p>
        {part.retryable !== false && onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            iconLeft={<RegenerateIcon size={13} />}
          >
            {locale.retry}
          </Button>
        )}
      </div>
    </div>
  )
}
