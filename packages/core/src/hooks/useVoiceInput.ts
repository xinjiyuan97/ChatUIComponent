'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Minimal shape of the Web Speech API.
 *
 * `lib.dom` still does not declare `SpeechRecognition`, and pulling in
 * `@types/dom-speech-recognition` would put a type-only dependency in every consumer's
 * install. Only the members used below are declared.
 */
type SpeechAlternative = { transcript: string }
type SpeechResult = {
  readonly length: number
  isFinal: boolean
  [index: number]: SpeechAlternative
}
type SpeechResultList = { readonly length: number; [index: number]: SpeechResult }

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

export type VoiceInputState = 'idle' | 'listening' | 'transcribing' | 'error'

/** `native` uses the browser's recogniser; `recorder` captures audio for `transcribe`. */
export type VoiceInputMode = 'native' | 'recorder'

export type UseVoiceInputOptions = {
  /** BCP-47 tag. Native mode only — a transcription service picks its own. */
  lang?: string
  /**
   * Supply this and the hook records with `MediaRecorder` and hands you the audio instead
   * of using the browser's recogniser. Return the transcript.
   *
   * Without it the hook uses the Web Speech API, which needs no backend but is Chromium-
   * and Safari-only, and in Chrome sends the audio to Google's servers for recognition.
   */
  transcribe?: (audio: Blob, context: { signal: AbortSignal }) => Promise<string>
  /** Final transcript. Fires once per session, after `stop()`. */
  onResult?: (text: string) => void
  /** Partial transcript, native mode only — use it to show text as the user speaks. */
  onInterim?: (text: string) => void
  onError?: (error: string) => void
  /** Hard stop, so a forgotten open mic does not record for an hour. Default 60s. */
  maxDurationMs?: number
  /** MIME passed to `MediaRecorder`. Ignored when the browser does not support it. */
  mimeType?: string
}

export type VoiceController = {
  /** False when neither path is available; hide the mic button rather than disabling it. */
  supported: boolean
  mode: VoiceInputMode
  state: VoiceInputState
  /** Text so far. Native mode updates it live; recorder mode fills it in at the end. */
  transcript: string
  error?: string
  /** Rough 0–1 input level, for a live meter. Recorder mode only. */
  level: number
  start: () => void
  /** Ends the session and delivers a result. */
  stop: () => void
  /** Ends the session and throws the audio away. */
  cancel: () => void
  toggle: () => void
}

const DEFAULT_MAX_DURATION = 60_000

/**
 * Speech-to-text for the composer, in two interchangeable flavours.
 *
 * Both are driven through the same `start` / `stop` / `cancel` surface so the button that
 * renders it does not need to know which one is active.
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): VoiceController {
  const {
    lang = 'zh-CN',
    transcribe,
    onResult,
    onInterim,
    onError,
    maxDurationMs = DEFAULT_MAX_DURATION,
    mimeType,
  } = options

  const mode: VoiceInputMode = transcribe ? 'recorder' : 'native'

  const [state, setState] = useState<VoiceInputState>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [level, setLevel] = useState(0)
  const [supported, setSupported] = useState(false)

  /* Detection runs in an effect, not during render: on the server both APIs are absent, so
   * rendering the button straight away would produce markup the client immediately
   * contradicts. Starting at `false` means the two agree, then the mic appears. */
  useEffect(() => {
    setSupported(
      mode === 'recorder'
        ? typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
        : getSpeechRecognition() !== undefined,
    )
  }, [mode])

  const latest = useRef({ onResult, onInterim, onError, transcribe })
  latest.current = { onResult, onInterim, onError, transcribe }

  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const meterFrame = useRef<number | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abort = useRef<AbortController | null>(null)
  /** Set by `cancel` so the recorder's `onstop` knows to drop the audio. */
  const cancelled = useRef(false)
  /** Final text accumulated across native results; interim text is not kept here. */
  const finalText = useRef('')

  const teardown = useCallback(() => {
    if (timeout.current !== null) {
      clearTimeout(timeout.current)
      timeout.current = null
    }
    if (meterFrame.current !== null) {
      cancelAnimationFrame(meterFrame.current)
      meterFrame.current = null
    }
    // Stopping the tracks is what actually turns the browser's recording indicator off.
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
    void audioContext.current?.close().catch(() => {})
    audioContext.current = null
    recorder.current = null
    recognition.current = null
    setLevel(0)
  }, [])

  useEffect(
    () => () => {
      abort.current?.abort()
      recognition.current?.abort()
      if (recorder.current?.state === 'recording') recorder.current.stop()
      teardown()
    },
    [teardown],
  )

  const fail = useCallback((message: string) => {
    setState('error')
    setError(message)
    latest.current.onError?.(message)
  }, [])

  /** Samples the analyser each frame so the UI can render a level meter. */
  const startMeter = useCallback((source: MediaStream) => {
    const Context: typeof AudioContext | undefined =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return

    const context = new Context()
    audioContext.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(source).connect(analyser)

    const buffer = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buffer)
      let sum = 0
      for (const sample of buffer) {
        const centred = (sample - 128) / 128
        sum += centred * centred
      }
      // RMS is tiny for speech; the multiplier maps a normal voice onto most of the bar.
      setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4))
      meterFrame.current = requestAnimationFrame(tick)
    }
    meterFrame.current = requestAnimationFrame(tick)
  }, [])

  const startNative = useCallback(() => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) return fail('unsupported')

    const instance = new Recognition()
    instance.lang = lang
    instance.continuous = true
    instance.interimResults = true
    instance.maxAlternatives = 1

    instance.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (!result) continue
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalText.current += text
        else interim += text
      }
      const combined = finalText.current + interim
      setTranscript(combined)
      latest.current.onInterim?.(combined)
    }

    instance.onerror = (event) => {
      // Firing `stop()` with nothing said is normal, not a failure worth surfacing.
      if (event.error === 'aborted' || event.error === 'no-speech') return
      fail(event.error)
    }

    instance.onend = () => {
      teardown()
      if (cancelled.current) {
        setState('idle')
        return
      }
      setState('idle')
      const text = finalText.current.trim()
      if (text) latest.current.onResult?.(text)
    }

    recognition.current = instance
    finalText.current = ''
    cancelled.current = false
    setTranscript('')
    setError(undefined)
    setState('listening')
    instance.start()

    timeout.current = setTimeout(() => instance.stop(), maxDurationMs)
  }, [fail, lang, maxDurationMs, teardown])

  const startRecorder = useCallback(async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media

      const supportsType =
        mimeType && typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported(mimeType)
          : false
      const instance = new MediaRecorder(media, supportsType ? { mimeType } : undefined)

      chunks.current = []
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }

      instance.onstop = () => {
        const blob = new Blob(chunks.current, { type: instance.mimeType || 'audio/webm' })
        chunks.current = []
        teardown()

        if (cancelled.current || blob.size === 0) {
          setState('idle')
          return
        }

        const controller = new AbortController()
        abort.current = controller
        setState('transcribing')

        void latest.current
          .transcribe?.(blob, { signal: controller.signal })
          .then((text) => {
            if (controller.signal.aborted) return
            setState('idle')
            setTranscript(text)
            const trimmed = text.trim()
            if (trimmed) latest.current.onResult?.(trimmed)
          })
          .catch((cause: unknown) => {
            if (controller.signal.aborted) return
            fail(cause instanceof Error ? cause.message : String(cause))
          })
      }

      recorder.current = instance
      cancelled.current = false
      setTranscript('')
      setError(undefined)
      setState('listening')
      instance.start()
      startMeter(media)

      timeout.current = setTimeout(() => {
        if (instance.state === 'recording') instance.stop()
      }, maxDurationMs)
    } catch (cause: unknown) {
      teardown()
      // A denied permission prompt lands here; it is the single most common failure.
      fail(cause instanceof Error ? cause.name : String(cause))
    }
  }, [fail, maxDurationMs, mimeType, startMeter, teardown])

  const start = useCallback(() => {
    if (state === 'listening' || state === 'transcribing') return
    if (mode === 'recorder') void startRecorder()
    else startNative()
  }, [mode, startNative, startRecorder, state])

  const stop = useCallback(() => {
    if (state !== 'listening') return
    cancelled.current = false
    if (mode === 'recorder') recorder.current?.stop()
    else recognition.current?.stop()
  }, [mode, state])

  const cancel = useCallback(() => {
    cancelled.current = true
    abort.current?.abort()
    abort.current = null

    if (mode === 'recorder') {
      if (recorder.current?.state === 'recording') recorder.current.stop()
      else teardown()
    } else {
      recognition.current?.abort()
    }

    setState('idle')
    setTranscript('')
  }, [mode, teardown])

  const toggle = useCallback(() => {
    if (state === 'listening') stop()
    else start()
  }, [start, state, stop])

  return { supported, mode, state, transcript, error, level, start, stop, cancel, toggle }
}
