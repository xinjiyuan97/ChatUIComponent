'use client'

import { useCopyToClipboard } from '@xinjiyuan97/chat-core'
import { memo, useEffect, useRef, useState, type RefObject } from 'react'

import { cn } from '../lib/cn'
import { CheckIcon, CopyIcon, DiagramIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { CodeBlock } from './CodeBlock'
import { renderMermaid, type MermaidRenderResult, type MermaidTheme } from './mermaid-renderer'

export type MermaidProps = {
  /** The fence body, i.e. everything after ```mermaid. */
  code: string
  /**
   * Text is still arriving. Suppresses the error state, because a half-written diagram is
   * unparseable by definition and flashing a syntax error once per delta is noise.
   */
  streaming?: boolean
  className?: string
}

/**
 * A ```mermaid fence, rendered as a diagram.
 *
 * The source stays one click away and is what shows whenever the diagram cannot be drawn —
 * an unparseable fence, an old Mermaid syntax, or the optional `mermaid` package simply not
 * being installed. A model that emits a diagram has said something either way, and dropping
 * it because a renderer is missing loses the content, not just the picture.
 */
function MermaidImpl({ code, streaming = false, className }: MermaidProps) {
  const locale = useLocale()
  const { copied, copy } = useCopyToClipboard()
  const containerRef = useRef<HTMLDivElement>(null)
  const dark = useIsDark(containerRef)
  const result = useMermaidSvg(code, dark)
  const [showSource, setShowSource] = useState(false)

  const svg = result?.status === 'ok' ? result.svg : null
  /* Streaming diagrams fail constantly on the way to being valid, so the error surfaces
   * only once the text has stopped moving. */
  const error = !streaming && result?.status === 'error' ? result.message : null

  if (!svg || showSource) {
    return (
      <div ref={containerRef} className={className}>
        <CodeBlock code={code} language="mermaid" runnable={false} />
        {svg && (
          <SourceToggle
            label={locale.showDiagram}
            onClick={() => setShowSource(false)}
            className="-mt-1.5 mb-3"
          />
        )}
        {error && !svg && (
          <p className="-mt-1.5 mb-3 px-1 text-cc-xs text-cc-danger">
            {locale.diagramError}
            {/* The parser's own message is worth showing: it names the offending line, and
                the person reading is often the one who can fix the prompt. */}
            <span className="text-cc-faint"> · {error}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <figure
      ref={containerRef}
      className={cn(
        'cc-mermaid group/diagram my-3 overflow-hidden rounded-cc-md border border-cc-border',
        'bg-cc-surface',
        className,
      )}
    >
      <figcaption
        className={cn(
          'flex h-8 items-center justify-between gap-2 border-b border-cc-border',
          'bg-cc-subtle/60 pl-3 pr-1.5',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-cc-xs text-cc-muted">
          <DiagramIcon size={13} className="shrink-0 text-cc-faint" />
          <span className="truncate">{locale.diagram}</span>
        </span>

        <div
          className={cn(
            'flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-cc',
            'group-hover/diagram:opacity-100 group-focus-within/diagram:opacity-100',
          )}
        >
          <SourceToggle label={locale.showSource} onClick={() => setShowSource(true)} />
          <IconButton
            size="sm"
            label={copied ? locale.copied : locale.copy}
            icon={
              copied ? <CheckIcon size={14} className="text-cc-success" /> : <CopyIcon size={14} />
            }
            onClick={() => void copy(code)}
          />
        </div>
      </figcaption>

      {/* Mermaid sanitises its own output under `securityLevel: 'strict'` (DOMPurify, and
          `htmlLabels: false` keeps labels as SVG text). The string here is generated
          markup, not the model's text passed through. */}
      <div
        className={cn(
          'flex justify-center overflow-x-auto p-4',
          // Mermaid emits a fixed width on the root <svg>; this is what lets a wide diagram
          // shrink to the message column instead of forcing a horizontal scrollbar.
          '[&>svg]:h-auto [&>svg]:max-w-full',
        )}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </figure>
  )
}

function SourceToggle({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center rounded-cc-sm px-1.5 text-cc-xs text-cc-muted',
        'transition-colors duration-150 ease-cc hover:bg-cc-subtle hover:text-cc-fg',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      {label}
    </button>
  )
}

/**
 * Whether this subtree is inside a `.dark` scope.
 *
 * Dark mode in this library is a single class (see `tokens.css`), and Mermaid bakes colours
 * into the SVG it generates, so the diagram has to be re-rendered when the class flips —
 * unlike Shiki, which emits both palettes as custom properties in one pass.
 */
function useIsDark(ref: RefObject<HTMLElement | null>): boolean {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const read = () => setDark(Boolean(ref.current?.closest('.dark')))
    read()

    /* Only `<html>`, not the whole subtree: a document-wide class observer would fire on
     * every hover class React writes during streaming, which is thousands of times a
     * minute for a single boolean that changes when the user flips a theme switch. */
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [ref])

  return dark
}

/**
 * One render: the diagram source and the palette it has to be drawn in.
 *
 * The theme travels with the source because Mermaid bakes colours into the SVG — a queued
 * request that carried only the text would silently drop a theme flip that happened while
 * the previous layout was still running.
 */
type MermaidRequest = { source: string; theme: MermaidTheme }

function differs(a: MermaidRequest, b: MermaidRequest): boolean {
  return a.source !== b.source || a.theme !== b.theme
}

/**
 * Renders `code` to SVG, keeping at most one layout pass in flight.
 *
 * Same shape as `useHighlightedHtml` in `CodeBlock`, and for the same reason: during
 * streaming this runs on every delta, and Mermaid's layout is synchronous and far more
 * expensive than a tokenizer. A queued-latest policy keeps the cost tied to how fast
 * Mermaid is rather than to how fast the model types.
 */
function useMermaidSvg(code: string, dark: boolean): MermaidRenderResult | null {
  const [result, setResult] = useState<MermaidRenderResult | null>(null)
  const running = useRef(false)
  const queued = useRef<MermaidRequest | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const request: MermaidRequest = { source: code, theme: dark ? 'dark' : 'light' }

    /* Note there is no effect-scoped `cancelled` flag here. The obvious version — set one
     * in the cleanup and check it before draining — deadlocks: the queue is filled by the
     * *next* effect run, while the drain lives in the closure that cleanup just cancelled,
     * so the last diagram of a stream would never be drawn. Staleness is instead handled
     * where it actually matters, at the `setResult` below. */
    if (running.current) {
      queued.current = request
      return
    }

    // Whether a *different* request is already waiting. Comparing rather than testing for
    // "anything queued" matters: an effect that re-runs with identical inputs (React's
    // development remount does exactly this) would otherwise swallow the only result.
    const superseded = (req: MermaidRequest) =>
      queued.current !== null && differs(queued.current, req)

    const run = async (req: MermaidRequest) => {
      running.current = true
      try {
        const next = await renderMermaid(req.source, req.theme)
        // Publishing a superseded render would flash a half-written diagram's syntax error
        // for a frame before the real one lands.
        if (alive.current && !superseded(req)) setResult(next)
      } finally {
        running.current = false
      }

      const pending = queued.current
      queued.current = null
      if (pending && alive.current && differs(pending, req)) await run(pending)
    }

    void run(request)
  }, [code, dark])

  return result
}

/** Memoised on content: a streaming reply re-renders its whole Markdown tree per delta. */
export const Mermaid = memo(MermaidImpl)
