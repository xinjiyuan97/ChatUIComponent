'use client'

import type { SourcePart } from '@xinjiyuan97/chat-core'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'

export type CitationContextValue = {
  /** The message's source parts, in the order they arrived — index 0 is `[1]`. */
  sources: SourcePart[]
  /** 1-based number of the citation the reader last clicked, or `null`. */
  active: number | null
  setActive: (index: number | null) => void
}

const CitationContext = createContext<CitationContextValue | null>(null)

export function useCitations(): CitationContextValue | null {
  return useContext(CitationContext)
}

export type CitationProviderProps = {
  sources: SourcePart[]
  children: ReactNode
}

/**
 * Ties `[1]` in the prose to entry 1 of the source list.
 *
 * A message-scoped provider rather than global state: two answers on screen both cite a
 * `[1]`, and they are different documents. Scoping to the message is also what makes the
 * numbering trivially correct — it is just the position in `message.parts`.
 */
export function CitationProvider({ sources, children }: CitationProviderProps) {
  const [active, setActive] = useState<number | null>(null)
  const value = useMemo<CitationContextValue>(
    () => ({ sources, active, setActive }),
    [sources, active],
  )
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>
}

/**
 * Matches `[1]`, `[1,2]`, `[1, 2, 3]` and the footnote form `[^1]`.
 *
 * Deliberately narrow. Anything looser starts eating ordinary prose — a sentence about
 * `config[0]`, a bracketed aside — and a false positive here does not merely look odd, it
 * turns readable text into a dead button.
 */
const CITATION_SOURCE = String.raw`\[\^?(\d+(?:\s*,\s*\d+)*)\]`

/**
 * Rewrites citation markers in an inline subtree into clickable chips.
 *
 * Runs over react-markdown's *output* rather than as a remark plugin because the numbers
 * have to be validated against this message's sources, and a plugin sits below the React
 * tree where that list is not in scope. The cost is one walk per inline container per
 * render, which is nothing next to the Markdown parse that produced it.
 *
 * Outside a `CitationProvider`, or in a message with no sources, it is the identity — so
 * `[1]` in an answer that cites nothing stays literal text.
 */
export function Cited({ children }: { children?: ReactNode }) {
  const citations = useCitations()
  if (!citations || citations.sources.length === 0) return <>{children}</>
  return <>{splitNodes(children, citations.sources.length)}</>
}

function splitNodes(node: ReactNode, count: number): ReactNode {
  if (typeof node === 'string') return splitString(node, count)
  if (Array.isArray(node)) {
    return node.map((child, index) => {
      const next = splitNodes(child, count)
      return Array.isArray(next) ? <span key={index}>{next}</span> : next
    })
  }
  /* Elements are left alone. Descending would mean cloning arbitrary components with
   * rewritten children, and the markers that matter are in paragraph text — not inside a
   * link label or an inline code span, where rewriting would be wrong anyway. */
  return node
}

function splitString(text: string, count: number): ReactNode {
  // A fresh regex per call: a shared `/g` one carries `lastIndex` between callers, and
  // this runs from several renderers in the same pass.
  const pattern = new RegExp(CITATION_SOURCE, 'g')
  const out: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const numbers = (match[1] ?? '')
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= count)

    /* Out of range means it was never a citation — `[12]` in an answer with two sources is
     * prose, and is left exactly as written. */
    if (numbers.length === 0) continue

    if (match.index > cursor) out.push(text.slice(cursor, match.index))
    out.push(
      <span key={match.index} className="inline-flex gap-px whitespace-nowrap">
        {numbers.map((n) => (
          <Citation key={n} index={n} />
        ))}
      </span>,
    )
    cursor = match.index + match[0].length
  }

  if (out.length === 0) return text
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

/**
 * One superscript marker.
 *
 * Sized and positioned like a footnote number rather than styled as a link: citations
 * appear mid-sentence, often several to a paragraph, and underlined accent text at that
 * density shreds the line. The hover fill carries the affordance, which is enough because
 * the shape already reads as a footnote.
 */
export function Citation({ index, className }: { index: number; className?: string }) {
  const locale = useLocale()
  const citations = useCitations()
  const source = citations?.sources[index - 1]
  const isActive = citations?.active === index

  return (
    <button
      type="button"
      onClick={() => citations?.setActive(index)}
      title={source?.title || source?.url}
      aria-label={`${locale.citation} ${index}${source?.title ? `: ${source.title}` : ''}`}
      className={cn(
        'relative -top-[0.35em] mx-px inline-flex h-[1.15em] min-w-[1.15em] items-center',
        'justify-center rounded-cc-xs px-[0.28em] align-baseline text-[0.68em] font-medium',
        'tabular-nums leading-none transition-colors duration-150 ease-cc',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        isActive
          ? 'bg-cc-accent text-cc-accent-fg'
          : 'bg-cc-subtle text-cc-muted hover:bg-cc-accent-subtle hover:text-cc-accent',
        className,
      )}
    >
      {index}
    </button>
  )
}
