'use client'

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import {
  DEFAULT_PERMISSION_OPTIONS,
  type PermissionOption,
  type PermissionRequest,
  type PermissionResolution,
} from '../types'

export type UsePermissionMenuOptions = {
  request: PermissionRequest
  /**
   * Controlled resolution. Present means the request is settled and the menu stops
   * accepting input — a host that persists approvals server-side re-renders with this.
   */
  resolution?: PermissionResolution
  /** Overrides both `request.options` and the three built-ins. */
  options?: PermissionOption[]
  onDecide?: (resolution: PermissionResolution) => void
  /** Escape picks the first `deny` option. On by default. */
  denyOnEscape?: boolean
}

export type UsePermissionMenuResult = {
  options: PermissionOption[]
  /** Index of the option under the cursor. Never points at a disabled option. */
  activeIndex: number
  setActiveIndex: (index: number) => void
  activeOption: PermissionOption | undefined
  resolution: PermissionResolution | undefined
  settled: boolean
  reason: string
  setReason: (reason: string) => void
  /** The active option opens a reason field, so the view should render one. */
  promptingForReason: boolean
  /**
   * Bumped each time the user *chooses* an option that opens the reason field — as
   * opposed to merely arrowing onto it. The view focuses the field on a change, which is
   * the distinction that keeps ↑↓ working past the deny row: landing on it must not drop
   * the caret into a textarea that then swallows the arrow keys.
   */
  promptSeq: number
  /** That field is mandatory and still empty. */
  needsReason: boolean
  canSubmit: boolean
  /** Moves the cursor and, unless the option asks for a reason, commits immediately. */
  choose: (index: number) => void
  /** Commits whatever the cursor is on. */
  submit: () => void
  /** Attach to the menu container. Handles ↑↓, Home/End, 1–9, Enter and Escape. */
  onKeyDown: (event: KeyboardEvent) => void
  /**
   * True when the last cursor move came from the keyboard, so the view knows whether it
   * may steal focus. Mouse hover moves the cursor too, and following it with `.focus()`
   * would fight the user's pointer.
   */
  focusActive: boolean
}

/**
 * State machine for an approval prompt.
 *
 * Modelled on the terminal menu rather than on a form: the options are the whole
 * interaction, number keys commit directly, and Escape is a real answer ("no") rather
 * than a dismissal. An approval prompt that can be dismissed without answering is a
 * prompt the agent will wait on forever.
 */
export function usePermissionMenu(options: UsePermissionMenuOptions): UsePermissionMenuResult {
  const {
    request,
    resolution: controlledResolution,
    options: optionsOverride,
    onDecide,
    denyOnEscape = true,
  } = options

  const resolved = useMemo<PermissionOption[]>(
    () => optionsOverride ?? request.options ?? DEFAULT_PERMISSION_OPTIONS,
    [optionsOverride, request.options],
  )

  const [localResolution, setLocalResolution] = useState<PermissionResolution | undefined>()
  const resolution = controlledResolution ?? localResolution
  const settled = resolution !== undefined

  const firstEnabled = resolved.findIndex((option) => !option.disabled)
  const [activeIndex, setActiveIndexState] = useState(firstEnabled === -1 ? 0 : firstEnabled)
  const [reason, setReason] = useState('')
  const [focusActive, setFocusActive] = useState(false)
  const [promptSeq, setPromptSeq] = useState(0)

  /* Guards the window between committing and the host re-rendering with a resolution: in
   * controlled mode `settled` is still false for that render, and a second Enter would
   * fire `onDecide` twice for one action. */
  const committed = useRef(false)

  const activeOption = resolved[activeIndex]
  const promptingForReason = activeOption?.promptForReason === true
  const needsReason =
    promptingForReason && activeOption?.requiresReason === true && reason.trim() === ''
  const canSubmit = !settled && activeOption !== undefined && !activeOption.disabled && !needsReason

  const setActiveIndex = useCallback((index: number) => {
    setFocusActive(false)
    setActiveIndexState(index)
  }, [])

  const commit = useCallback(
    (option: PermissionOption) => {
      if (settled || committed.current || option.disabled) return
      if (option.promptForReason && option.requiresReason && reason.trim() === '') return

      const next: PermissionResolution = {
        requestId: request.id,
        option: option.value,
        decision: option.decision,
        reason: reason.trim() || undefined,
        decidedAt: Date.now(),
      }
      committed.current = true
      if (controlledResolution === undefined) setLocalResolution(next)
      onDecide?.(next)
    },
    [controlledResolution, onDecide, reason, request.id, settled],
  )

  const submit = useCallback(() => {
    if (activeOption) commit(activeOption)
  }, [activeOption, commit])

  /**
   * Moves the cursor and commits in one gesture — this is what a number key does.
   * An option that asks for a reason only takes the cursor; the view then shows the field
   * and `submit` finishes the job.
   */
  const choose = useCallback(
    (index: number) => {
      const option = resolved[index]
      if (!option || option.disabled) return
      setActiveIndexState(index)
      if (option.promptForReason) {
        setPromptSeq((seq) => seq + 1)
        return
      }
      commit(option)
    },
    [commit, resolved],
  )

  const step = useCallback(
    (delta: number) => {
      setFocusActive(true)
      setActiveIndexState((current) => {
        // Walk past disabled options rather than landing on one and dead-ending.
        for (let i = 1; i <= resolved.length; i++) {
          const next = (current + delta * i + resolved.length * i) % resolved.length
          if (!resolved[next]?.disabled) return next
        }
        return current
      })
    },
    [resolved],
  )

  const edge = useCallback(
    (from: 'start' | 'end') => {
      setFocusActive(true)
      const indices = resolved
        .map((_, index) => index)
        .filter((index) => !resolved[index]?.disabled)
      const next = from === 'start' ? indices[0] : indices[indices.length - 1]
      if (next !== undefined) setActiveIndexState(next)
    },
    [resolved],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (settled) return
      // Escape while an IME is composing closes the candidate window; treating it as a
      // denial would answer the prompt on the user's behalf mid-word.
      if (event.nativeEvent.isComposing) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        step(1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        step(-1)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        edge('start')
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        edge('end')
        return
      }
      if (event.key === 'Escape') {
        if (!denyOnEscape) return
        const index = resolved.findIndex((option) => option.decision === 'deny' && !option.disabled)
        if (index === -1) return
        event.preventDefault()
        setFocusActive(true)
        choose(index)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
        return
      }

      // Number keys are the terminal menu's muscle memory: `2` means "the second one",
      // not "type a 2".
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (index >= resolved.length) return
        event.preventDefault()
        setFocusActive(true)
        choose(index)
      }
    },
    [choose, denyOnEscape, edge, resolved, settled, step, submit],
  )

  return {
    options: resolved,
    activeIndex,
    setActiveIndex,
    activeOption,
    resolution,
    settled,
    reason,
    setReason,
    promptingForReason,
    promptSeq,
    needsReason,
    canSubmit,
    choose,
    submit,
    onKeyDown,
    focusActive,
  }
}
