'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

export type ImageZoomOptions = {
  min?: number
  max?: number
  /** Multiplier per zoom-in step. Buttons use it; the wheel scales continuously. */
  step?: number
}

export type ImageZoomController = {
  /** Attach to the element the image is scrolled and zoomed inside. */
  viewportRef: RefObject<HTMLDivElement | null>
  /** Call from the image's `onLoad` with `naturalWidth` / `naturalHeight`. */
  setNaturalSize: (width: number, height: number) => void
  /** Effective scale: 1 means one image pixel per CSS pixel. */
  scale: number
  /** True while the image is auto-sized to the viewport, so the toolbar can light up 适应. */
  fitted: boolean
  panning: boolean
  min: number
  max: number
  transform: string
  zoomIn: () => void
  zoomOut: () => void
  /** Back to auto-fit. */
  fit: () => void
  /** Exactly 1:1, centred. */
  actual: () => void
  /** Spread onto the viewport element. The wheel is bound natively via `viewportRef`. */
  viewportProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
    /** Takes no event: a double-click only ever means "flip between fit and 1:1". */
    onDoubleClick: () => void
  }
}

const DEFAULT_MIN = 0.1
const DEFAULT_MAX = 8
const DEFAULT_STEP = 1.25
/** Shared so that "fitted" always yields the same object identity. */
const ORIGIN = { x: 0, y: 0 }

/**
 * Pan and zoom for a single image.
 *
 * Two decisions are what separate this from `scale` in a `useState`:
 *
 * - **Zoom is anchored at the pointer, not at the centre.** Scaling about the centre means
 *   the detail you were pointing at slides away as you zoom towards it, and you spend the
 *   whole time dragging it back. The correction is one line, and its absence is the single
 *   most common flaw in hand-rolled image viewers.
 * - **Fit is a mode, not a number.** While fitted, resizing the panel — which happens
 *   constantly, the panel has a drag handle — recomputes the scale. The first explicit zoom
 *   leaves the mode, and from then on the image stays where it was put.
 *
 * A plain wheel scroll zooms rather than scrolls: inside a viewer that is what a wheel is
 * for, and there is nothing else in the viewport to scroll to.
 */
export function useImageZoom(options: ImageZoomOptions = {}): ImageZoomController {
  const { min = DEFAULT_MIN, max = DEFAULT_MAX, step = DEFAULT_STEP } = options

  const viewportRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [fitted, setFitted] = useState(true)
  const [freeScale, setFreeScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, min), Math.max(min, max)),
    [min, max],
  )

  /* Measured rather than read once: the side panel is resizable, so the viewport's width
   * changes without anything about the image changing. */
  useEffect(() => {
    const element = viewportRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setViewport({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (!natural || !viewport || natural.width === 0 || natural.height === 0) return 1
    // Never blow an image up to fill the panel: a 32×32 icon rendered at 400px is a
    // smear, and "fit" should mean "all of it is visible", not "it is as big as possible".
    return Math.min(viewport.width / natural.width, viewport.height / natural.height, 1)
  }, [natural, viewport])

  const scale = fitted ? fitScale : freeScale
  /* Memoised rather than written inline: `zoomAt` and `pan` both close over it, and a fresh
   * `{ x: 0, y: 0 }` on every render would rebuild those two callbacks — which are handed
   * to the DOM as pointer handlers — on every render too. */
  const position = useMemo(() => (fitted ? ORIGIN : offset), [fitted, offset])

  const setNaturalSize = useCallback((width: number, height: number) => {
    setNatural({ width, height })
  }, [])

  /** Zoom about a point given in viewport coordinates; omit it to zoom about the centre. */
  const zoomAt = useCallback(
    (factor: number, point?: { x: number; y: number }) => {
      const next = clamp(scale * factor)
      if (next === scale) return

      const rect = viewportRef.current?.getBoundingClientRect()
      let anchorX = 0
      let anchorY = 0
      if (point && rect) {
        anchorX = point.x - rect.left - rect.width / 2
        anchorY = point.y - rect.top - rect.height / 2
      }

      /* Keep the content point under the anchor fixed. Derived from
       * `content = (anchor - offset) / scale` held constant across the change. */
      const ratio = 1 - next / scale
      setOffset({
        x: position.x + (anchorX - position.x) * ratio,
        y: position.y + (anchorY - position.y) * ratio,
      })
      setFreeScale(next)
      setFitted(false)
    },
    [clamp, scale, position],
  )

  const zoomIn = useCallback(() => zoomAt(step), [zoomAt, step])
  const zoomOut = useCallback(() => zoomAt(1 / step), [zoomAt, step])

  const fit = useCallback(() => {
    setFitted(true)
    setOffset({ x: 0, y: 0 })
  }, [])

  const actual = useCallback(() => {
    setFitted(false)
    setFreeScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  /* Wired natively rather than through `onWheel`, because React registers its root wheel
   * listener as passive: `preventDefault` from a React handler is ignored and warns, and
   * without it the wheel zooms the image *and* scrolls the transcript behind it. */
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {})
  wheelHandler.current = (event: WheelEvent) => {
    event.preventDefault()
    /* `deltaY` arrives in wildly different units across `deltaMode`s and trackpads, so it
     * only decides the direction and a gentle magnitude — reading it as a scale factor
     * makes one trackpad flick jump from fit to 8×. */
    const magnitude = Math.min(Math.abs(event.deltaY), 50) / 50
    const factor = event.deltaY < 0 ? 1 + magnitude * 0.5 : 1 / (1 + magnitude * 0.5)
    zoomAt(factor, { x: event.clientX, y: event.clientY })
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const listener = (event: WheelEvent) => wheelHandler.current(event)
    element.addEventListener('wheel', listener, { passive: false })
    return () => element.removeEventListener('wheel', listener)
  }, [])

  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Nothing to pan while fitted: the whole image is on screen by definition. Refusing
      // here also avoids the alternative, which is silently converting the fit scale into a
      // free one and making the image jump the instant a drag begins.
      if (event.button !== 0 || fitted) return
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: position.x,
        offsetY: position.y,
      }
      setPanning(true)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // jsdom, and pointers the browser has already lost. Panning inside the element
        // still works; only tracking past its edge is given up.
      }
    },
    [position, fitted],
  )

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = drag.current
    if (!start) return
    setOffset({
      x: start.offsetX + (event.clientX - start.x),
      y: start.offsetY + (event.clientY - start.y),
    })
  }, [])

  const endPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return
    drag.current = null
    setPanning(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Capture was never taken, or the browser dropped it first.
    }
  }, [])

  // Double-click flips between the two states anyone actually wants: all of it, or 1:1.
  const onDoubleClick = useCallback(() => {
    if (fitted) actual()
    else fit()
  }, [fitted, actual, fit])

  const transform = `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px) scale(${scale})`

  const viewportProps = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: endPan,
      onPointerCancel: endPan,
      onDoubleClick,
    }),
    [onPointerDown, onPointerMove, endPan, onDoubleClick],
  )

  return useMemo(
    () => ({
      viewportRef,
      setNaturalSize,
      scale,
      fitted,
      panning,
      min,
      max,
      transform,
      zoomIn,
      zoomOut,
      fit,
      actual,
      viewportProps,
    }),
    [
      setNaturalSize,
      scale,
      fitted,
      panning,
      min,
      max,
      transform,
      zoomIn,
      zoomOut,
      fit,
      actual,
      viewportProps,
    ],
  )
}
