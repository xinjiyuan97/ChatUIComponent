'use client'

import type { ChatMessage, ToolPart as ToolPartData, ToolState } from '@xinjiyuan97/chat-core'
import { useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { formatDuration, summarizeToolInput } from '../lib/format'
import { AlertIcon, CheckIcon, SpinnerIcon, ToolIcon } from '../icons'
import { Collapsible } from '../primitives/Collapsible'
import { useChatTheme } from '../provider/ChatThemeProvider'
import type { ToolDefinition, ToolMotion, ToolTone, ToolVariant } from '../provider/tools'
import { JsonViewer } from './JsonViewer'

export type ToolCallPartProps = {
  part: ToolPartData
  message: ChatMessage
  /**
   * Overrides both the tool's own `compact` and the provider's `toolVariant`.
   *
   * `compact` drops the card and the disclosure, leaving one log-style line. A turn with
   * twenty calls in it is a list to skim, not twenty cards to read past.
   */
  variant?: ToolVariant
  className?: string
}

const RUNNING: ToolState[] = ['input-streaming', 'input-available', 'executing']

const TONE_CLASS: Record<ToolTone, string> = {
  default: 'text-cc-muted',
  accent: 'text-cc-accent',
  success: 'text-cc-success',
  warning: 'text-cc-warning',
  danger: 'text-cc-danger',
}

const MOTION_CLASS: Record<ToolMotion, string> = {
  none: '',
  spin: 'animate-cc-spin',
  pulse: 'animate-cc-pulse',
  ping: 'animate-cc-ping',
}

/**
 * One function call, collapsed to a single line.
 *
 * A transcript can contain dozens of these, so the default state is a row you can skim —
 * status, name, and the argument that identifies *which* call this is. The full payload is
 * one click away and almost never needed.
 *
 * Registering the tool name under `tools` on `ChatThemeProvider` adjusts any part of this:
 * a glyph and its motion, the label, the summary, the body, or — with `render` — the whole
 * block. Unregistered tools fall back to the generic JSON panel.
 */
export function ToolCallPart({ part, message, variant, className }: ToolCallPartProps) {
  const { tools, toolVariant, locale } = useChatTheme()
  const [open, setOpen] = useState(false)

  const def = tools[part.name]
  const Custom = def?.render
  if (Custom) return <Custom part={part} message={message} />

  const running = RUNNING.includes(part.state)
  const failed = part.state === 'output-error'
  const summary = def?.summary
    ? def.summary(part)
    : summarizeToolInput(part.input) || truncateRawInput(part.inputText)
  const duration = formatDuration(part.durationMs)
  const label = typeof def?.label === 'function' ? def.label(part) : (def?.label ?? part.name)

  const header = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-cc-xs">
      <ToolGlyphIcon definition={def} state={part.state} />
      <span
        className={cn(
          'shrink-0 font-cc-mono font-medium',
          failed ? 'text-cc-danger' : 'text-cc-fg',
        )}
      >
        {label}
      </span>
      {summary && (
        <>
          <span className="shrink-0 text-cc-faint">·</span>
          <span className="truncate font-cc-mono text-cc-muted">{summary}</span>
        </>
      )}
      {/* `text-cc-xs` on the group rather than inherited `text-cc-sm`: the timing and the
          failure flag are metadata for a row whose name and argument are already xs, and a
          larger number on the right reads as the most important thing on the line. */}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-cc-xs">
        {duration && !running && <span className="tabular-nums text-cc-faint">{duration}</span>}
        {failed && <span className="text-cc-danger">{locale.toolFailed}</span>}
      </span>
    </span>
  )

  const resolved: ToolVariant = variant ?? (def?.compact ? 'compact' : toolVariant)

  if (resolved === 'compact') {
    // No card, no disclosure, no border. The row still carries everything needed to tell
    // one call from another; what it gives up is the ability to inspect the payload, which
    // is the trade the host opted into.
    return (
      <div className={cn('flex min-w-0 items-center py-0.5', className)} data-cc-tool={part.name}>
        {header}
      </div>
    )
  }

  const body = def?.renderBody?.({ part, message })

  return (
    <div
      className={cn(
        'my-1.5 rounded-cc-sm border border-cc-border bg-cc-surface/60',
        // Failure is signalled by tinting the whole row rather than by an icon alone: a
        // failed call the reader scrolls past unnoticed is a support ticket.
        failed && 'border-cc-danger/35 bg-cc-danger-subtle/40',
        className,
      )}
      data-cc-tool={part.name}
    >
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        header={header}
        headerClassName="px-2.5"
        contentClassName="px-2.5 pb-2.5"
      >
        <div className="space-y-2.5 border-t border-cc-border pt-2.5">
          {body ?? (
            <>
              <Section title={locale.toolArguments}>
                {part.input !== undefined ? (
                  <JsonViewer value={part.input} />
                ) : (
                  // Arguments still streaming, or JSON that never parsed. Showing the raw
                  // text beats showing nothing — a truncated call is usually diagnosable
                  // from it.
                  <JsonViewer value={undefined} raw={part.inputText ?? ''} />
                )}
              </Section>

              {part.state === 'output-available' && (
                <Section title={locale.toolResult}>
                  <JsonViewer value={part.output} />
                </Section>
              )}
            </>
          )}

          {failed && (
            <Section title={locale.toolFailed}>
              <p className="whitespace-pre-wrap font-cc-mono text-cc-xs text-cc-danger">
                {part.error ?? ''}
              </p>
            </Section>
          )}
        </div>
      </Collapsible>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-cc-xs font-medium uppercase tracking-wide text-cc-faint">{title}</div>
      {children}
    </div>
  )
}

/**
 * The glyph at the head of the row: the tool's own, or the generic status icon.
 *
 * A failed call always falls back to the alert glyph, whatever the tool registered. The
 * icon is the only part of a compact row that carries status, and a friendly camera on a
 * call that blew up is the one case where honouring the registration would mislead.
 */
function ToolGlyphIcon({
  definition,
  state,
}: {
  definition: ToolDefinition | undefined
  state: ToolState
}) {
  const running = RUNNING.includes(state)
  const glyph = running ? (definition?.runningIcon ?? definition?.icon) : definition?.icon

  if (state === 'output-error' || !glyph) {
    return <StatusIcon state={state} tone={definition?.tone} />
  }

  const className = cn(
    'shrink-0',
    TONE_CLASS[definition?.tone ?? 'default'],
    // `pulse` rather than `spin` by default: rotating a glyph that has no axis — a camera,
    // a magnifier — reads as a rendering fault, not as progress.
    running && MOTION_CLASS[definition?.runningMotion ?? 'pulse'],
  )

  if (typeof glyph === 'function') {
    const Glyph = glyph
    return <Glyph size={13} className={className} />
  }
  return <span className={cn('inline-flex items-center', className)}>{glyph}</span>
}

function StatusIcon({ state, tone }: { state: ToolState; tone?: ToolTone }) {
  if (state === 'output-error') {
    return <AlertIcon size={13} className="shrink-0 text-cc-danger" />
  }
  if (state === 'output-available') {
    return <CheckIcon size={13} className="shrink-0 text-cc-success" />
  }
  if (state === 'executing' || state === 'input-streaming') {
    return <SpinnerIcon size={13} className="shrink-0 animate-cc-spin text-cc-muted" />
  }
  // Faint unless the host asked for a tone. The generic wrench belongs further back than a
  // glyph someone deliberately registered.
  return (
    <ToolIcon size={13} className={cn('shrink-0', tone ? TONE_CLASS[tone] : 'text-cc-faint')} />
  )
}

/** Falls back to the raw argument text when there is nothing parsed to summarise yet. */
function truncateRawInput(inputText: string | undefined): string {
  if (!inputText) return ''
  const collapsed = inputText.replace(/\s+/g, ' ').trim()
  return collapsed.length > 60 ? `${collapsed.slice(0, 60)}…` : collapsed
}
