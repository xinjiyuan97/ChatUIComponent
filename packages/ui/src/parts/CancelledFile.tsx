'use client'

import { StopIcon } from '../icons'
import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'

export function CancelledFile({ name, className }: { name?: string; className?: string }) {
  const locale = useLocale()
  return (
    <div
      className={cn(
        'my-1.5 inline-flex max-w-full items-center gap-2 rounded-cc-sm border border-cc-border bg-cc-surface px-2.5 py-1.5 text-cc-sm text-cc-muted',
        className,
      )}
    >
      <StopIcon size={15} className="shrink-0 text-cc-faint" />
      {name && <span className="truncate">{name}</span>}
      <span>{locale.cancelled}</span>
    </div>
  )
}
