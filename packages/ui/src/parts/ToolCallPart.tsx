'use client'

import type { ChatMessage, ToolPart as ToolPartData, ToolState } from '@xinjiyuan97/core'
import { useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { formatDuration, summarizeToolInput } from '../lib/format'
import { AlertIcon, CheckIcon, SpinnerIcon, ToolIcon } from '../icons'
import { Collapsible } from '../primitives/Collapsible'
import { useChatTheme } from '../provider/ChatThemeProvider'
import { JsonViewer } from './JsonViewer'

export type ToolCallPartProps = {
  part: ToolPartData
  message: ChatMessage
  className?: string
}

const RUNNING: ToolState[] = ['input-streaming', 'input-available', 'executing']

/**
 * One function call, collapsed to a single line.
 *
 * A transcript can contain dozens of these, so the default state is a row you can skim —
 * status, name, and the argument that identifies *which* call this is. The full payload is
 * one click away and almost never needed.
 *
 * Registering a renderer for a tool name in `ChatThemeProvider` replaces this entirely;
 * that is the intended way to make a `search` call render as results rather than as JSON.
 */
export function ToolCallPart({ part, message, className }: ToolCallPartProps) {
  const { toolRenderers, locale } = useChatTheme()
  const [open, setOpen] = useState(false)

  const Custom = toolRenderers[part.name]
  if (Custom) return <Custom part={part} message={message} />

  const running = RUNNING.includes(part.state)
  const failed = part.state === 'output-error'
  const summary = summarizeToolInput(part.input) || truncateRawInput(part.inputText)
  const duration = formatDuration(part.durationMs)

  const header = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <StatusIcon state={part.state} />
      <span className="shrink-0 font-cc-mono text-cc-xs font-medium text-cc-fg">{part.name}</span>
      {summary && (
        <>
          <span className="shrink-0 text-cc-faint">·</span>
          <span className="truncate font-cc-mono text-cc-xs text-cc-muted">{summary}</span>
        </>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {duration && !running && <span className="tabular-nums text-cc-faint">{duration}</span>}
        {failed && <span className="text-cc-danger">{locale.toolFailed}</span>}
      </span>
    </span>
  )

  return (
    <div
      className={cn(
        'my-1.5 rounded-cc-sm border border-cc-border bg-cc-surface/60',
        // Failure is signalled by tinting the whole row rather than by an icon alone: a
        // failed call the reader scrolls past unnoticed is a support ticket.
        failed && 'border-cc-danger/35 bg-cc-danger-subtle/40',
        className,
      )}
    >
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        header={header}
        headerClassName="px-2.5"
        contentClassName="px-2.5 pb-2.5"
      >
        <div className="space-y-2.5 border-t border-cc-border pt-2.5">
          <Section title={locale.toolArguments}>
            {part.input !== undefined ? (
              <JsonViewer value={part.input} />
            ) : (
              // Arguments still streaming, or JSON that never parsed. Showing the raw text
              // beats showing nothing — a truncated call is usually diagnosable from it.
              <JsonViewer value={undefined} raw={part.inputText ?? ''} />
            )}
          </Section>

          {part.state === 'output-available' && (
            <Section title={locale.toolResult}>
              <JsonViewer value={part.output} />
            </Section>
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

function StatusIcon({ state }: { state: ToolState }) {
  if (state === 'output-error') {
    return <AlertIcon size={13} className="shrink-0 text-cc-danger" />
  }
  if (state === 'output-available') {
    return <CheckIcon size={13} className="shrink-0 text-cc-success" />
  }
  if (state === 'executing' || state === 'input-streaming') {
    return <SpinnerIcon size={13} className="shrink-0 animate-cc-spin text-cc-muted" />
  }
  return <ToolIcon size={13} className="shrink-0 text-cc-faint" />
}

/** Falls back to the raw argument text when there is nothing parsed to summarise yet. */
function truncateRawInput(inputText: string | undefined): string {
  if (!inputText) return ''
  const collapsed = inputText.replace(/\s+/g, ' ').trim()
  return collapsed.length > 60 ? `${collapsed.slice(0, 60)}…` : collapsed
}
