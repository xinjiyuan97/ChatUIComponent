'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

/** Which edge the handle sits on. It decides the sign of the drag. */
export type ResizeSide = 'left' | 'right'

export type UseResizablePanelOptions = {
  defaultWidth?: number
  min?: number
  max?: number
  /** Controlled width in px; omit to let the hook manage its own. */
  width?: number
  onWidthChange?: (width: number) => void
  /** `localStorage` key for remembering the width. Omit to not persist. */
  storageKey?: string
  /** Defaults to `left`, i.e. a panel docked on the right. */
  side?: ResizeSide
  /** Keyboard step in px. Shift multiplies it by four. */
  step?: number
}

export type ResizeHandleProps = {
  role: 'separator'
  tabIndex: number
  'aria-orientation': 'vertical'
  'aria-valuenow': number
  'aria-valuemin': number
  'aria-valuemax': number
  'data-cc-dragging'?: true
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onDoubleClick: () => void
}

export type ResizableController = {
  width: number
  dragging: boolean
  min: number
  max: number
  setWidth: (width: number) => void
  /** Back to `defaultWidth`. Wired to a double-click on the handle. */
  reset: () => void
  /** Spread onto the handle element. Add your own `aria-label` and classes after it. */
  handleProps: ResizeHandleProps
}

const DEFAULT_WIDTH = 360
const DEFAULT_MIN = 280
const DEFAULT_MAX = 720
const DEFAULT_STEP = 16

function readStored(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const value = Number(raw)
    // A hand-edited or half-written entry must not be able to collapse the panel.
    return Number.isFinite(value) ? value : null
  } catch {
    // Private mode, disabled storage, cross-origin sandbox. Not remembering a width is a
    // perfectly good outcome; throwing out of a layout hook is not.
    return null
  }
}

/**
 * A draggable width for one edge of a panel.
 *
 * Nothing here knows what it is resizing, so the same hook serves the right-hand panel, a
 * wider sidebar or a split view. Four things it does that a naive `mousemove` listener
 * does not:
 *
 * - **Pointer capture.** Events keep arriving at the handle once the pointer leaves it, so
 *   a fast drag across an iframe or out of the window does not silently stop tracking.
 * - **Keyboard.** The handle is a real `separator` with arrow-key, Home and End support.
 *   A drag-only handle does not exist as far as a keyboard user is concerned.
 * - **Selection lock.** Dragging horizontally across a transcript would otherwise paint
 *   the whole thing blue.
 * - **SSR-safe restore.** `localStorage` is read in an effect, never in the initial state.
 *   These components are `'use client'` but Next.js still renders them on the server, and
 *   a stored width in the first render is a guaranteed hydration mismatch.
 */
export function useResizablePanel(options: UseResizablePanelOptions = {}): ResizableController {
  const {
    defaultWidth = DEFAULT_WIDTH,
    min = DEFAULT_MIN,
    max = DEFAULT_MAX,
    width: controlledWidth,
    storageKey,
    side = 'left',
    step = DEFAULT_STEP,
  } = options

  const [uncontrolledWidth, setUncontrolledWidth] = useState(defaultWidth)
  const [dragging, setDragging] = useState(false)

  const onWidthChange = useRef(options.onWidthChange)
  onWidthChange.current = options.onWidthChange

  const clamp = useCallback(
    (value: number) => Math.round(Math.min(Math.max(value, min), Math.max(min, max))),
    [min, max],
  )

  const width = clamp(controlledWidth ?? uncontrolledWidth)
  const controlled = controlledWidth !== undefined

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next)
      if (!controlled) setUncontrolledWidth(clamped)
      onWidthChange.current?.(clamped)
      if (!storageKey) return
      try {
        window.localStorage.setItem(storageKey, String(clamped))
      } catch {
        // See `readStored`: persistence is best-effort by design.
      }
    },
    [clamp, controlled, storageKey],
  )

  /* Restore after mount rather than in the initial state. Runs once — re-running it when
   * the key changes would fight the user's own dragging. */
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !storageKey || controlled) return
    restored.current = true
    const stored = readStored(storageKey)
    if (stored !== null) setUncontrolledWidth(clamp(stored))
  }, [storageKey, controlled, clamp])

  /** Where the pointer went down, and how wide the panel was at that moment. */
  const drag = useRef<{ x: number; width: number } | null>(null)

  /**
   * The page's own cursor and selection settings, saved so the drag can put them back.
   * Setting them on `body` rather than on the handle is the only way to keep the cursor
   * from flickering as the pointer travels over the content it is resizing.
   */
  const bodyStyle = useRef<{ cursor: string; userSelect: string } | null>(null)

  const lockBody = useCallback(() => {
    if (typeof document === 'undefined' || bodyStyle.current) return
    const { style } = document.body
    bodyStyle.current = { cursor: style.cursor, userSelect: style.userSelect }
    style.cursor = 'col-resize'
    style.userSelect = 'none'
  }, [])

  const unlockBody = useCallback(() => {
    if (typeof document === 'undefined' || !bodyStyle.current) return
    document.body.style.cursor = bodyStyle.current.cursor
    document.body.style.userSelect = bodyStyle.current.userSelect
    bodyStyle.current = null
  }, [])

  // A component unmounted mid-drag must not leave the page unselectable.
  useEffect(() => unlockBody, [unlockBody])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      drag.current = { x: event.clientX, width }
      setDragging(true)
      lockBody()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // jsdom, and browsers that have already lost the pointer. The move handler still
        // works for the common case; only tracking outside the element is given up.
      }
    },
    [width, lockBody],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = drag.current
      if (!start) return
      // A handle on the left grows the panel as the pointer moves left.
      const delta = side === 'left' ? start.x - event.clientX : event.clientX - start.x
      commit(start.width + delta)
    },
    [side, commit],
  )

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!drag.current) return
      drag.current = null
      setDragging(false)
      unlockBody()
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Capture was never taken, or the browser dropped it first.
      }
    },
    [unlockBody],
  )

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const amount = event.shiftKey ? step * 4 : step
      /* Arrow keys move the separator, and the panel is on the far side of it: a handle on
       * the left edge grows the panel as the separator goes left, a handle on the right
       * edge grows it as the separator goes right. Same rule the drag follows. */
      const leftGrows = side === 'left' ? 1 : -1

      switch (event.key) {
        case 'ArrowLeft':
          commit(width + amount * leftGrows)
          break
        case 'ArrowRight':
          commit(width - amount * leftGrows)
          break
        case 'Home':
          commit(min)
          break
        case 'End':
          commit(max)
          break
        default:
          return
      }
      event.preventDefault()
    },
    [width, step, side, min, max, commit],
  )

  const reset = useCallback(() => commit(defaultWidth), [commit, defaultWidth])
  const setWidth = useCallback((next: number) => commit(next), [commit])

  const handleProps = useMemo<ResizeHandleProps>(
    () => ({
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical',
      'aria-valuenow': width,
      'aria-valuemin': min,
      'aria-valuemax': max,
      ...(dragging ? { 'data-cc-dragging': true as const } : {}),
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
      onDoubleClick: reset,
    }),
    [width, min, max, dragging, onPointerDown, onPointerMove, endDrag, onKeyDown, reset],
  )

  return useMemo(
    () => ({ width, dragging, min, max, setWidth, reset, handleProps }),
    [width, dragging, min, max, setWidth, reset, handleProps],
  )
}
