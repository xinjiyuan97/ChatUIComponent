import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useResizablePanel, type UseResizablePanelOptions } from './useResizablePanel'

/** The handle's `onKeyDown` only reads these three fields. */
function key(name: string, shiftKey = false) {
  const preventDefault = vi.fn()
  return { event: { key: name, shiftKey, preventDefault }, preventDefault }
}

function press(
  handleProps: ReturnType<typeof useResizablePanel>['handleProps'],
  name: string,
  shiftKey = false,
) {
  const { event, preventDefault } = key(name, shiftKey)
  act(() => handleProps.onKeyDown(event as never))
  return preventDefault
}

function setup(options: UseResizablePanelOptions = {}) {
  return renderHook(() => useResizablePanel({ defaultWidth: 400, min: 200, max: 600, ...options }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('useResizablePanel', () => {
  it('starts at the default width', () => {
    const { result } = setup()

    expect(result.current.width).toBe(400)
    expect(result.current.dragging).toBe(false)
    expect(result.current.handleProps['aria-valuenow']).toBe(400)
    expect(result.current.handleProps['aria-valuemin']).toBe(200)
    expect(result.current.handleProps['aria-valuemax']).toBe(600)
  })

  it('clamps to min and max', () => {
    const { result } = setup()

    act(() => result.current.setWidth(10))
    expect(result.current.width).toBe(200)

    act(() => result.current.setWidth(99_999))
    expect(result.current.width).toBe(600)
  })

  it('moves the separator with the arrow keys', () => {
    const { result } = setup({ step: 16 })

    // Handle on the left edge: moving the separator left widens the panel beside it.
    press(result.current.handleProps, 'ArrowLeft')
    expect(result.current.width).toBe(416)

    press(result.current.handleProps, 'ArrowRight')
    expect(result.current.width).toBe(400)

    press(result.current.handleProps, 'ArrowLeft', true)
    expect(result.current.width).toBe(464)
  })

  it('flips the arrow directions for a handle on the right', () => {
    const { result } = setup({ side: 'right', step: 16 })

    press(result.current.handleProps, 'ArrowRight')
    expect(result.current.width).toBe(416)
  })

  it('jumps to the ends with Home and End, and leaves other keys alone', () => {
    const { result } = setup()

    press(result.current.handleProps, 'Home')
    expect(result.current.width).toBe(200)

    press(result.current.handleProps, 'End')
    expect(result.current.width).toBe(600)

    const preventDefault = press(result.current.handleProps, 'a')
    expect(result.current.width).toBe(600)
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('returns to the default width on reset', () => {
    const { result } = setup()

    act(() => result.current.setWidth(555))
    act(() => result.current.reset())

    expect(result.current.width).toBe(400)
  })

  it('remembers the width and restores it on the next mount', () => {
    const first = setup({ storageKey: 'cc:test-panel' })
    act(() => first.result.current.setWidth(512))
    expect(window.localStorage.getItem('cc:test-panel')).toBe('512')

    const second = setup({ storageKey: 'cc:test-panel' })
    expect(second.result.current.width).toBe(512)
  })

  it('ignores a stored value that is not a usable number', () => {
    window.localStorage.setItem('cc:test-panel', 'not-a-width')

    const { result } = setup({ storageKey: 'cc:test-panel' })

    expect(result.current.width).toBe(400)
  })

  it('clamps a stored value that no longer fits the current bounds', () => {
    window.localStorage.setItem('cc:test-panel', '5000')

    const { result } = setup({ storageKey: 'cc:test-panel' })

    expect(result.current.width).toBe(600)
  })

  it('reports instead of setting when the width is controlled', () => {
    const onWidthChange = vi.fn()
    const { result } = setup({ width: 320, onWidthChange })

    act(() => result.current.setWidth(500))

    expect(result.current.width).toBe(320)
    expect(onWidthChange).toHaveBeenCalledWith(500)
  })

  it('does not restore over a controlled width', () => {
    window.localStorage.setItem('cc:test-panel', '512')

    const { result } = setup({ width: 320, storageKey: 'cc:test-panel' })

    expect(result.current.width).toBe(320)
  })
})
