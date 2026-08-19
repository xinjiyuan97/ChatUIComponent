'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

export type UseAutoResizeTextareaOptions = {
  value: string
  minRows?: number
  maxRows?: number
}

/** `useLayoutEffect` warns during SSR; fall back to `useEffect` on the server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Grows a textarea with its content, up to `maxRows`, then scrolls.
 *
 * Resizing runs in a layout effect so the new height is committed in the same frame as
 * the text — doing it in a passive effect makes the box visibly lag a keystroke behind.
 */
export function useAutoResizeTextarea(options: UseAutoResizeTextareaOptions) {
  const { value, minRows = 1, maxRows = 12 } = options
  const ref = useRef<HTMLTextAreaElement | null>(null)

  const resize = useCallback(() => {
    const element = ref.current
    if (!element) return

    const styles = window.getComputedStyle(element)
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20
    const paddingY =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom) || 0
    const borderY =
      Number.parseFloat(styles.borderTopWidth) + Number.parseFloat(styles.borderBottomWidth) || 0

    // Collapse first so `scrollHeight` reflects the content, not the previous height.
    element.style.height = 'auto'
    const min = lineHeight * minRows + paddingY + borderY
    const max = lineHeight * maxRows + paddingY + borderY
    const next = Math.min(Math.max(element.scrollHeight + borderY, min), max)

    element.style.height = `${next}px`
    element.style.overflowY = element.scrollHeight + borderY > max ? 'auto' : 'hidden'
  }, [minRows, maxRows])

  useIsomorphicLayoutEffect(resize, [value, resize])

  // Font loading and container width changes both alter wrapping.
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [resize])

  return { ref, resize }
}
