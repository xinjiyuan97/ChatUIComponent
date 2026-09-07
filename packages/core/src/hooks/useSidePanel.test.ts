import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSidePanel, type SidePanelItem, type UseSidePanelOptions } from './useSidePanel'

function item(id: string, extra: Partial<SidePanelItem> = {}): SidePanelItem {
  return { id, kind: 'demo', title: id, ...extra }
}

function setup(options: UseSidePanelOptions = {}) {
  return renderHook(() => useSidePanel(options))
}

/** Opens a, b, c and leaves c active. */
function setupThree(options: UseSidePanelOptions = {}) {
  const view = setup(options)
  act(() => {
    view.result.current.open(item('a'))
    view.result.current.open(item('b'))
    view.result.current.open(item('c'))
  })
  return view
}

const ids = (items: SidePanelItem[]) => items.map((entry) => entry.id)

describe('useSidePanel', () => {
  it('starts empty', () => {
    const { result } = setup()

    expect(result.current.items).toEqual([])
    expect(result.current.activeId).toBeNull()
    expect(result.current.active).toBeNull()
    expect(result.current.isOpen).toBe(false)
  })

  it('opens tabs in order and activates the newest', () => {
    const { result } = setupThree()

    expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    expect(result.current.activeId).toBe('c')
    expect(result.current.active?.title).toBe('c')
    expect(result.current.isOpen).toBe(true)
  })

  it('focuses and refreshes an existing id in place instead of duplicating it', () => {
    const { result } = setupThree()
    act(() => result.current.activate('a'))

    act(() => result.current.open(item('b', { title: 'b, renamed', data: { v: 2 } })))

    // Position matters: a tab that jumps to the end slides out from under the pointer.
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    expect(result.current.activeId).toBe('b')
    expect(result.current.active?.title).toBe('b, renamed')
    expect(result.current.active?.data).toEqual({ v: 2 })
  })

  it('activates the right-hand neighbour when the active tab closes', () => {
    const { result } = setupThree()
    act(() => result.current.activate('b'))

    act(() => result.current.close('b'))

    expect(ids(result.current.items)).toEqual(['a', 'c'])
    expect(result.current.activeId).toBe('c')
  })

  it('falls back to the left neighbour when the last tab closes', () => {
    const { result } = setupThree()

    act(() => result.current.close('c'))

    expect(ids(result.current.items)).toEqual(['a', 'b'])
    expect(result.current.activeId).toBe('b')
  })

  it('leaves the active tab alone when a different one closes', () => {
    const { result } = setupThree()

    act(() => result.current.close('a'))

    expect(result.current.activeId).toBe('c')
  })

  it('ignores closing and activating unknown ids', () => {
    const { result } = setupThree()

    act(() => result.current.close('nope'))
    act(() => result.current.activate('nope'))

    expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    expect(result.current.activeId).toBe('c')
  })

  it('closes everything at once', () => {
    const { result } = setupThree()

    act(() => result.current.closeAll())

    expect(result.current.items).toEqual([])
    expect(result.current.activeId).toBeNull()
    expect(result.current.isOpen).toBe(false)
  })

  it('updates a tab without reordering it', () => {
    const { result } = setupThree()

    act(() => result.current.update('a', { title: 'a, done', data: 42 }))

    expect(ids(result.current.items)).toEqual(['a', 'b', 'c'])
    expect(result.current.items[0]?.title).toBe('a, done')
    expect(result.current.items[0]?.data).toBe(42)
    // The active tab is unaffected by an update to a background one.
    expect(result.current.activeId).toBe('c')
  })

  it('evicts the oldest inactive tab once max is reached', () => {
    const { result } = setup({ max: 3 })
    act(() => {
      result.current.open(item('a'))
      result.current.open(item('b'))
      result.current.open(item('c'))
    })
    act(() => result.current.activate('a'))

    act(() => result.current.open(item('d')))

    // `a` is active, so `b` is the oldest tab the user is not looking at.
    expect(ids(result.current.items)).toEqual(['a', 'c', 'd'])
    expect(result.current.activeId).toBe('d')
  })

  it('opens from initialItems with the first one active', () => {
    const { result } = setup({ initialItems: [item('a'), item('b')] })

    expect(ids(result.current.items)).toEqual(['a', 'b'])
    expect(result.current.activeId).toBe('a')
  })

  it('reports only the open/closed transitions', () => {
    const onOpenChange = vi.fn()
    const { result } = renderHook(() => useSidePanel({ onOpenChange }))

    act(() => result.current.open(item('a')))
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)

    // Still open — a second tab is not a transition.
    act(() => result.current.open(item('b')))
    act(() => result.current.close('b'))
    expect(onOpenChange).toHaveBeenCalledTimes(1)

    act(() => result.current.close('a'))
    expect(onOpenChange).toHaveBeenCalledTimes(2)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})
