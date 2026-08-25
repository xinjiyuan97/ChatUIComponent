'use client'

import type { FilePart as FilePartData } from '@xinjiyuan97/core'

import { cn } from '../lib/cn'
import { formatBytes } from '../lib/format'
import { FileIcon } from '../icons'

export type FilePartProps = {
  part: FilePartData
  className?: string
}

/** An attachment: images render inline, everything else as a compact chip. */
export function FilePart({ part, className }: FilePartProps) {
  const isImage = part.mediaType.startsWith('image/')

  if (isImage) {
    return (
      <a
        href={part.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'my-2 block w-fit overflow-hidden rounded-cc-md border border-cc-border',
          'outline-none transition-shadow duration-150 ease-cc',
          'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          className,
        )}
      >
        <img
          src={part.url}
          alt={part.name ?? ''}
          loading="lazy"
          className="max-h-80 max-w-full object-contain"
        />
      </a>
    )
  }

  return (
    <a
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'my-1.5 inline-flex max-w-full items-center gap-2 rounded-cc-sm border border-cc-border',
        'bg-cc-surface px-2.5 py-1.5 transition-colors duration-150 ease-cc',
        'hover:bg-cc-subtle outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      <FileIcon size={15} className="shrink-0 text-cc-faint" />
      <span className="truncate text-cc-sm text-cc-fg">{part.name ?? part.url}</span>
      {part.size !== undefined && (
        <span className="shrink-0 tabular-nums text-cc-xs text-cc-faint">
          {formatBytes(part.size)}
        </span>
      )}
    </a>
  )
}
