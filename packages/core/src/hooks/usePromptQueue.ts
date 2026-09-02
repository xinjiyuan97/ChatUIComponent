'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { generateId } from '../id'
import type { MessagePart, QuotedMessage } from '../types'

export type QueuedPrompt = {
  id: string
  text: string
  /**
   * Attachments as they were when the prompt was queued.
   *
   * Captured here rather than read at send time on purpose: by the time this item's turn
   * comes round the composer has been cleared and possibly refilled, and pulling the
   * attachments then would staple the wrong files to the wrong message.
   */
  parts?: MessagePart[]
  quote?: QuotedMessage
  createdAt: number
}

export type EnqueueOptions = {
  parts?: MessagePart[]
  quote?: QuotedMessage
}

export type PromptQueueController = {
  items: QueuedPrompt[]
  size: number
  /** No-ops on empty text with no parts, mirroring the composer's own submit guard. */
  enqueue: (text: string, options?: EnqueueOptions) => void
  remove: (id: string) => void
  update: (id: string, text: string) => void
  clear: () => void
  /** True while the head of the queue is in flight. */
  draining: boolean
  /** True while auto-draining is suspended. See `hold`. */
  held: boolean
  /**
   * Suspends auto-draining without discarding anything.
   *
   * This is what "stop" must do. Interrupting a turn and having the next queued message
   * fire off half a second later is not an interruption at all — the user would have to
   * hit stop once per queued item to actually make it quiet.
   */
  hold: () => void
  resume: () => void
}

export type UsePromptQueueOptions = {
  /** Whether the agent is busy. Pass `chat.isLoading`. */
  busy: boolean
  /**
   * Called for each prompt as it leaves the queue. The returned promise decides when the
   * next one goes — resolve it when the turn is genuinely finished.
   */
  onSend: (item: QueuedPrompt) => void | Promise<void>
  /** Turns off auto-draining, leaving the queue as a staging area. On by default. */
  autoDrain?: boolean
}

/**
 * Messages the user wrote while the agent was still answering.
 *
 * Typing a follow-up before the current turn finishes is the normal way people use a chat
 * agent, and the alternatives are both bad: dropping the input loses their words, sending
 * it immediately interleaves two turns. Queueing keeps the text and preserves the order.
 *
 * Draining is sequential and driven by the promise `onSend` returns rather than by
 * watching `busy` flip. `store.send` only resolves once its whole stream has finished, so
 * awaiting it is an exact "the previous turn is done" signal; inferring the same thing
 * from a busy flag means racing whatever sets it.
 */
export function usePromptQueue(options: UsePromptQueueOptions): PromptQueueController {
  const { busy, autoDrain = true } = options

  const [items, setItems] = useState<QueuedPrompt[]>([])
  const [tick, setTick] = useState(0)
  const [held, setHeld] = useState(false)

  /* Read through a ref so a host that rebuilds `onSend` every render — the common case,
   * since it usually closes over `chat` — does not retrigger the drain effect. */
  const onSend = useRef(options.onSend)
  onSend.current = options.onSend

  /** Guards against a second drain starting while the first is still in flight. */
  const draining = useRef(false)
  const [drainingState, setDrainingState] = useState(false)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const enqueue = useCallback((text: string, enqueueOptions?: EnqueueOptions) => {
    const trimmed = text.trim()
    const parts = enqueueOptions?.parts
    if (!trimmed && (!parts || parts.length === 0)) return

    setItems((list) => [
      ...list,
      {
        id: generateId('queued'),
        text: trimmed,
        ...(parts && parts.length > 0 ? { parts } : {}),
        ...(enqueueOptions?.quote ? { quote: enqueueOptions.quote } : {}),
        createdAt: Date.now(),
      },
    ])
  }, [])

  const remove = useCallback((id: string) => {
    setItems((list) => list.filter((item) => item.id !== id))
  }, [])

  const update = useCallback((id: string, text: string) => {
    const trimmed = text.trim()
    // An empty edit removes the item. Leaving a blank row in the queue would send an
    // empty turn later, which the transport would reject anyway.
    setItems((list) =>
      trimmed
        ? list.map((item) => (item.id === id ? { ...item, text: trimmed } : item))
        : list.filter((item) => item.id !== id),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])
  const hold = useCallback(() => setHeld(true), [])
  const resume = useCallback(() => setHeld(false), [])

  useEffect(() => {
    if (!autoDrain || held || busy || draining.current || items.length === 0) return

    const [next, ...rest] = items
    if (!next) return

    draining.current = true
    setDrainingState(true)
    // Removed before the send, not after: if `onSend` throws, the item must not be
    // retried forever, and the user can still see what happened in the transcript.
    setItems(rest)

    Promise.resolve()
      .then(() => onSend.current(next))
      .catch(() => {
        // Swallowed deliberately. A failed turn is the host's to surface — the queue's
        // only job is to not wedge itself on one.
      })
      .finally(() => {
        draining.current = false
        if (!mounted.current) return
        setDrainingState(false)
        /* Bumping state here is what keeps the queue moving. A ref change causes no
         * render, and `busy` is not guaranteed to have toggled — a host whose `onSend`
         * returns synchronously never flips it — so without this the second item would
         * sit there until something else happened to re-render. */
        setTick((value) => value + 1)
      })
  }, [autoDrain, busy, held, items, tick])

  return useMemo(
    () => ({
      items,
      size: items.length,
      enqueue,
      remove,
      update,
      clear,
      draining: drainingState,
      held,
      hold,
      resume,
    }),
    [items, enqueue, remove, update, clear, drainingState, held, hold, resume],
  )
}
