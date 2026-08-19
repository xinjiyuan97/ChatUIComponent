/**
 * Template and condition evaluation for A2UI specs.
 *
 * Specs come from a language model, which makes them untrusted input. Nothing here
 * evaluates code: `{{path}}` is a literal property lookup and `when` accepts three fixed
 * shapes. Anything unrecognised fails closed rather than falling back to something
 * permissive.
 */

const TEMPLATE = /\{\{\s*([^}]+?)\s*\}\}/g
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Safe dotted-path lookup. Array indices are supported via `items.0.name`. */
export function getPath(source: unknown, path: string): unknown {
  const keys = path.split('.').filter(Boolean)
  let cursor: unknown = source

  for (const key of keys) {
    if (BLOCKED_KEYS.has(key)) return undefined
    if (cursor === null || cursor === undefined) return undefined

    if (Array.isArray(cursor)) {
      const index = Number.parseInt(key, 10)
      if (!Number.isInteger(index)) return undefined
      cursor = cursor[index]
      continue
    }
    if (typeof cursor !== 'object') return undefined
    // Only own properties, so `toString` and friends are never reachable.
    if (!Object.prototype.hasOwnProperty.call(cursor, key)) return undefined
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return cursor
}

/**
 * Substitutes `{{path}}` templates in a value.
 *
 * A string that is *exactly* one template resolves to the raw value, preserving its type —
 * that is what makes `{ "checked": "{{user.isAdmin}}" }` yield a boolean rather than the
 * string `"true"`. Mixed strings interpolate and always produce a string.
 */
export function resolveTemplate(value: unknown, data: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const whole = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/)
    if (whole) return getPath(data, whole[1] as string)
    if (!value.includes('{{')) return value
    return value.replace(TEMPLATE, (_, path: string) => {
      const resolved = getPath(data, path.trim())
      return resolved === undefined || resolved === null ? '' : String(resolved)
    })
  }

  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item, data))

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) continue
      out[key] = resolveTemplate(item, data)
    }
    return out
  }

  return value
}

/**
 * Evaluates a `when` expression. Supported forms only:
 *
 *   `path`                truthy
 *   `!path`               falsy
 *   `path == 'value'`     loose equality against a literal (`===` also accepted)
 *   `path != 'value'`     inequality
 *
 * Everything else returns false. Failing closed means a malformed condition hides the
 * node instead of showing UI the agent did not intend.
 */
export function evaluateCondition(
  expression: string | undefined,
  data: Record<string, unknown>,
): boolean {
  if (expression === undefined) return true
  const trimmed = expression.trim()
  if (trimmed === '') return true

  const comparison = trimmed.match(/^([\w.[\]]+)\s*(===|==|!==|!=)\s*(.+)$/)
  if (comparison) {
    const [, path, operator, rawLiteral] = comparison
    const left = getPath(data, (path as string).trim())
    const right = parseLiteral((rawLiteral as string).trim())
    // Compare as strings when types differ, so `count == '3'` behaves as an author expects.
    const equal =
      typeof left === typeof right ? left === right : String(left ?? '') === String(right ?? '')
    return operator === '==' || operator === '===' ? equal : !equal
  }

  if (trimmed.startsWith('!')) {
    const path = trimmed.slice(1).trim()
    if (!isSimplePath(path)) return false
    return !truthy(getPath(data, path))
  }

  if (!isSimplePath(trimmed)) return false
  return truthy(getPath(data, trimmed))
}

function isSimplePath(path: string): boolean {
  return /^[\w$]+(\.[\w$]+)*$/.test(path)
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function parseLiteral(raw: string): unknown {
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1)
  }
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  const numeric = Number(raw)
  return Number.isNaN(numeric) ? raw : numeric
}
