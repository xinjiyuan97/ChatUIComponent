'use client'

import type { A2UIComponentProps } from '@xinjiyuan97/chat-a2ui'
import type { FormEvent } from 'react'

import { cn } from '../lib/cn'
import { bool, num, oneOf, optionalStr, str } from './props'

const GAPS = { none: 'gap-0', xs: 'gap-1', sm: 'gap-2', md: 'gap-3', lg: 'gap-5' } as const
const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const
const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const

type GapKey = keyof typeof GAPS

function gapClass(value: unknown, fallback: GapKey): string {
  return GAPS[oneOf(value, Object.keys(GAPS) as GapKey[], fallback)]
}

/**
 * A framed group of content.
 *
 * Cards use the same hairline-and-faint-fill treatment as the reasoning and tool blocks
 * rather than a raised panel — an agent-generated card sits inside a reply, and a
 * shadowed box there reads as a modal interrupting the conversation.
 */
export function Card({ props, children }: A2UIComponentProps) {
  const title = optionalStr(props['title'])
  const subtitle = optionalStr(props['subtitle'])
  const padded = bool(props['padded'], true)

  return (
    <section
      className={cn(
        'rounded-cc-md border border-cc-border bg-cc-surface',
        padded ? 'p-3.5' : 'p-0',
      )}
    >
      {(title || subtitle) && (
        <header className={cn('mb-2.5', !padded && 'px-3.5 pt-3.5')}>
          {title && <h3 className="text-cc-sm font-medium text-cc-fg">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-cc-xs text-cc-muted">{subtitle}</p>}
        </header>
      )}
      <div className={cn('flex flex-col gap-2.5', !padded && !title && !subtitle && 'p-3.5')}>
        {children}
      </div>
    </section>
  )
}

/** Horizontal stack. Wraps by default — an agent has no idea how wide the host is. */
export function Row({ props, children }: A2UIComponentProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-row',
        bool(props['wrap'], true) && 'flex-wrap',
        gapClass(props['gap'], 'sm'),
        ALIGN[oneOf(props['align'], Object.keys(ALIGN) as Array<keyof typeof ALIGN>, 'center')],
        JUSTIFY[
          oneOf(props['justify'], Object.keys(JUSTIFY) as Array<keyof typeof JUSTIFY>, 'start')
        ],
      )}
    >
      {children}
    </div>
  )
}

/** Vertical stack. */
export function Column({ props, children }: A2UIComponentProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        gapClass(props['gap'], 'sm'),
        ALIGN[oneOf(props['align'], Object.keys(ALIGN) as Array<keyof typeof ALIGN>, 'stretch')],
      )}
    >
      {children}
    </div>
  )
}

export function Divider({ props }: A2UIComponentProps) {
  const label = optionalStr(props['label'])
  if (!label) return <hr className="my-1 border-0 border-t border-cc-border" />

  return (
    <div className="my-1 flex items-center gap-2">
      <hr className="flex-1 border-0 border-t border-cc-border" />
      <span className="text-cc-xs text-cc-faint">{label}</span>
      <hr className="flex-1 border-0 border-t border-cc-border" />
    </div>
  )
}

/** Fixed vertical space, for specs that want to control rhythm explicitly. */
export function Spacer({ props }: A2UIComponentProps) {
  return <div aria-hidden="true" style={{ height: `${num(props['size'], 8)}px` }} />
}

/**
 * A submit wrapper.
 *
 * Form state lives in the renderer, not here: every named input writes into the surface's
 * shared `values`, and submitting sends the whole bag. That is why an agent can render a
 * five-field form and get one round trip instead of five.
 */
export function Form({ props, children, ctx }: A2UIComponentProps) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (ctx.disabled) return
    ctx.emit(props['onSubmit'] ?? { action: str(props['action'], 'submit') })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {children}
    </form>
  )
}

/** Label + control + help/error text, the shape most agent forms actually want. */
export function Field({ props, children }: A2UIComponentProps) {
  const label = optionalStr(props['label'])
  const help = optionalStr(props['help'])
  const error = optionalStr(props['error'])

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-cc-xs font-medium text-cc-muted">
          {label}
          {bool(props['required']) && <span className="ml-0.5 text-cc-danger">*</span>}
        </span>
      )}
      {children}
      {(error || help) && (
        <span className={cn('text-cc-xs', error ? 'text-cc-danger' : 'text-cc-faint')}>
          {error ?? help}
        </span>
      )}
    </div>
  )
}
