'use client'

import { useCallback, useMemo, useState } from 'react'

import type { Reaction } from '../types'

export type UseReactionsOptions = {
  /** Controlled value. Omit to let the hook own the state. */
  reactions?: Reaction[]
  defaultReactions?: Reaction[]
  /**
   * Called with the next list whenever a reaction is toggled. In controlled mode this is
   * the only way state changes; the hook itself never mutates.
   */
  onChange?: (reactions: Reaction[], toggled: Reaction) => void
  /**
   * Keys that behave like a radio group — applying one clears the others. Defaults to
   * like/dislike, since rating a reply both helpful and unhelpful is meaningless.
   */
  exclusiveGroups?: string[][]
}

export type UseReactionsResult = {
  reactions: Reaction[]
  isActive: (key: string) => boolean
  countOf: (key: string) => number
  toggle: (key: string) => void
}

const DEFAULT_EXCLUSIVE = [['like', 'dislike']]

/**
 * Reaction state, optimistic by construction.
 *
 * The UI flips immediately and `onChange` reports the result; a host that persists
 * reactions server-side re-renders with its own value and wins. Waiting for a round trip
 * before showing a thumbs-up makes the button feel broken.
 */
export function useReactions(options: UseReactionsOptions = {}): UseReactionsResult {
  const {
    reactions: controlled,
    defaultReactions = [],
    onChange,
    exclusiveGroups = DEFAULT_EXCLUSIVE,
  } = options

  const [uncontrolled, setUncontrolled] = useState<Reaction[]>(defaultReactions)
  const reactions = controlled ?? uncontrolled

  const byKey = useMemo(() => {
    const map = new Map<string, Reaction>()
    for (const reaction of reactions) map.set(reaction.key, reaction)
    return map
  }, [reactions])

  const toggle = useCallback(
    (key: string) => {
      const current = byKey.get(key)
      const nextActive = !current?.active
      const siblings = exclusiveGroups.find((group) => group.includes(key)) ?? []

      const next: Reaction[] = []
      let seen = false

      for (const reaction of reactions) {
        if (reaction.key === key) {
          seen = true
          next.push(applyToggle(reaction, nextActive))
          continue
        }
        // Turning one member of an exclusive group on turns the rest off.
        if (nextActive && siblings.includes(reaction.key) && reaction.active) {
          next.push(applyToggle(reaction, false))
          continue
        }
        next.push(reaction)
      }

      if (!seen) next.push({ key, active: true, count: 1 })

      const toggled = next.find((reaction) => reaction.key === key) as Reaction
      if (controlled === undefined) setUncontrolled(next)
      onChange?.(next, toggled)
    },
    [byKey, controlled, exclusiveGroups, onChange, reactions],
  )

  return {
    reactions,
    isActive: (key) => byKey.get(key)?.active === true,
    countOf: (key) => byKey.get(key)?.count ?? 0,
    toggle,
  }
}

function applyToggle(reaction: Reaction, active: boolean): Reaction {
  if (reaction.count === undefined) return { ...reaction, active }
  // Only adjust the count for the current user's own vote; the base count is the host's.
  const delta = active === reaction.active ? 0 : active ? 1 : -1
  return { ...reaction, active, count: Math.max(0, reaction.count + delta) }
}
