/**
 * `docx-preview`, loaded on demand.
 *
 * Optional peer, module promise never reset, failure as a status — the same contract as
 * [`mermaid-renderer`](../markdown/mermaid-renderer.ts).
 *
 * Only `renderAsync` is used. The package exposes more, but that is the one function whose
 * signature has held across its releases, and a preview is not worth pinning ourselves to a
 * 0.x package's internals over.
 *
 * The library writes the document's own stylesheet — a .docx carries its own fonts, sizes
 * and paragraph styles — into a container we hand it, and prefixes every rule with the class
 * below. Both matter: without a style container the rules land in `<head>` and outlive the
 * panel; without a distinct prefix, a document defining `p { margin: 0 }` reformats the chat
 * behind it.
 */

/** Prefix for every rule the library emits, and the class on the rendered body. */
export const DOCX_CLASS = 'cc-docx'

export type DocxRenderResult =
  | { status: 'ok' }
  /** `docx-preview` is not installed, or its chunk failed to load. */
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

type DocxModule = {
  renderAsync: (
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: Record<string, unknown>,
  ) => Promise<unknown>
}

let modulePromise: Promise<DocxModule | null> | null = null

async function load(): Promise<DocxModule | null> {
  if (!modulePromise) {
    modulePromise = import('docx-preview')
      .then((mod) => (mod as unknown as { default?: DocxModule }).default ?? (mod as unknown as DocxModule))
      .catch(() => null)
  }
  return modulePromise
}

/** Renders a .docx into `body`, putting its stylesheet in `styles`. Never throws. */
export async function renderDocx(
  data: Blob,
  body: HTMLElement,
  styles: HTMLElement,
): Promise<DocxRenderResult> {
  const docx = await load()
  if (!docx) return { status: 'unavailable' }

  try {
    await docx.renderAsync(data, body, styles, {
      className: DOCX_CLASS,
      inWrapper: true,
      /* Page width is honoured but page *height* is not: a preview panel scrolls, and
       * splitting at the original page breaks would leave a column of half-empty A4 pages
       * with the text squeezed into the top of each. */
      ignoreHeight: true,
      ignoreWidth: false,
      breakPages: true,
      /* Off by default in the library, and left off here: it enables tab-stop measurement
       * that reflows on every resize, which in a draggable panel is a visible stutter. */
      experimental: false,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      // Images become blob URLs rather than base64: a document full of screenshots would
      // otherwise triple in memory as data URLs on top of the bytes already held.
      useBase64URL: false,
    })
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}
