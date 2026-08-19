'use client'

import { Children, isValidElement, type ComponentType, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import {
  AlertIcon,
  ImportantIcon,
  InfoIcon,
  LightbulbIcon,
  OctagonAlertIcon,
  type IconProps,
} from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import type { ChatLocale } from '../provider/locale'
import { Cited } from './Citation'

/** GitHub's alert levels, which is what models actually emit. */
export type CalloutKind = 'note' | 'tip' | 'important' | 'warning' | 'caution'

const KINDS: Record<
  CalloutKind,
  {
    icon: ComponentType<IconProps>
    /* Split into three so the bar can be solid while the fill stays faint — one opacity on
     * a single colour cannot do both without washing the bar out. */
    bar: string
    fill: string
    title: string
    label: (locale: ChatLocale) => string
  }
> = {
  note: {
    icon: InfoIcon,
    bar: 'bg-cc-accent',
    fill: 'bg-cc-accent-subtle/45',
    title: 'text-cc-accent',
    label: (locale) => locale.calloutNote,
  },
  tip: {
    icon: LightbulbIcon,
    bar: 'bg-cc-success',
    fill: 'bg-cc-success-subtle/45',
    title: 'text-cc-success',
    label: (locale) => locale.calloutTip,
  },
  important: {
    icon: ImportantIcon,
    bar: 'bg-cc-accent',
    fill: 'bg-cc-accent-subtle/45',
    title: 'text-cc-accent',
    label: (locale) => locale.calloutImportant,
  },
  warning: {
    icon: AlertIcon,
    bar: 'bg-cc-warning',
    fill: 'bg-cc-warning-subtle/45',
    title: 'text-cc-warning',
    label: (locale) => locale.calloutWarning,
  },
  caution: {
    icon: OctagonAlertIcon,
    bar: 'bg-cc-danger',
    fill: 'bg-cc-danger-subtle/45',
    title: 'text-cc-danger',
    label: (locale) => locale.calloutCaution,
  },
}

/** `> [!NOTE]` and friends, case-insensitive, optionally followed by text on the same line. */
const MARKER = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

export type BlockquoteProps = {
  children?: ReactNode
  className?: string
}

/**
 * A Markdown blockquote, which is also where callouts live.
 *
 * Two shapes from one element. A plain quote is an aside — an inset panel with a neutral
 * bar, quiet enough to skim past. A quote whose first line is `[!WARNING]` is not an aside
 * at all; it is the sentence the reader most needs, and rendering it identically to "as an
 * aside, the docs say…" buries it.
 *
 * The marker syntax is GitHub's because that is what models have been trained on: ask any
 * of them for a warning callout and `> [!WARNING]` is what comes back. Unrecognised
 * markers fall through to a plain quote with the text intact, so a hallucinated
 * `[!DANGER]` degrades to something readable rather than to a stray literal.
 */
export function Blockquote({ children, className }: BlockquoteProps) {
  const locale = useLocale()
  const parsed = extractKind(children)

  if (!parsed) {
    return (
      <blockquote
        className={cn(
          'my-3 flex gap-3 overflow-hidden rounded-cc-md bg-cc-subtle/50 py-2.5 pl-3 pr-3.5',
          className,
        )}
      >
        {/* A bar rather than a border so it can be inset from the rounded corners. */}
        <span aria-hidden="true" className="w-[3px] shrink-0 rounded-cc-full bg-cc-border-strong" />
        <span className="min-w-0 flex-1 text-cc-muted [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </span>
      </blockquote>
    )
  }

  const { kind, content } = parsed
  const style = KINDS[kind]
  const Glyph = style.icon

  return (
    <blockquote
      className={cn(
        'my-3 flex gap-3 overflow-hidden rounded-cc-md py-2.5 pl-3 pr-3.5',
        style.fill,
        className,
      )}
      data-cc-callout={kind}
    >
      <span aria-hidden="true" className={cn('w-[3px] shrink-0 rounded-cc-full', style.bar)} />
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-1.5 text-cc-sm font-medium', style.title)}>
          <Glyph size={14} className="shrink-0" />
          {style.label(locale)}
        </span>
        <span className="mt-1 block text-cc-fg [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {content}
        </span>
      </span>
    </blockquote>
  )
}

/**
 * Pulls a leading `[!KIND]` marker off the quote.
 *
 * react-markdown has already turned the quote into elements by the time we see it, so the
 * marker sits inside the first paragraph's first text child and has to be spliced out of a
 * React tree rather than out of a string. Returning `null` — for no marker, an unknown
 * marker, or a shape we don't recognise — is what makes the plain-quote path the default.
 */
function extractKind(children: ReactNode): { kind: CalloutKind; content: ReactNode } | null {
  const nodes = Children.toArray(children)
  const firstIndex = nodes.findIndex((node) => node !== '\n')
  const first = firstIndex >= 0 ? nodes[firstIndex] : undefined
  if (!isValidElement<{ children?: ReactNode }>(first)) return null

  const inner = Children.toArray(first.props.children)
  const lead = inner[0]
  if (typeof lead !== 'string') return null

  const match = MARKER.exec(lead)
  if (!match?.[1]) return null
  const kind = match[1].toLowerCase() as CalloutKind

  /* Whatever followed the marker on the same line stays in the first paragraph; dropping
   * it would silently eat the sentence a model wrote right after `[!NOTE]`. */
  const rest = lead.slice(match[0].length)
  const head = rest || inner.length > 1 ? [rest, ...inner.slice(1)] : null
  const tail = nodes.slice(firstIndex + 1)

  return {
    kind,
    content: (
      <>
        {/* Rebuilt by hand, so it has to opt back into citation rewriting — the paragraphs
            in `tail` get it from the `p` override, this one never passes through it. */}
        {head && (
          <p className="my-2.5 first:mt-0 last:mb-0">
            <Cited>{head}</Cited>
          </p>
        )}
        {tail}
      </>
    ),
  }
}
