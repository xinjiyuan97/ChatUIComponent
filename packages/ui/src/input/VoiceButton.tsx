'use client'

import type { VoiceController } from '@xinjiyuan97/chat-core'

import { cn } from '../lib/cn'
import { CloseIcon, MicIcon, SpinnerIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

export type VoiceButtonProps = {
  voice: VoiceController
  disabled?: boolean
  className?: string
}

/**
 * Mic toggle for the composer.
 *
 * Renders nothing when the browser cannot do it: a permanently greyed-out mic reads as a
 * broken feature, while its absence reads as a feature this browser does not have.
 */
export function VoiceButton({ voice, disabled, className }: VoiceButtonProps) {
  const locale = useLocale()
  if (!voice.supported) return null

  const listening = voice.state === 'listening'
  const transcribing = voice.state === 'transcribing'

  return (
    <button
      type="button"
      onClick={voice.toggle}
      disabled={disabled || transcribing}
      aria-label={listening ? locale.voiceStop : locale.voiceStart}
      aria-pressed={listening}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-cc-sm',
        'transition-colors duration-150 ease-cc',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        'disabled:pointer-events-none disabled:opacity-50',
        listening
          ? 'bg-cc-danger/10 text-cc-danger'
          : 'text-cc-muted hover:bg-cc-subtle hover:text-cc-fg',
        className,
      )}
    >
      {transcribing ? <SpinnerIcon size={15} className="animate-cc-spin" /> : <MicIcon size={16} />}
    </button>
  )
}

export type VoiceStatusProps = {
  voice: VoiceController
  className?: string
}

/**
 * The recording strip that replaces the toolbar while the mic is open.
 *
 * It exists mostly to make stopping obvious. A mic with no visible state is the fastest
 * way to leave a user recording without realising it.
 */
export function VoiceStatus({ voice, className }: VoiceStatusProps) {
  const locale = useLocale()
  const listening = voice.state === 'listening'

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-cc-xs',
          listening ? 'text-cc-danger' : 'text-cc-muted',
        )}
      >
        {listening && (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-cc-ping rounded-cc-full bg-cc-danger opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-cc-full bg-cc-danger" />
          </span>
        )}
        {listening ? locale.voiceListening : locale.voiceTranscribing}
      </span>

      {listening && <LevelMeter level={voice.level} />}

      {/* The live transcript, so the user can see the recogniser keeping up. */}
      {voice.transcript && (
        <span className="min-w-0 flex-1 truncate text-cc-xs text-cc-faint">{voice.transcript}</span>
      )}

      {listening && (
        <button
          type="button"
          onClick={voice.cancel}
          aria-label={locale.voiceCancel}
          className={cn(
            'ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-cc-sm',
            'text-cc-muted transition-colors duration-150 ease-cc',
            'hover:bg-cc-subtle hover:text-cc-fg',
            'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          )}
        >
          <CloseIcon size={11} />
        </button>
      )}
    </div>
  )
}

/* Bars are laid out from a fixed table rather than generated, so the shape stays the same
 * frame to frame and only the heights move. */
const BAR_WEIGHTS = [0.45, 0.75, 1, 0.8, 0.5]

function LevelMeter({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="flex h-4 shrink-0 items-center gap-[3px]">
      {BAR_WEIGHTS.map((weight, index) => (
        <span
          key={index}
          className="w-[3px] rounded-cc-full bg-cc-danger/70 transition-[height] duration-75 ease-linear motion-reduce:transition-none"
          /* A floor of 3px keeps the meter visible in silence; without it the bars vanish
           * and the control looks dead rather than idle. */
          style={{ height: `${3 + level * weight * 13}px` }}
        />
      ))}
    </span>
  )
}
