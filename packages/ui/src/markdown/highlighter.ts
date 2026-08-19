/**
 * Shiki highlighter, loaded once per page and shared by every code block.
 *
 * Three decisions worth keeping:
 *
 * 1. `createHighlighterCore` + explicit imports instead of the bundled `getHighlighter`.
 *    The bundled entry pulls every grammar Shiki ships (several MB) into the client bundle.
 *    Here only the requested language is fetched, on demand.
 * 2. A module-level promise, not per-component state. Highlighting a reply with ten code
 *    blocks otherwise instantiates ten WASM engines.
 * 3. Both themes are baked into one render as CSS variables, so switching to dark mode is
 *    a class toggle rather than a re-highlight of everything on screen.
 */

import type { HighlighterCore } from 'shiki/core'

export const LIGHT_THEME = 'github-light'
export const DARK_THEME = 'github-dark'

let highlighterPromise: Promise<HighlighterCore> | null = null
const loadedLanguages = new Set<string>()
const inflight = new Map<string, Promise<void>>()

/**
 * Aliases the average user actually types in a fence. Anything not listed falls back to
 * plain text rather than triggering a failed dynamic import.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  shell: 'shellscript',
  console: 'shellscript',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
}

/** Grammars that can be resolved lazily. Keyed by Shiki's canonical id. */
const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  svelte: () => import('shiki/langs/svelte.mjs'),
}

/** Maps a fence info string to a grammar id, or null when it cannot be highlighted. */
export function resolveLanguage(raw: string | undefined): string | null {
  if (!raw) return null
  // Fences carry things like `ts title="a.ts"`; only the first word is the language.
  const first = raw
    .trim()
    .split(/[\s:{,]/)[0]
    ?.toLowerCase()
  if (!first) return null
  const canonical = LANGUAGE_ALIASES[first] ?? first
  return canonical in LANGUAGE_LOADERS ? canonical : null
}

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, wasm, light, dark] = await Promise.all([
        import('shiki/core'),
        import('shiki/wasm'),
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark.mjs'),
      ])
      return createHighlighterCore({
        themes: [light.default, dark.default],
        langs: [],
        loadWasm: wasm,
      })
    })().catch((error) => {
      // Reset so a transient network failure doesn't disable highlighting forever.
      highlighterPromise = null
      throw error
    })
  }
  return highlighterPromise
}

async function ensureLanguage(highlighter: HighlighterCore, language: string): Promise<void> {
  if (loadedLanguages.has(language)) return

  // Ten blocks of the same language mount at once during streaming; without this map they
  // would each start their own import and register the grammar ten times.
  let pending = inflight.get(language)
  if (!pending) {
    const loader = LANGUAGE_LOADERS[language]
    if (!loader) return
    pending = loader()
      .then(async (mod) => {
        await highlighter.loadLanguage((mod as { default: never }).default)
        loadedLanguages.add(language)
      })
      .finally(() => {
        inflight.delete(language)
      })
    inflight.set(language, pending)
  }
  await pending
}

export type HighlightResult = {
  /** Shiki's `<pre>` markup, already escaped by the tokenizer. */
  html: string
  language: string
}

/**
 * Highlights `code`, returning null when the language is unsupported so the caller can
 * fall back to plain text instead of rendering an empty block.
 */
export async function highlight(
  code: string,
  rawLanguage: string | undefined,
): Promise<HighlightResult | null> {
  const language = resolveLanguage(rawLanguage)
  if (!language) return null

  const highlighter = await getHighlighter()
  await ensureLanguage(highlighter, language)
  if (!loadedLanguages.has(language)) return null

  const html = highlighter.codeToHtml(code, {
    lang: language,
    themes: { light: LIGHT_THEME, dark: DARK_THEME },
    // Emit `--shiki-light` / `--shiki-dark` custom properties and let CSS pick. See
    // tokens.css for the `.dark` rule that swaps them.
    defaultColor: false,
    cssVariablePrefix: '--shiki-',
  })

  return { html, language }
}

/** Whether a language will highlight, used to decide if a block should even try. */
export function canHighlight(rawLanguage: string | undefined): boolean {
  return resolveLanguage(rawLanguage) !== null
}
