'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export type UseStickToBottomOptions = {
  /** Distance from the bottom, in px, still considered "at the bottom". */
  threshold?: number
  /** Whether to follow new content on mount. */
  initial?: boolean
}

export type UseStickToBottomResult<T extends HTMLElement = HTMLDivElement> = {
  /** Attach to the scrollable element. */
  scrollRef: RefObject<T | null>
  /** Attach to the element that wraps the messages, so growth can be observed. */
  contentRef: RefObject<HTMLDivElement | null>
  isAtBottom: boolean
  scrollToBottom: (behavior?: ScrollBehavior) => void
}

/**
 * Keeps a scroll container pinned to the bottom while content streams in, and lets go
 * the moment the user scrolls up.
 *
 * The "let go" behaviour is the whole point: yanking someone back to the bottom while
 * they are reading earlier output is the single most irritating bug in chat UIs.
 */
export function useStickToBottom<T extends HTMLElement = HTMLDivElement>(
  options: UseStickToBottomOptions = {},
): UseStickToBottomResult<T> {
  const { threshold = 48, initial = true } = options

  const scrollRef = useRef<T | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(initial)

  /** Mirrors state for use inside observers without re-subscribing. */
  const stickingRef = useRef(initial)
  /**
   * Set while we scroll programmatically. Browsers fire `scroll` before layout settles,
   * and reading the position then can momentarily report "not at bottom", which would
   * disengage sticking for no reason.
   */
  const autoScrollingRef = useRef(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const element = scrollRef.current
    if (!element) return
    autoScrollingRef.current = true
    element.scrollTo({ top: element.scrollHeight, behavior })
    stickingRef.current = true
    setIsAtBottom(true)
    // One frame is enough for an instant scroll; smooth scrolls keep the flag until the
    // next user-initiated event clears it below.
    requestAnimationFrame(() => {
      autoScrollingRef.current = false
    })
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const measure = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      return distance <= threshold
    }

    const onScroll = () => {
      if (autoScrollingRef.current) return
      const atBottom = measure()
      if (atBottom !== stickingRef.current) {
        stickingRef.current = atBottom
        setIsAtBottom(atBottom)
      }
    }

    // A wheel or touch gesture is unambiguous user intent, so trust it over the
    // position heuristic and release immediately.
    const onUserScroll = (event: Event) => {
      autoScrollingRef.current = false
      if (event.type === 'wheel' && (event as WheelEvent).deltaY >= 0) return
      if (stickingRef.current && !measure()) {
        stickingRef.current = false
        setIsAtBottom(false)
      }
    }

    element.addEventListener('scroll', onScroll, { passive: true })
    element.addEventListener('wheel', onUserScroll, { passive: true })
    element.addEventListener('touchmove', onUserScroll, { passive: true })

    if (initial) {
      element.scrollTop = element.scrollHeight
    }

    // Follow content growth only while sticking. `instant` avoids queueing dozens of
    // smooth animations during a fast stream.
    const content = contentRef.current
    let observer: ResizeObserver | undefined
    if (content && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (!stickingRef.current) return
        autoScrollingRef.current = true
        element.scrollTop = element.scrollHeight
        requestAnimationFrame(() => {
          autoScrollingRef.current = false
        })
      })
      observer.observe(content)
    }

    return () => {
      element.removeEventListener('scroll', onScroll)
      element.removeEventListener('wheel', onUserScroll)
      element.removeEventListener('touchmove', onUserScroll)
      observer?.disconnect()
    }
  }, [threshold, initial])

  return { scrollRef, contentRef, isAtBottom, scrollToBottom }
}
