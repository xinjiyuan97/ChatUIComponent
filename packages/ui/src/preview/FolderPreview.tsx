'use client'

import {
  useResizablePanel,
  type FileNode,
  type PreviewFile,
  type UseFileTreeOptions,
} from '@xinjiyuan97/chat-core'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/cn'
import { ChevronLeftIcon } from '../icons'
import { Button } from '../primitives/Button'
import { useLocale } from '../provider/ChatThemeProvider'
import { definePanel } from '../provider/panels'
import { FilePreview } from './FilePreview'
import { FileTree } from './FileTree'

export type FolderPreviewProps = Omit<UseFileTreeOptions, 'selectedId' | 'onActivate'> & {
  /** Fires whenever a file is opened, for a host that wants to mirror it in a tab strip. */
  onOpen?: (node: FileNode) => void
  label?: string
  className?: string
  /** Width below which the split collapses into tree-then-file. */
  narrowAt?: number
  /** Persisted tree width, as `useResizablePanel` understands it. */
  storageKey?: string
}

const DEFAULT_NARROW_AT = 480

/**
 * A folder on the left, the selected file on the right.
 *
 * Below `narrowAt` the split becomes a drill-down — tree, then file, with a back button.
 * That threshold is not decoration: at 380px a side-by-side split leaves each half too
 * narrow to read, and the panel is resizable, so a user *will* drag it there.
 */
export function FolderPreview({
  onOpen,
  label,
  className,
  narrowAt = DEFAULT_NARROW_AT,
  storageKey,
  ...tree
}: FolderPreviewProps) {
  const locale = useLocale()
  const containerRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [selected, setSelected] = useState<FileNode | null>(null)

  const resize = useResizablePanel({
    // The handle is on the tree's right edge, so dragging right widens it.
    side: 'right',
    defaultWidth: 240,
    min: 160,
    max: 480,
    storageKey,
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < narrowAt)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [narrowAt])

  const file: PreviewFile | undefined = selected?.file
  const showTree = !narrow || !file
  const showPreview = !narrow || Boolean(file)

  return (
    <div ref={containerRef} className={cn('flex h-full min-h-0 bg-cc-canvas', className)}>
      {showTree && (
        <div
          className={cn('flex min-h-0 flex-col', narrow ? 'flex-1' : 'shrink-0 border-r border-cc-border')}
          style={narrow ? undefined : { width: resize.width }}
        >
          <FileTree
            {...tree}
            label={label}
            selectedId={selected?.id ?? null}
            onActivate={(node) => {
              setSelected(node)
              onOpen?.(node)
            }}
            className="flex-1"
          />
        </div>
      )}

      {!narrow && (
        /* A `div`, not a `button`: `handleProps` already declares `role="separator"` with
         * the value semantics a screen reader reads out. */
        <div
          {...resize.handleProps}
          aria-label={locale.resizePanel}
          title={locale.resizePanel}
          className={cn(
            '-ml-px w-1 shrink-0 cursor-col-resize touch-none bg-transparent',
            'transition-colors duration-150 ease-cc',
            'hover:bg-cc-accent/35 focus-visible:bg-cc-accent/45 focus-visible:outline-none',
            resize.dragging && 'bg-cc-accent/45',
          )}
        />
      )}

      {showPreview && (
        <div className="flex min-w-0 flex-1 flex-col">
          {narrow && file && (
            <div className="flex h-9 shrink-0 items-center border-b border-cc-border px-1.5">
              <Button
                size="sm"
                variant="ghost"
                iconLeft={<ChevronLeftIcon size={13} />}
                onClick={() => setSelected(null)}
              >
                {locale.fileTreeBack}
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1">
            {file ? (
              <FilePreview file={file} close={() => setSelected(null)} />
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-cc-sm text-cc-faint">
                {locale.fileTreeSelectHint}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The folder equivalent of `filePreviewPanel`:
 *
 * ```tsx
 * <ChatThemeProvider panels={{ folder: folderPanel }}>
 * panel.open({ id: path, kind: 'folder', title: name, data: { nodes } })
 * ```
 */
export const folderPanel = definePanel<{ nodes: FileNode[]; onExpand?: UseFileTreeOptions['onExpand'] }>(
  {
    padded: false,
    render: ({ item }) =>
      item.data ? <FolderPreview nodes={item.data.nodes} onExpand={item.data.onExpand} /> : null,
  },
)
