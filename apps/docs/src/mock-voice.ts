'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { VoiceController, VoiceInputMode } from '@agent-chat/core'

/* A sentence dictated one fragment at a time, the way a recogniser actually returns it. */
const FRAGMENTS = [
  '帮我看一下',
  '登录接口',
  '偶发 401 的问题，',
  '日志里没有明显的异常，',
  '但监控上能看到重试率变高了。',
]

export type MockVoiceOptions = {
  mode?: VoiceInputMode
  /** Milliseconds between fragments. */
  interval?: number
  supported?: boolean
}

/**
 * A `VoiceController` that types instead of listening.
 *
 * The real hook needs a microphone permission and, in native mode, a Chromium build — no
 * combination of which is available in a headless story run. This fake drives the exact
 * same interface so the composer's recording UI can be looked at (and snapshotted) without
 * anyone having to say anything out loud at their desk.
 */
export function useMockVoice(options: MockVoiceOptions = {}): VoiceController {
  const { mode = 'native', interval = 700, supported = true } = options

  const [state, setState] = useState<VoiceController['state']>('idle')
  const [transcript, setTranscript] = useState('')
  const [level, setLevel] = useState(0)

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const frame = useRef<number | null>(null)
  const index = useRef(0)

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    setLevel(0)
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const start = useCallback(() => {
    if (state !== 'idle') return
    clearTimers()
    index.current = 0
    setTranscript('')
    setState('listening')

    /* Native mode streams interim text; recorder mode shows nothing until the upload
     * comes back, which is the difference worth seeing side by side. */
    if (mode === 'native') {
      FRAGMENTS.forEach((fragment, position) => {
        timers.current.push(
          setTimeout(
            () => {
              index.current = position + 1
              setTranscript(FRAGMENTS.slice(0, position + 1).join(''))
            },
            interval * (position + 1),
          ),
        )
      })
    } else {
      // A sine sweep stands in for a voice, so the level meter has something to move to.
      const started = performance.now()
      const tick = () => {
        const elapsed = (performance.now() - started) / 1000
        setLevel(
          0.25 + 0.35 * Math.abs(Math.sin(elapsed * 2.4)) + 0.2 * Math.abs(Math.sin(elapsed * 7)),
        )
        frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }
  }, [clearTimers, interval, mode, state])

  const stop = useCallback(() => {
    if (state !== 'listening') return
    clearTimers()

    if (mode === 'native') {
      setState('idle')
      return
    }

    setState('transcribing')
    timers.current.push(
      setTimeout(() => {
        setTranscript(FRAGMENTS.join(''))
        setState('idle')
      }, 1200),
    )
  }, [clearTimers, mode, state])

  const cancel = useCallback(() => {
    clearTimers()
    setTranscript('')
    setState('idle')
  }, [clearTimers])

  const toggle = useCallback(() => {
    if (state === 'listening') stop()
    else start()
  }, [start, state, stop])

  return { supported, mode, state, transcript, level, start, stop, cancel, toggle }
}
