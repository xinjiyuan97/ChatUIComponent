/**
 * Prop sanitisation.
 *
 * A spec is model output, so it is treated exactly like user input from the network:
 * anything that could reach the DOM as executable content is dropped before a registry
 * component ever sees it.
 */

/** Props that must never survive, whatever a component does with its prop bag. */
const FORBIDDEN_PROPS = new Set([
  'dangerouslySetInnerHTML',
  'ref',
  'key',
  '__proto__',
  'constructor',
  'prototype',
])

/** Props treated as URLs and therefore scheme-checked. */
const URL_PROPS = new Set(['href', 'src', 'url', 'action', 'poster', 'formAction'])

const SAFE_URL = /^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#|$)/i
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i

export function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_PROPS.has(key)) continue
    if (key.startsWith('__')) continue

    // Event-shaped props may only carry an action descriptor object. A string here
    // would be a handler-injection attempt if a component ever spread it onto an element.
    if (/^on[A-Z]/.test(key)) {
      if (isActionDescriptor(value)) out[key] = value
      continue
    }

    if (URL_PROPS.has(key)) {
      const url = sanitizeUrl(value)
      if (url !== undefined) out[key] = url
      continue
    }

    out[key] = value
  }

  return out
}

export function isActionDescriptor(value: unknown): value is { action: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { action?: unknown }).action === 'string'
  )
}

/**
 * Returns the URL if its scheme is safe, otherwise `undefined`.
 *
 * `javascript:` is the obvious case; `data:` is blocked too except for images, because a
 * `data:text/html` document inherits the page origin in some browsers.
 */
export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  const normalised = stripControlCharacters(trimmed)

  if (SAFE_DATA_IMAGE.test(normalised)) return trimmed
  if (SAFE_URL.test(normalised)) return trimmed
  return undefined
}

/**
 * Removes every code point at or below U+0020.
 *
 * This runs before the scheme check because browsers strip these themselves, which makes
 * `java\nscript:alert(1)` a working bypass against a naive prefix test. Written as a loop
 * rather than a character class so the source stays free of literal control characters.
 */
function stripControlCharacters(value: string): string {
  let out = ''
  for (const char of value) {
    if (char.codePointAt(0)! > 0x20) out += char
  }
  return out
}
