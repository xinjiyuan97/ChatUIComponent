'use client'

import { useEffect, useRef, useState } from 'react'

export type UseSmoothTextOptions = {
  /** Baseline reveal speed. ~1000 reads as fast-but-legible for CJK and Latin alike. */
  charsPerSecond?: number
  /** When false, the target text is shown immediately with no animation. */
  enabled?: boolean
  /**
   * How long the hook aims to take to drain a backlog, in ms. Lower feels snappier but
   * makes bursty streams look uneven.
   */
  catchUpMs?: number
}

export type UseSmoothTextResult = {
  /** The text to render right now. */
  displayed: string
  /** True while characters are still being revealed — drive the caret off this. */
  isTyping: boolean
}

/**
 * Smooths bursty streaming text into an even typewriter reveal.
 *
 * Network deltas arrive in clumps: 40 characters at once, then nothing for 300ms. Rendering
 * them directly produces a visible stutter that reads as lag even when the stream is fast.
 * This hook keeps a cursor into the target text and advances it on every animation frame at
 * a rate derived from how far behind it is, so output stays continuous while never drifting
 * more than `catchUpMs` behind what the server has actually sent.
 *
 * Respects `prefers-reduced-motion` by revealing instantly.
 */
export function useSmoothText(
  text: string,
  options: UseSmoothTextOptions = {},
): UseSmoothTextResult {
  const { charsPerSecond = 900, enabled = true, catchUpMs = 350 } = options

  // Called unconditionally: `enabled && usePrefersReducedMotion()` would short-circuit the
  // hook away whenever smoothing is off, changing the hook order between renders.
  const reducedMotion = usePrefersReducedMotion()
  const active = enabled && !reducedMotion
  const [cursor, setCursor] = useState(active ? 0 : text.length)

  const cursorRef = useRef(cursor)
  cursorRef.current = cursor
  const textRef = useRef(text)
  textRef.current = text
  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  /** Fractional characters carried between frames, so slow rates still advance. */
  const remainderRef = useRef(0)

  // A target that no longer extends what we've shown means a different message: snap.
  if (!text.startsWith(text.slice(0, cursorRef.current)) || cursorRef.current > text.length) {
    cursorRef.current = 0
    remainderRef.current = 0
  }

  useEffect(() => {
    if (!active) {
      setCursor(text.length)
      return
    }
    if (cursorRef.current >= text.length) return

    function step(time: number) {
      const previous = lastTimeRef.current
      lastTimeRef.current = time
      // Clamp the delta so a backgrounded tab doesn't dump the whole buffer on return.
      const elapsed = previous === null ? 16 : Math.min(time - previous, 100)

      const target = textRef.current
      const at = cursorRef.current
      const backlog = target.length - at
      if (backlog <= 0) {
        frameRef.current = null
        lastTimeRef.current = null
        return
      }

      // Speed up proportionally to the backlog so long pauses are absorbed quickly
      // instead of accumulating an ever-growing lag.
      const rate = Math.max(charsPerSecond, (backlog * 1000) / catchUpMs)
      const advance = (rate * elapsed) / 1000 + remainderRef.current
      const whole = Math.floor(advance)
      remainderRef.current = advance - whole

      if (whole > 0) {
        const next = Math.min(at + whole, target.length)
        cursorRef.current = next
        setCursor(next)
      }
      frameRef.current = requestAnimationFrame(step)
    }

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(step)
    }

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      lastTimeRef.current = null
    }
  }, [text, active, charsPerSecond, catchUpMs])

  const clamped = Math.min(cursor, text.length)
  return {
    displayed: active ? text.slice(0, clamped) : text,
    isTyping: active && clamped < text.length,
  }
}

/** Reads the OS reduced-motion preference and tracks changes to it. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
