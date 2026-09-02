'use client'

import type { FilePart as FilePartData } from '@xinjiyuan97/chat-core'

import { cn } from '../lib/cn'
import { formatBytes } from '../lib/format'
import { AlertIcon, FileIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { ImagePart } from './ImagePart'

export type FilePartProps = {
  part: FilePartData
  className?: string
}

/** An attachment: images go to `ImagePart`, everything else renders as a compact chip. */
export function FilePart({ part, className }: FilePartProps) {
  const locale = useLocale()

  if (part.mediaType.startsWith('image/')) {
    return <ImagePart part={part} className={className} />
  }

  if (part.status === 'error') {
    return (
      <div
        className={cn(
          'my-1.5 inline-flex max-w-full items-center gap-2 rounded-cc-sm border',
          'border-cc-danger/35 bg-cc-danger-subtle/40 px-2.5 py-1.5',
          className,
        )}
      >
        <AlertIcon size={15} className="shrink-0 text-cc-danger" />
        <span className="truncate text-cc-sm text-cc-muted">{part.error || locale.fileFailed}</span>
      </div>
    )
  }

  const chip = (
    <>
      <FileIcon size={15} className="shrink-0 text-cc-faint" />
      <span className="truncate text-cc-sm text-cc-fg">
        {part.name ?? part.url ?? locale.fileGenerating}
      </span>
      {part.size !== undefined && (
        <span className="shrink-0 tabular-nums text-cc-xs text-cc-faint">
          {formatBytes(part.size)}
        </span>
      )}
    </>
  )

  const base = 'my-1.5 inline-flex max-w-full items-center gap-2 rounded-cc-sm border'

  /* Nothing to link to yet. Rendered as a dimmed chip rather than an anchor with an empty
   * `href`, which would navigate to the current page on click. */
  if (!part.url || part.status === 'generating') {
    return (
      <div
        aria-busy={part.status === 'generating' || undefined}
        className={cn(
          base,
          'border-cc-border bg-cc-surface px-2.5 py-1.5 opacity-60',
          part.status === 'generating' && 'animate-cc-pulse',
          className,
        )}
      >
        {chip}
      </div>
    )
  }

  return (
    <a
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        base,
        'border-cc-border bg-cc-surface px-2.5 py-1.5 transition-colors duration-150 ease-cc',
        'hover:bg-cc-subtle outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      {chip}
    </a>
  )
}
