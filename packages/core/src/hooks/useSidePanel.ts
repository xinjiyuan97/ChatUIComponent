'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * One thing open in the side panel.
 *
 * Deliberately says nothing about what it contains. `kind` names a renderer the host
 * registered and `data` is that renderer's payload — the panel itself never inspects
 * either, which is what lets the same column hold a file preview today and a diff, a run
 * log or a settings pane later.
 */
export type SidePanelItem<T = unknown> = {
  /** Opening this id again focuses and refreshes the existing tab rather than adding one. */
  id: string
  kind: string
  title: string
  data?: T
  /** Defaults to true. `false` is for panels that are part of the workspace, not the task. */
  closable?: boolean
}

export type SidePanelController = {
  items: SidePanelItem[]
  activeId: string | null
  active: SidePanelItem | null
  /** True while anything is open. */
  isOpen: boolean
  open: (item: SidePanelItem) => void
  close: (id: string) => void
  closeAll: () => void
  activate: (id: string) => void
  /** In-place edit for a title or payload that arrives late. Never reorders. */
  update: (id: string, patch: Partial<Omit<SidePanelItem, 'id'>>) => void
}

export type UseSidePanelOptions = {
  /** Open at these tabs on mount. */
  initialItems?: SidePanelItem[]
  /**
   * Cap on open tabs. Past it, the oldest tab that is neither active nor the incoming one
   * is evicted. Unset means no cap.
   */
  max?: number
  /** Fires on the transitions into and out of "something is open", not on every change. */
  onOpenChange?: (open: boolean) => void
}

type PanelState = {
  items: SidePanelItem[]
  activeId: string | null
}

/**
 * Tabs for the side column.
 *
 * Two behaviours here are the whole point of the hook, and both are things the obvious
 * implementation gets wrong:
 *
 * 1. **Re-opening an id focuses it in place.** Agents re-emit the same file as a run
 *    progresses. Appending a duplicate would grow the strip without bound; moving the
 *    existing tab to the end would slide the thing the user just clicked out from under
 *    the pointer.
 * 2. **Closing the active tab activates its right-hand neighbour**, falling back to the
 *    left one when it was last. Falling back to `items[0]` instead throws the user back to
 *    the first tab every time they close the fifth, which is the single most irritating
 *    thing a tab strip can do.
 *
 * The list and the selection live in one state object because every transition touches
 * both, and an agent that opens four files at once produces four calls in a single tick.
 * Split across two `useState`s, each call would compute its neighbour from a selection one
 * render out of date.
 */
export function useSidePanel(options: UseSidePanelOptions = {}): SidePanelController {
  const { max, initialItems } = options

  const [state, setState] = useState<PanelState>(() => {
    const items = initialItems ?? []
    return { items, activeId: items[0]?.id ?? null }
  })

  const open = useCallback(
    (item: SidePanelItem) => {
      setState((prev) => {
        const index = prev.items.findIndex((existing) => existing.id === item.id)
        if (index !== -1) {
          const items = [...prev.items]
          items[index] = { ...prev.items[index], ...item }
          return { items, activeId: item.id }
        }

        const appended = [...prev.items, item]
        if (max === undefined || appended.length <= max) {
          return { items: appended, activeId: item.id }
        }

        /* Over the cap. Evict the oldest tab the user is demonstrably not looking at —
         * dropping the active one would swap the panel's contents out from under them at
         * the exact moment they asked for something else to be added. */
        const victim = appended.findIndex(
          (candidate) => candidate.id !== prev.activeId && candidate.id !== item.id,
        )
        const items = victim === -1 ? appended : appended.filter((_, i) => i !== victim)
        return { items, activeId: item.id }
      })
    },
    [max],
  )

  const close = useCallback((id: string) => {
    setState((prev) => {
      const index = prev.items.findIndex((item) => item.id === id)
      if (index === -1) return prev

      const items = prev.items.filter((item) => item.id !== id)
      if (prev.activeId !== id) return { items, activeId: prev.activeId }

      // The right-hand neighbour has slid into the closed tab's index; when there is none,
      // the tab to its left is the last thing the user looked at.
      return { items, activeId: items[index]?.id ?? items[index - 1]?.id ?? null }
    })
  }, [])

  const closeAll = useCallback(() => setState({ items: [], activeId: null }), [])

  const activate = useCallback((id: string) => {
    setState((prev) =>
      // Activating something that is not open is a no-op rather than an error: the id may
      // have been closed between the render that drew the tab and the click on it.
      prev.items.some((item) => item.id === id) ? { ...prev, activeId: id } : prev,
    )
  }, [])

  const update = useCallback((id: string, patch: Partial<Omit<SidePanelItem, 'id'>>) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)),
    }))
  }, [])

  const { items, activeId } = state
  const isOpen = items.length > 0

  /* Reported from an effect rather than from inside the updaters above. React invokes
   * state updaters twice under StrictMode, so a notification fired from one would double;
   * an effect keyed on the boolean fires exactly once per real transition. */
  const onOpenChange = useRef(options.onOpenChange)
  onOpenChange.current = options.onOpenChange
  const previouslyOpen = useRef(isOpen)
  useEffect(() => {
    if (previouslyOpen.current === isOpen) return
    previouslyOpen.current = isOpen
    onOpenChange.current?.(isOpen)
  }, [isOpen])

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId],
  )

  return useMemo(
    () => ({
      items,
      activeId,
      active,
      isOpen,
      open,
      close,
      closeAll,
      activate,
      update,
    }),
    [items, activeId, active, isOpen, open, close, closeAll, activate, update],
  )
}
