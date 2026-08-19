/**
 * Mermaid, loaded on demand and shared by every diagram on the page.
 *
 * Three constraints shape this file:
 *
 * 1. **Optional.** `mermaid` is an optional peer dependency — it is several hundred KB of
 *    parser and layout engine, and most chat apps never render a diagram. The import is
 *    dynamic and its failure is a normal outcome (`unavailable`), not an error: the caller
 *    falls back to showing the fence as code.
 * 2. **Untrusted input.** A diagram body is model output. `securityLevel: 'strict'` runs
 *    Mermaid's own DOMPurify pass over the generated SVG and, together with
 *    `htmlLabels: false`, keeps node labels as SVG text instead of embedded HTML.
 * 3. **Bounded.** Size caps below stop a runaway fence from locking the main thread. Layout
 *    is synchronous, so "the tab froze" is a real failure mode for an unbounded graph.
 */

/** Longest diagram source we will hand to the parser. */
export const MAX_DIAGRAM_LENGTH = 20_000

export type MermaidTheme = 'light' | 'dark'

export type MermaidRenderResult =
  | { status: 'ok'; svg: string }
  | { status: 'error'; message: string }
  /** The package is not installed, or its chunk failed to load. */
  | { status: 'unavailable' }

type MermaidModule = {
  initialize: (config: Record<string, unknown>) => void
  parse: (text: string) => Promise<unknown>
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let modulePromise: Promise<MermaidModule | null> | null = null
let initialisedTheme: MermaidTheme | null = null
let sequence = 0

function baseConfig(theme: MermaidTheme): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    /* `neutral` is Mermaid's grayscale theme. Its default palette is lavender, which in a
     * transcript is the loudest thing on the screen — and the accent budget for a message
     * is already spent elsewhere (see CONTRIBUTING). */
    theme: theme === 'dark' ? 'dark' : 'neutral',
    /* `inherit` hands typography back to the chat container, so a diagram's labels are set
     * in the same face as the paragraph above them. */
    fontFamily: 'inherit',
    flowchart: { htmlLabels: false, useMaxWidth: true },
    sequence: { useMaxWidth: true },
    class: { useMaxWidth: true },
    gantt: { useMaxWidth: true },
    maxTextSize: MAX_DIAGRAM_LENGTH,
    maxEdges: 300,
  }
}

async function load(): Promise<MermaidModule | null> {
  if (!modulePromise) {
    modulePromise = import('mermaid')
      .then((mod) => (mod.default ?? mod) as unknown as MermaidModule)
      .catch(() => {
        /* Not reset to null: a missing optional dependency does not become present on a
         * retry, and re-importing per diagram would spam the network on a real 404. */
        return null
      })
  }
  return modulePromise
}

/**
 * Renders `code` to an SVG string.
 *
 * Never throws — every failure is a returned status, because the caller's job is to show
 * something reasonable rather than to handle exceptions from a streaming half-diagram.
 */
export async function renderMermaid(
  code: string,
  theme: MermaidTheme,
): Promise<MermaidRenderResult> {
  const source = code.trim()
  if (!source) return { status: 'error', message: 'Empty diagram' }
  if (source.length > MAX_DIAGRAM_LENGTH) {
    return { status: 'error', message: `Diagram exceeds ${MAX_DIAGRAM_LENGTH} characters` }
  }

  const mermaid = await load()
  if (!mermaid) return { status: 'unavailable' }

  /* Re-initialising is cheap and idempotent, but doing it on every render would reset
   * internal caches, so it is keyed on the only thing that actually changes. */
  if (initialisedTheme !== theme) {
    mermaid.initialize(baseConfig(theme))
    initialisedTheme = theme
  }

  try {
    // `parse` rejects on bad syntax without touching the DOM — the cheap gate for the
    // half-written diagrams that arrive on every streaming delta.
    await mermaid.parse(source)
    const { svg } = await mermaid.render(`cc-mermaid-${(sequence += 1)}`, source)
    return { status: 'ok', svg }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
