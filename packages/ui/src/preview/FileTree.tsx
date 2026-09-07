'use client'

import { useFileTree, type FileNode, type UseFileTreeOptions } from '@xinjiyuan97/chat-core'
import { useEffect, useRef, type ComponentType } from 'react'

import { cn } from '../lib/cn'
import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon, SpinnerIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { resolvePreview, type PreviewRegistry } from '../provider/previews'
import type { IconProps } from '../icons'
import { usePreviewRegistry } from './registry'

export type FileTreeProps = UseFileTreeOptions & {
  /** Accessible name for the tree, when the surrounding panel does not already give it one. */
  label?: string
  className?: string
}

/** Indent per level. One glyph's width, so a twisty lines up under the name above it. */
const INDENT = 14

/**
 * A folder, as a tree.
 *
 * The behaviour is [`useFileTree`](../../../core/src/hooks/useFileTree.ts); what is here is
 * the accessibility contract, which is most of what makes a tree different from a list of
 * indented buttons:
 *
 * - one tab stop for the whole tree (roving `tabIndex`), because tabbing through four hundred
 *   files to reach the content beside them is not navigation
 * - `aria-level` / `aria-expanded` / `aria-selected` on each row, since the visual indent
 *   conveys none of that to a screen reader
 * - indent as `padding-inline-start` on the row rather than nested lists with margins, so a
 *   deep path still gets the full row width for its name and truncates at the right edge
 *   instead of being squeezed into a column
 */
export function FileTree({ label, className, ...options }: FileTreeProps) {
  const locale = useLocale()
  const tree = useFileTree(options)
  const { host, builtin } = usePreviewRegistry()
  const containerRef = useRef<HTMLDivElement>(null)

  /* Focus follows the roving index rather than the other way round: the keyboard handler
   * moves an index, and the DOM focus has to catch up or the next key would be delivered to
   * the row the user has already left. */
  useEffect(() => {
    if (tree.focusedIndex < 0) return
    const container = containerRef.current
    const row = container?.querySelector<HTMLElement>(`[data-cc-tree-index="${tree.focusedIndex}"]`)
    if (row && container?.contains(document.activeElement)) row.focus()
  }, [tree.focusedIndex])

  if (tree.rows.length === 0) {
    return (
      <p className={cn('px-3 py-4 text-cc-sm text-cc-faint', className)}>{locale.fileTreeEmpty}</p>
    )
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label={label ?? locale.fileTree}
      onKeyDown={tree.onKeyDown}
      className={cn('min-h-0 overflow-auto overscroll-contain py-1', className)}
    >
      {tree.rows.map((row, index) => {
        const { node } = row
        const selected = tree.selectedId === node.id
        const focused = tree.focusedIndex === index
        const Glyph = glyphFor(node, row.expanded, host, builtin)

        return (
          <div
            key={node.id}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={selected}
            aria-expanded={row.expandable ? row.expanded : undefined}
            aria-busy={row.loading || undefined}
            data-cc-tree-index={index}
            // One tab stop: the focused row, or the first row before anything is focused.
            tabIndex={focused || (tree.focusedIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => {
              tree.setFocusedIndex(index)
              tree.activate(node)
            }}
            onFocus={() => tree.setFocusedIndex(index)}
            style={{ paddingInlineStart: 6 + row.depth * INDENT }}
            className={cn(
              'flex cursor-default items-center gap-1 pr-2 py-1 text-cc-sm outline-none',
              'transition-colors duration-150 ease-cc',
              selected ? 'bg-cc-accent-subtle text-cc-accent' : 'text-cc-fg hover:bg-cc-subtle',
              focused && 'ring-2 ring-inset ring-cc-accent/45',
            )}
          >
            {row.expandable ? (
              <button
                type="button"
                // Not a tab stop and not announced: the row already carries
                // `aria-expanded`, and a screen reader user expands with the arrow keys.
                tabIndex={-1}
                aria-hidden
                onClick={(event) => {
                  // Otherwise the row's own click would also activate the directory, and a
                  // click on the twisty would toggle it twice.
                  event.stopPropagation()
                  tree.toggle(node)
                }}
                className="grid size-4 shrink-0 place-items-center text-cc-faint hover:text-cc-fg"
              >
                {row.loading ? (
                  <SpinnerIcon size={11} />
                ) : (
                  <ChevronRightIcon
                    size={12}
                    className={cn(
                      'transition-transform duration-150 ease-cc',
                      row.expanded && 'rotate-90',
                    )}
                  />
                )}
              </button>
            ) : (
              <span aria-hidden className="size-4 shrink-0" />
            )}

            <Glyph size={14} className="shrink-0 text-cc-faint" />

            <span className="truncate" title={node.name}>
              {node.name}
            </span>

            {row.error && (
              <span className="shrink-0 text-cc-xs text-cc-faint">{locale.fileTreeLoadFailed}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A directory's own icon, or the one the file's preview registered.
 *
 * Reading it from the registry is what keeps the tree honest: a host that adds a preview for
 * `.parquet` gets its icon here too, with no second list to update.
 */
function glyphFor(
  node: FileNode,
  expanded: boolean,
  host: PreviewRegistry,
  builtin: PreviewRegistry,
): ComponentType<IconProps> {
  if (node.type === 'dir') return expanded ? FolderOpenIcon : FolderIcon
  const definition = resolvePreview(
    { name: node.name, mediaType: node.file?.mediaType },
    host,
    builtin,
  )
  const icon = definition?.icon
  // `PanelGlyph` is a component *or* a ready-made node; only the component form can be
  // given a size here, and a node would need a wrapper it has not asked for.
  return typeof icon === 'function' ? (icon as ComponentType<IconProps>) : FileIcon
}
