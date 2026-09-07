/**
 * pdf.js, loaded on demand.
 *
 * Same shape as [`mermaid-renderer`](../markdown/mermaid-renderer.ts): `pdfjs-dist` is an
 * optional peer, the import failing is a normal outcome rather than an exception, and the
 * module promise is never reset because a package that is not installed does not become
 * installed on a retry.
 *
 * Two things are specific to pdf.js:
 *
 * - **The worker is not guessed.** pdf.js does its parsing in a web worker whose URL the
 *   bundler has to produce, and there is no way to derive it that survives every bundler.
 *   Defaulting to a CDN would fail silently on an offline deployment and, on a version
 *   mismatch, fail with an error nobody can act on — so a missing `workerSrc` is reported as
 *   `needs-config` and the fallback page prints the two lines that fix it.
 * - **The buffer is copied before it is handed over.** pdf.js transfers the typed array to
 *   the worker, which detaches it; the second open of the same bytes would otherwise throw
 *   on an empty buffer. The copy costs one memcpy and removes a whole class of "works the
 *   first time" bugs.
 */

export type PdfLoadResult =
  | { status: 'ok'; document: PdfDocumentHandle }
  /** `pdfjs-dist` is not installed, or its chunk failed to load. */
  | { status: 'unavailable' }
  /** Installed, but no `pdfWorkerSrc` was given to the provider. */
  | { status: 'needs-config' }
  | { status: 'error'; message: string }

export type PdfPageSize = { width: number; height: number }

export type PdfRenderTask = {
  /** Resolves when the page is on the canvas; rejects only for a genuine failure. */
  done: Promise<void>
  cancel: () => void
}

export type PdfDocumentHandle = {
  numPages: number
  /** CSS pixel size at scale 1, for laying out a page before it is drawn. */
  pageSize: (page: number) => Promise<PdfPageSize>
  /** Draws a 1-based page onto a canvas, sizing it for `scale` and the device ratio. */
  renderPage: (page: number, canvas: HTMLCanvasElement, scale: number, ratio: number) => PdfRenderTask
  destroy: () => void
}

type PdfjsViewport = { width: number; height: number }

type PdfjsPage = {
  getViewport: (options: { scale: number }) => PdfjsViewport
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => {
    promise: Promise<void>
    cancel: () => void
  }
  cleanup: () => void
}

type PdfjsDocument = {
  numPages: number
  getPage: (page: number) => Promise<PdfjsPage>
  destroy: () => Promise<void>
}

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (options: { data: Uint8Array }) => { promise: Promise<PdfjsDocument> }
}

let modulePromise: Promise<PdfjsModule | null> | null = null

async function load(): Promise<PdfjsModule | null> {
  if (!modulePromise) {
    modulePromise = import('pdfjs-dist')
      .then((mod) => (mod as unknown as { default?: PdfjsModule }).default ?? (mod as unknown as PdfjsModule))
      .catch(() => null)
  }
  return modulePromise
}

/** True when the package resolves, for a caller that wants to distinguish the two failures. */
export async function isPdfAvailable(): Promise<boolean> {
  return (await load()) !== null
}

/**
 * Opens a PDF.
 *
 * Never throws: a corrupt file is ordinary input for a panel that opens whatever the agent
 * produced, and every outcome is a status the fallback page knows how to explain.
 */
export async function openPdf(data: ArrayBuffer, workerSrc?: string): Promise<PdfLoadResult> {
  const pdfjs = await load()
  if (!pdfjs) return { status: 'unavailable' }
  if (!workerSrc) return { status: 'needs-config' }

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  try {
    // The copy: see the file header. `slice` on the ArrayBuffer, not on the view, so the
    // caller's buffer is untouched by the transfer.
    const document = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
    return { status: 'ok', document: wrap(document) }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

function wrap(document: PdfjsDocument): PdfDocumentHandle {
  /* Pages are cached because every one of them is asked for twice — once to lay out its
   * placeholder, once to draw it — and `getPage` re-parses on each call. */
  const pages = new Map<number, Promise<PdfjsPage>>()

  const page = (index: number) => {
    let existing = pages.get(index)
    if (!existing) {
      existing = document.getPage(index)
      pages.set(index, existing)
    }
    return existing
  }

  return {
    numPages: document.numPages,

    async pageSize(index) {
      const viewport = (await page(index)).getViewport({ scale: 1 })
      return { width: viewport.width, height: viewport.height }
    },

    renderPage(index, canvas, scale, ratio) {
      let cancelled = false
      let task: { cancel: () => void } | null = null

      const done = (async () => {
        const target = await page(index)
        if (cancelled) return

        const viewport = target.getViewport({ scale })
        const context = canvas.getContext('2d')
        if (!context) return

        /* The backing store is in device pixels and the CSS box in CSS pixels. Skipping the
         * ratio is why so many in-house PDF viewers render blurry text on a retina screen. */
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        context.setTransform(ratio, 0, 0, ratio, 0, 0)

        const render = target.render({ canvasContext: context, viewport })
        task = render
        try {
          await render.promise
        } catch (error) {
          // A cancelled render rejects. That is this module's own doing, not a failure.
          if (!cancelled) throw error
        }
      })()

      return {
        done,
        cancel() {
          cancelled = true
          task?.cancel()
        },
      }
    },

    destroy() {
      /* Each page holds its own parsed operator list; dropping only the document leaves them
       * alive until the next GC, which for a large PDF is tens of megabytes. */
      for (const entry of pages.values()) {
        void entry.then(
          (value) => value.cleanup(),
          () => {},
        )
      }
      pages.clear()
      void document.destroy().catch(() => {})
    },
  }
}
