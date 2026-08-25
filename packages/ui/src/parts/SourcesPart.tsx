'use client'

import type { SourcePart as SourcePartData } from '@xinjiyuan97/core'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../lib/cn'
import { ExternalLinkIcon } from '../icons'
import { useCitations } from '../markdown/Citation'
import { Collapsible } from '../primitives/Collapsible'
import { useLocale } from '../provider/ChatThemeProvider'

export type SourcesPartProps = {
  /** All source parts of a message, rendered as one list. */
  sources: SourcePartData[]
  className?: string
}

/**
 * Citations, grouped into a single collapsed list.
 *
 * Rendering each source part where it appears in the stream scatters six near-identical
 * links through the answer; collecting them into one block at the end keeps the prose
 * readable and matches how people actually use citations — after reading, not during.
 *
 * Clicking a `[1]` marker in the prose opens this list and highlights the matching row.
 * That is the whole reason the markers are worth having: a numbered footnote with nothing
 * at the other end is decoration.
 */
export function SourcesPart({ sources, className }: SourcesPartProps) {
  const locale = useLocale()
  const citations = useCitations()
  const active = citations?.active ?? null

  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (active === null) return
    setOpen(true)

    /* One frame's grace: the list is inside a `grid-rows-[0fr]` collapsible, so scrolling
     * to a row while it is still at zero height lands on the wrong offset. */
    const id = requestAnimationFrame(() => {
      const row = listRef.current?.querySelector(`[data-cc-source="${active}"]`)
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [active])

  if (sources.length === 0) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Closing the list drops the highlight; leaving it set would mean re-opening shows
        // a row lit up for a click the reader has since moved on from.
        if (!next) citations?.setActive(null)
      }}
      header={
        <span className="flex items-center gap-1.5">
          <span>{locale.sources}</span>
          <span className="tabular-nums text-cc-faint">{sources.length}</span>
        </span>
      }
      className={cn('my-1.5', className)}
      contentClassName="pt-1"
    >
      <ol ref={listRef} className="ml-[6px] space-y-1 border-l border-cc-border pl-3.5">
        {sources.map((source, index) => {
          const number = index + 1
          const isActive = active === number
          return (
            <li
              key={`${source.url}-${index}`}
              data-cc-source={number}
              className={cn(
                'flex gap-2 rounded-cc-xs transition-colors duration-200 ease-cc',
                // Inset the highlight so it reads as a marker on the row, not as a button.
                isActive && '-mx-1.5 bg-cc-accent-subtle px-1.5 py-0.5',
              )}
            >
              <span
                className={cn(
                  'shrink-0 pt-px tabular-nums text-cc-xs',
                  isActive ? 'font-medium text-cc-accent' : 'text-cc-faint',
                )}
              >
                {number}
              </span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'group/source min-w-0 flex-1 rounded-cc-xs outline-none',
                  'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                )}
              >
                <span className="flex items-center gap-1">
                  <span className="truncate text-cc-sm text-cc-fg group-hover/source:text-cc-accent">
                    {source.title || hostOf(source.url)}
                  </span>
                  <ExternalLinkIcon
                    size={11}
                    className="shrink-0 text-cc-faint opacity-0 transition-opacity group-hover/source:opacity-100"
                  />
                </span>
                {source.snippet && (
                  <span className="line-clamp-2 text-cc-xs text-cc-muted">{source.snippet}</span>
                )}
              </a>
            </li>
          )
        })}
      </ol>
    </Collapsible>
  )
}

/** Host name as a fallback title, so an untitled citation is still identifiable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
