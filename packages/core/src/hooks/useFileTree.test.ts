import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'

import { useFileTree, type FileNode, type UseFileTreeOptions } from './useFileTree'

const TREE: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'dir',
    children: [
      { id: 'src/a.ts', name: 'a.ts', type: 'file' },
      {
        id: 'src/lib',
        name: 'lib',
        type: 'dir',
        children: [{ id: 'src/lib/b.ts', name: 'b.ts', type: 'file' }],
      },
    ],
  },
  { id: 'README.md', name: 'README.md', type: 'file' },
]

function setup(options: Partial<UseFileTreeOptions> = {}) {
  return renderHook(() => useFileTree({ nodes: TREE, ...options }))
}

const ids = (rows: { node: FileNode }[]) => rows.map((row) => row.node.id)

/** Enough of a KeyboardEvent for the hook, which only reads `key`. */
function key(name: string) {
  return { key: name, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLElement>
}

describe('useFileTree', () => {
  it('flattens only the visible rows', () => {
    const { result } = setup()

    expect(ids(result.current.rows)).toEqual(['src', 'README.md'])
  })

  it('reveals children in document order when expanded', () => {
    const { result } = setup({ defaultExpanded: ['src'] })

    expect(ids(result.current.rows)).toEqual(['src', 'src/a.ts', 'src/lib', 'README.md'])
  })

  it('records depth and the parent row index', () => {
    const { result } = setup({ defaultExpanded: ['src', 'src/lib'] })

    expect(result.current.rows.map((row) => [row.node.id, row.depth, row.parentIndex])).toEqual([
      ['src', 0, -1],
      ['src/a.ts', 1, 0],
      ['src/lib', 1, 0],
      ['src/lib/b.ts', 2, 2],
      ['README.md', 0, -1],
    ])
  })

  it('marks a loaded empty directory as not expandable', () => {
    const { result } = renderHook(() =>
      useFileTree({ nodes: [{ id: 'empty', name: 'empty', type: 'dir', children: [] }] }),
    )

    expect(result.current.rows[0]?.expandable).toBe(false)
  })

  it('marks an unloaded directory expandable only when onExpand exists', () => {
    const nodes: FileNode[] = [{ id: 'lazy', name: 'lazy', type: 'dir' }]

    const without = renderHook(() => useFileTree({ nodes }))
    expect(without.result.current.rows[0]?.expandable).toBe(false)

    const withHandler = renderHook(() => useFileTree({ nodes, onExpand: () => {} }))
    expect(withHandler.result.current.rows[0]?.expandable).toBe(true)
  })

  describe('lazy loading', () => {
    it('flags the row while onExpand is pending, then clears it', async () => {
      let resolve: () => void = () => {}
      const onExpand = vi.fn(() => new Promise<void>((r) => (resolve = r)))
      const nodes: FileNode[] = [{ id: 'lazy', name: 'lazy', type: 'dir' }]
      const { result } = renderHook(() => useFileTree({ nodes, onExpand }))

      act(() => result.current.expand(nodes[0] as FileNode))
      expect(result.current.rows[0]?.loading).toBe(true)

      await act(async () => {
        resolve()
      })
      expect(result.current.rows[0]?.loading).toBe(false)
    })

    it('falls back to collapsed and records the error when onExpand rejects', async () => {
      const onExpand = vi.fn(async () => Promise.reject(new Error('offline')))
      const nodes: FileNode[] = [{ id: 'lazy', name: 'lazy', type: 'dir' }]
      const { result } = renderHook(() => useFileTree({ nodes, onExpand }))

      act(() => result.current.expand(nodes[0] as FileNode))

      // Staying open would show an empty folder, which reads as "nothing in here" rather
      // than "loading it failed".
      await waitFor(() => expect(result.current.rows[0]?.error).toBe('offline'))
      expect(result.current.expanded).toEqual([])
      expect(result.current.rows[0]?.loading).toBe(false)
    })

    it('retries after a failure but not after a success', async () => {
      const onExpand = vi.fn(async () => Promise.reject(new Error('offline')))
      const nodes: FileNode[] = [{ id: 'lazy', name: 'lazy', type: 'dir' }]
      const { result } = renderHook(() => useFileTree({ nodes, onExpand }))

      act(() => result.current.expand(nodes[0] as FileNode))
      await waitFor(() => expect(result.current.rows[0]?.error).toBeDefined())
      act(() => result.current.expand(nodes[0] as FileNode))

      expect(onExpand).toHaveBeenCalledTimes(2)
    })

    it('does not call onExpand again on collapse and re-expand', () => {
      const onExpand = vi.fn()
      const nodes: FileNode[] = [{ id: 'lazy', name: 'lazy', type: 'dir' }]
      const { result } = renderHook(() => useFileTree({ nodes, onExpand }))

      act(() => result.current.expand(nodes[0] as FileNode))
      act(() => result.current.collapse('lazy'))
      act(() => result.current.expand(nodes[0] as FileNode))

      expect(onExpand).toHaveBeenCalledOnce()
    })
  })

  describe('keyboard', () => {
    it('moves down and up over visible rows only', () => {
      const { result } = setup()

      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.focusedIndex).toBe(0)
      act(() => result.current.onKeyDown(key('ArrowDown')))
      // Two rows visible, so this is README.md — the collapsed children were skipped.
      expect(result.current.rows[result.current.focusedIndex]?.node.id).toBe('README.md')
    })

    it('clamps at both ends', () => {
      const { result } = setup()

      act(() => result.current.onKeyDown(key('End')))
      act(() => result.current.onKeyDown(key('ArrowDown')))
      expect(result.current.focusedIndex).toBe(1)

      act(() => result.current.onKeyDown(key('Home')))
      act(() => result.current.onKeyDown(key('ArrowUp')))
      expect(result.current.focusedIndex).toBe(0)
    })

    it('right expands a closed directory, then steps into it', () => {
      const { result } = setup()

      act(() => result.current.onKeyDown(key('ArrowDown')))
      act(() => result.current.onKeyDown(key('ArrowRight')))
      expect(result.current.expanded).toEqual(['src'])
      expect(result.current.focusedIndex).toBe(0)

      act(() => result.current.onKeyDown(key('ArrowRight')))
      expect(result.current.rows[result.current.focusedIndex]?.node.id).toBe('src/a.ts')
    })

    it('right does nothing on a file', () => {
      const { result } = setup()

      act(() => result.current.onKeyDown(key('End')))
      act(() => result.current.onKeyDown(key('ArrowRight')))

      expect(result.current.expanded).toEqual([])
      expect(result.current.rows[result.current.focusedIndex]?.node.id).toBe('README.md')
    })

    it('left collapses an open directory, then climbs to the parent', () => {
      const { result } = setup({ defaultExpanded: ['src', 'src/lib'] })

      // Start on src/lib/b.ts.
      act(() => result.current.setFocusedIndex(3))
      act(() => result.current.onKeyDown(key('ArrowLeft')))
      expect(result.current.rows[result.current.focusedIndex]?.node.id).toBe('src/lib')

      act(() => result.current.onKeyDown(key('ArrowLeft')))
      expect(result.current.expanded).toEqual(['src'])

      act(() => result.current.onKeyDown(key('ArrowLeft')))
      expect(result.current.rows[result.current.focusedIndex]?.node.id).toBe('src')
    })

    it('Enter activates a file and Space activates too', () => {
      const onActivate = vi.fn()
      const { result } = setup({ onActivate })

      act(() => result.current.onKeyDown(key('End')))
      act(() => result.current.onKeyDown(key('Enter')))
      expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 'README.md' }))

      act(() => result.current.onKeyDown(key(' ')))
      expect(onActivate).toHaveBeenCalledTimes(2)
    })

    it('Enter on a directory toggles instead of activating', () => {
      const onActivate = vi.fn()
      const { result } = setup({ onActivate })

      act(() => result.current.onKeyDown(key('ArrowDown')))
      act(() => result.current.onKeyDown(key('Enter')))

      expect(onActivate).not.toHaveBeenCalled()
      expect(result.current.expanded).toEqual(['src'])
    })

    it('keeps the focused index inside the list after a collapse shortens it', () => {
      const { result } = setup({ defaultExpanded: ['src', 'src/lib'] })

      act(() => result.current.onKeyDown(key('End')))
      const last = result.current.focusedIndex
      act(() => result.current.collapse('src'))
      act(() => result.current.onKeyDown(key('ArrowDown')))

      expect(last).toBe(4)
      expect(result.current.focusedIndex).toBeLessThan(result.current.rows.length)
    })
  })

  describe('controlled', () => {
    it('reports expansion changes without owning them', () => {
      const onExpandedChange = vi.fn()
      const { result } = setup({ expanded: [], onExpandedChange })

      act(() => result.current.expand(TREE[0] as FileNode))

      expect(onExpandedChange).toHaveBeenCalledWith(['src'])
      // Still controlled by the host, which has not fed the new value back.
      expect(result.current.expanded).toEqual([])
    })

    it('takes selection from the prop', () => {
      const onSelect = vi.fn()
      const { result } = setup({ selectedId: 'README.md', onSelect })

      act(() => result.current.select(TREE[0] as FileNode))

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'src' }))
      expect(result.current.selectedId).toBe('README.md')
    })
  })
})
