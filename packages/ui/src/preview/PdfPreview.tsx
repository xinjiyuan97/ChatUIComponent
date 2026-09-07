'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

import { cn } from '../lib/cn'
import {
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FitIcon,
  SpinnerIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useChatTheme, useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { openPdf, type PdfDocumentHandle, type PdfLoadResult, type PdfPageSize } from './pdf-renderer'
import {
  PreviewFrame,
  PreviewToolbarLabel,
  PreviewToolbarSeparator,
  PreviewToolbarSpacer,
} from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { UnsupportedPreview } from './UnsupportedPreview'

export type PdfPreviewProps = {
  file: PreviewFile
  className?: string
}

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const SCALE_STEP = 1.25
/** Space around a page, so the shadow has somewhere to fall and fit-width is not edge-to-edge. */
const GUTTER = 32

/** A PDF, page by page. Bytes first, then the parser, then the pages. */
export function PdfPreview({ file, className }: PdfPreviewProps) {
  return (
    <PreviewLoader file={file} as="arrayBuffer">
      {(data) => <PdfDocument data={data} file={file} className={className} />}
    </PreviewLoader>
  )
}

function PdfDocument({
  data,
  file,
  className,
}: {
  data: ArrayBuffer
  file: PreviewFile
  className?: string
}) {
  const locale = useLocale()
  const { pdfWorkerSrc } = useChatTheme()
  const [result, setResult] = useState<PdfLoadResult | null>(null)

  useEffect(() => {
    let cancelled = false
    let handle: PdfDocumentHandle | null = null

    void openPdf(data, pdfWorkerSrc).then((next) => {
      if (cancelled) {
        // Opened after the panel closed: the worker and its parsed pages have to go too.
        if (next.status === 'ok') next.document.destroy()
        return
      }
      if (next.status === 'ok') handle = next.document
      setResult(next)
    })

    return () => {
      cancelled = true
      handle?.destroy()
    }
  }, [data, pdfWorkerSrc])

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-cc-sm text-cc-faint">
        <SpinnerIcon size={14} />
        {locale.previewLoading}
      </div>
    )
  }

  if (result.status !== 'ok') {
    /* Three different failures, three different fixes: install the package, pass the worker
     * URL, or accept that this particular file is broken. Collapsing them would leave the
     * first two looking like the third. */
    return (
      <UnsupportedPreview
        file={file}
        className={className}
        reason={
          result.status === 'unavailable'
            ? 'renderer-missing'
            : result.status === 'needs-config'
              ? 'needs-config'
              : 'render-failed'
        }
        packageName="pdfjs-dist"
        detail={result.status === 'error' ? result.message : undefined}
      />
    )
  }

  return <PdfViewer document={result.document} file={file} className={className} />
}

function PdfViewer({
  document: handle,
  file,
  className,
}: {
  document: PdfDocumentHandle
  file: PreviewFile
  className?: string
}) {
  const locale = useLocale()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [base, setBase] = useState<PdfPageSize | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [fitWidth, setFitWidth] = useState(true)
  const [freeScale, setFreeScale] = useState(1)
  const [draft, setDraft] = useState<string | null>(null)

  /* Page one's size stands in for every page that has not been asked for yet, so the
   * scroll height is roughly right from the first frame instead of growing under the
   * user's cursor as pages resolve. */
  useEffect(() => {
    let cancelled = false
    void handle.pageSize(1).then(
      (size) => {
        if (!cancelled) setBase(size)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [handle])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewportWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (!base || !viewportWidth) return 1
    return clamp((viewportWidth - GUTTER) / base.width)
  }, [base, viewportWidth])

  const scale = fitWidth ? fitScale : freeScale

  const zoom = useCallback(
    (factor: number) => {
      setFreeScale(clamp(scale * factor))
      setFitWidth(false)
    },
    [scale],
  )

  const { register, near, current, goTo } = usePageWindow(scrollRef, handle.numPages)

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number.parseInt(draft, 10)
    if (Number.isFinite(parsed)) goTo(Math.min(Math.max(parsed, 1), handle.numPages))
    setDraft(null)
  }

  return (
    <PreviewFrame
      className={className}
      scroll={false}
      toolbar={
        <>
          <IconButton
            size="sm"
            label={locale.previewPreviousPage}
            icon={<ChevronDownIcon size={14} className="rotate-180" />}
            disabled={current <= 1}
            onClick={() => goTo(current - 1)}
          />
          <input
            // A typed page number is the only way to move through a 300-page report; the
            // buttons beside it are for the last step, not for the journey.
            value={draft ?? String(current)}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
            onBlur={commitDraft}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') commitDraft()
              if (event.key === 'Escape') setDraft(null)
            }}
            aria-label={locale.previewPageOf(handle.numPages)}
            inputMode="numeric"
            className={cn(
              'h-6 w-10 shrink-0 rounded-cc-sm border border-cc-border bg-cc-surface',
              'text-center text-cc-xs tabular-nums text-cc-fg outline-none',
              'focus-visible:border-cc-border-strong focus-visible:ring-2 focus-visible:ring-cc-accent/45',
            )}
          />
          <PreviewToolbarLabel collapse>{locale.previewPageOf(handle.numPages)}</PreviewToolbarLabel>
          <IconButton
            size="sm"
            label={locale.previewNextPage}
            icon={<ChevronDownIcon size={14} />}
            disabled={current >= handle.numPages}
            onClick={() => goTo(current + 1)}
          />

          <PreviewToolbarSeparator />

          <IconButton
            size="sm"
            label={locale.previewZoomOut}
            icon={<ZoomOutIcon size={14} />}
            disabled={scale <= MIN_SCALE}
            onClick={() => zoom(1 / SCALE_STEP)}
          />
          <PreviewToolbarLabel collapse>{`${Math.round(scale * 100)}%`}</PreviewToolbarLabel>
          <IconButton
            size="sm"
            label={locale.previewZoomIn}
            icon={<ZoomInIcon size={14} />}
            disabled={scale >= MAX_SCALE}
            onClick={() => zoom(SCALE_STEP)}
          />
          <IconButton
            size="sm"
            label={locale.previewFitWidth}
            icon={<FitIcon size={14} />}
            active={fitWidth}
            onClick={() => setFitWidth(true)}
          />

          <PreviewToolbarSpacer />

          {canDownload(file) && (
            <IconButton
              size="sm"
              label={locale.previewDownload}
              icon={<DownloadIcon size={14} />}
              onClick={() => downloadFile(file)}
            />
          )}
          {file.url && (
            <IconButton
              size="sm"
              label={locale.previewOpenExternal}
              icon={<ExternalLinkIcon size={14} />}
              onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
            />
          )}
        </>
      }
    >
      <div
        ref={scrollRef}
        className="h-full overflow-auto overscroll-contain bg-cc-paper-canvas px-4 py-4"
      >
        <div className="flex flex-col items-center gap-4">
          {Array.from({ length: handle.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              index={index + 1}
              document={handle}
              scale={scale}
              base={base}
              active={near.has(index + 1)}
              register={register}
            />
          ))}
        </div>
      </div>
    </PreviewFrame>
  )
}

function PdfPage({
  index,
  document: handle,
  scale,
  base,
  active,
  register,
}: {
  index: number
  document: PdfDocumentHandle
  scale: number
  base: PdfPageSize | null
  active: boolean
  register: (index: number, element: HTMLElement | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<PdfPageSize | null>(null)

  const setRef = useCallback(
    (element: HTMLElement | null) => register(index, element),
    [register, index],
  )

  useEffect(() => {
    if (!active || size) return
    let cancelled = false
    void handle.pageSize(index).then(
      (next) => {
        if (!cancelled) setSize(next)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [active, size, handle, index])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    const task = handle.renderPage(index, canvas, scale, devicePixelRatio())
    task.done.catch(() => {
      // A page that will not draw stays blank at the right size, which still lets the
      // reader scroll past it to the rest of the document.
    })
    return () => {
      task.cancel()
      /* Zeroing the canvas releases its backing store now rather than at the next GC. At
       * fit-width on a retina screen one page is several megabytes, and a reader scrolling
       * through a long PDF passes hundreds of them. */
      canvas.width = 0
      canvas.height = 0
    }
  }, [active, handle, index, scale])

  const geometry = size ?? base

  return (
    <div
      ref={setRef}
      data-cc-pdf-page={index}
      className="shrink-0 bg-cc-paper shadow-cc-card"
      style={
        geometry
          ? { width: Math.floor(geometry.width * scale), height: Math.floor(geometry.height * scale) }
          : undefined
      }
    >
      {active && <canvas ref={canvasRef} className="block" />}
    </div>
  )
}

/**
 * Which pages to draw, and which one the reader is on.
 *
 * Two observers rather than one because the questions have different answers: the render
 * window deliberately reaches past the viewport so a page is drawn before it is scrolled
 * into, while "the current page" has to mean the one actually on screen — using the padded
 * window for both would show page 4 in the toolbar while page 3 fills the panel.
 */
function usePageWindow(scrollRef: { current: HTMLElement | null }, count: number) {
  const elements = useRef(new Map<number, HTMLElement>())
  const observers = useRef<IntersectionObserver[]>([])

  const [near, setNear] = useState<Set<number>>(() => new Set([1]))
  const [onScreen, setOnScreen] = useState<Set<number>>(() => new Set([1]))

  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return

    const make = (rootMargin: string, apply: (update: (previous: Set<number>) => Set<number>) => void) =>
      new IntersectionObserver(
        (entries) => {
          apply((previous) => {
            const next = new Set(previous)
            for (const entry of entries) {
              const page = Number(entry.target.getAttribute('data-cc-pdf-page'))
              if (entry.isIntersecting) next.add(page)
              else next.delete(page)
            }
            return next
          })
        },
        { root, rootMargin },
      )

    // One viewport of lead-in each way: enough that a normal scroll never reaches a blank
    // page, small enough that a fling does not try to rasterise fifty of them.
    const list = [make('100% 0px', setNear), make('0px', setOnScreen)]
    observers.current = list
    for (const element of elements.current.values()) {
      for (const observer of list) observer.observe(element)
    }

    return () => {
      for (const observer of list) observer.disconnect()
      observers.current = []
    }
    // `count` is in here so that opening a different document re-observes its pages.
  }, [scrollRef, count])

  const register = useCallback((index: number, element: HTMLElement | null) => {
    const map = elements.current
    const previous = map.get(index)
    if (previous) {
      for (const observer of observers.current) observer.unobserve(previous)
      map.delete(index)
    }
    if (element) {
      map.set(index, element)
      for (const observer of observers.current) observer.observe(element)
    }
  }, [])

  /* Scrolls through the registered element rather than a document-wide selector: with two
   * PDFs open in two tabs, a selector would find whichever page happened to be first in the
   * DOM and scroll the wrong panel. */
  const goTo = useCallback((page: number) => {
    elements.current.get(page)?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [])

  // The topmost page on screen: with two pages half-visible, the one you are reading is the
  // upper one, and a number that flips as you cross each boundary is worse than a stale one.
  const current = onScreen.size ? Math.min(...onScreen) : 1

  return { register, near, current, goTo }
}

function clamp(value: number) {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE)
}

function devicePixelRatio() {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
