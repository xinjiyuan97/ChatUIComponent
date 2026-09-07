'use client'

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import type { PreviewFile } from '../preview/file'

/**
 * One entry in the tree.
 *
 * The distinction that matters is `children: undefined` versus `children: []`. Undefined
 * means "not loaded yet" and pairs with `onExpand`; an empty array means the directory was
 * loaded and is genuinely empty. Collapsing the two would either hide a lazy directory's
 * twisty or make every empty folder look like it is hiding something.
 */
export type FileNode = {
  id: string
  name: string
  type: 'file' | 'dir'
  children?: FileNode[]
  /** What to open when this node is activated. Files only. */
  file?: PreviewFile
}

/** A node flattened into a visible row, carrying what the renderer needs to draw it. */
export type FileTreeRow = {
  node: FileNode
  /** 0 for the roots. Drives the indent and `aria-level` (which is 1-based). */
  depth: number
  expanded: boolean
  /** True for a directory that either has children or might, once loaded. */
  expandable: boolean
  loading: boolean
  /** Set when `onExpand` rejected. The row stays collapsed and says so. */
  error?: string
  /** Index of this row's parent in `rows`, or -1 for a root. Left-arrow uses it. */
  parentIndex: number
}

export type UseFileTreeOptions = {
  nodes: FileNode[]
  /** Ids expanded on mount. Ignored when `expanded` is supplied. */
  defaultExpanded?: string[]
  /** Controlled expansion. */
  expanded?: string[]
  onExpandedChange?: (expanded: string[]) => void
  selectedId?: string | null
  /** Fires for both files and directories — a directory click still moves the selection. */
  onSelect?: (node: FileNode) => void
  /** Fires only for files, and only on a deliberate activation (Enter, click). */
  onActivate?: (node: FileNode) => void
  /**
   * Loads a directory's children the first time it is expanded. Resolve with the children;
   * the host is expected to feed them back through `nodes`.
   */
  onExpand?: (node: FileNode) => void | Promise<void>
}

export type FileTreeController = {
  rows: FileTreeRow[]
  expanded: string[]
  selectedId: string | null
  /** Index into `rows` of the roving-tabindex row. -1 before anything is focused. */
  focusedIndex: number
  setFocusedIndex: (index: number) => void
  isExpanded: (id: string) => boolean
  toggle: (node: FileNode) => void
  expand: (node: FileNode) => void
  collapse: (id: string) => void
  select: (node: FileNode) => void
  activate: (node: FileNode) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/**
 * Expansion, selection and keyboard for a file tree.
 *
 * The core of it is `rows`: the tree flattened to exactly the rows that are on screen.
 * Every navigation key indexes into that array rather than walking the node graph, for the
 * same reason `ConversationList` does it — arithmetic on a flattened list cannot step into
 * a collapsed subtree, whereas a graph walk has to remember not to at four separate call
 * sites.
 *
 * Keys follow the WAI-ARIA tree pattern, which is not the same as a list: Right expands a
 * closed directory and *then* moves into it, Left collapses an open one and otherwise
 * climbs to the parent. Users of a file tree in an editor have this in their fingers, and
 * getting it wrong is more disorienting than having no keyboard support at all.
 */
export function useFileTree(options: UseFileTreeOptions): FileTreeController {
  const {
    nodes,
    defaultExpanded,
    expanded: controlledExpanded,
    onExpandedChange,
    selectedId: controlledSelected,
    onSelect,
    onActivate,
    onExpand,
  } = options

  const [uncontrolledExpanded, setUncontrolledExpanded] = useState<string[]>(
    () => defaultExpanded ?? [],
  )
  const [uncontrolledSelected, setUncontrolledSelected] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [loadingIds, setLoadingIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  /** Directories already handed to `onExpand`, so a collapse-and-reopen does not refetch. */
  const requested = useRef(new Set<string>())

  const expanded = controlledExpanded ?? uncontrolledExpanded
  const selectedId = controlledSelected !== undefined ? controlledSelected : uncontrolledSelected

  const expandedSet = useMemo(() => new Set(expanded), [expanded])

  const commitExpanded = useCallback(
    (next: string[]) => {
      if (controlledExpanded === undefined) setUncontrolledExpanded(next)
      onExpandedChange?.(next)
    },
    [controlledExpanded, onExpandedChange],
  )

  const rows = useMemo(() => {
    const built: FileTreeRow[] = []
    const loading = new Set(loadingIds)

    const walk = (list: FileNode[], depth: number, parentIndex: number) => {
      for (const node of list) {
        const isExpanded = expandedSet.has(node.id)
        // A lazy directory is expandable before its children exist, or its twisty never
        // appears and there is no way to ask for them.
        const expandable =
          node.type === 'dir' &&
          (node.children === undefined ? onExpand !== undefined : node.children.length > 0)
        const index = built.length
        built.push({
          node,
          depth,
          expanded: isExpanded,
          expandable,
          loading: loading.has(node.id),
          error: errors[node.id],
          parentIndex,
        })
        if (isExpanded && node.children?.length) walk(node.children, depth + 1, index)
      }
    }

    walk(nodes, 0, -1)
    return built
  }, [nodes, expandedSet, loadingIds, errors, onExpand])

  const expand = useCallback(
    (node: FileNode) => {
      if (node.type !== 'dir' || expandedSet.has(node.id)) return
      commitExpanded([...expanded, node.id])

      if (!onExpand || node.children !== undefined || requested.current.has(node.id)) return
      requested.current.add(node.id)

      let result: void | Promise<void>
      try {
        result = onExpand(node)
      } catch (error) {
        // A synchronous throw is the same failure as a rejection; the host should not have
        // to know which one this hook copes with.
        requested.current.delete(node.id)
        setErrors((prev) => ({ ...prev, [node.id]: message(error) }))
        return
      }
      if (!result) return

      setLoadingIds((prev) => [...prev, node.id])
      void result.then(
        () => {
          setLoadingIds((prev) => prev.filter((id) => id !== node.id))
        },
        (error: unknown) => {
          setLoadingIds((prev) => prev.filter((id) => id !== node.id))
          setErrors((prev) => ({ ...prev, [node.id]: message(error) }))
          /* Fall back to collapsed. Leaving it open shows an empty directory, which reads
           * as "this folder has nothing in it" rather than "loading it failed". Cleared
           * from `requested` so the next click retries. */
          requested.current.delete(node.id)
          if (controlledExpanded === undefined) {
            setUncontrolledExpanded((prev) => prev.filter((id) => id !== node.id))
          }
          onExpandedChange?.(expanded.filter((id) => id !== node.id))
        },
      )
    },
    [expanded, expandedSet, commitExpanded, onExpand, controlledExpanded, onExpandedChange],
  )

  const collapse = useCallback(
    (id: string) => {
      if (!expandedSet.has(id)) return
      commitExpanded(expanded.filter((existing) => existing !== id))
    },
    [expanded, expandedSet, commitExpanded],
  )

  const toggle = useCallback(
    (node: FileNode) => {
      if (expandedSet.has(node.id)) collapse(node.id)
      else expand(node)
    },
    [expandedSet, collapse, expand],
  )

  const select = useCallback(
    (node: FileNode) => {
      if (controlledSelected === undefined) setUncontrolledSelected(node.id)
      onSelect?.(node)
      const index = rows.findIndex((row) => row.node.id === node.id)
      if (index !== -1) setFocusedIndex(index)
    },
    [controlledSelected, onSelect, rows],
  )

  /** A click or Enter: select, and open the file or toggle the directory. */
  const activate = useCallback(
    (node: FileNode) => {
      select(node)
      if (node.type === 'dir') toggle(node)
      else onActivate?.(node)
    },
    [select, toggle, onActivate],
  )

  const move = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), rows.length - 1)
      setFocusedIndex(clamped)
    },
    [rows.length],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (rows.length === 0) return
      // Before anything has focus, the first key acts as if the cursor were above row 0.
      const current = focusedIndex < 0 ? 0 : Math.min(focusedIndex, rows.length - 1)
      const row = rows[current]
      if (!row) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          move(focusedIndex < 0 ? 0 : current + 1)
          return
        case 'ArrowUp':
          event.preventDefault()
          move(focusedIndex < 0 ? 0 : current - 1)
          return
        case 'Home':
          event.preventDefault()
          move(0)
          return
        case 'End':
          event.preventDefault()
          move(rows.length - 1)
          return
        case 'ArrowRight':
          event.preventDefault()
          if (!row.expandable) return
          // Closed: open it. Already open: step onto the first child, which is the very
          // next row by construction.
          if (!row.expanded) expand(row.node)
          else if (rows[current + 1]?.parentIndex === current) move(current + 1)
          return
        case 'ArrowLeft':
          event.preventDefault()
          if (row.expanded) collapse(row.node.id)
          else if (row.parentIndex >= 0) move(row.parentIndex)
          return
        case 'Enter':
        case ' ':
          event.preventDefault()
          activate(row.node)
          return
        default:
          return
      }
    },
    [rows, focusedIndex, move, expand, collapse, activate],
  )

  const isExpanded = useCallback((id: string) => expandedSet.has(id), [expandedSet])

  return useMemo(
    () => ({
      rows,
      expanded,
      selectedId,
      focusedIndex,
      setFocusedIndex,
      isExpanded,
      toggle,
      expand,
      collapse,
      select,
      activate,
      onKeyDown,
    }),
    [
      rows,
      expanded,
      selectedId,
      focusedIndex,
      isExpanded,
      toggle,
      expand,
      collapse,
      select,
      activate,
      onKeyDown,
    ],
  )
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
