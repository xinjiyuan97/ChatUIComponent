/**
 * Prop coercion helpers for registry components.
 *
 * A spec is model output, so `props.count` may arrive as `7`, `"7"`, `null` or missing
 * entirely. Registry components read every prop through these rather than casting, so a
 * sloppy spec degrades to a default instead of rendering `NaN` or crashing on `.trim()`.
 */

export function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export function optionalStr(value: unknown): string | undefined {
  const text = str(value, '')
  return text === '' ? undefined : text
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/** Accepts the strings models emit for booleans, not just real booleans. */
export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return fallback
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Constrains a free-form string prop to a known set. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = str(value).toLowerCase()
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback
}

export type SelectOption = { value: string; label: string; disabled?: boolean }

/**
 * Normalises the three shapes models use for option lists:
 * `["a","b"]`, `[{value,label}]`, and `[{ "a": "Label A" }]`.
 */
export function options(value: unknown): SelectOption[] {
  return arr(value).flatMap((item): SelectOption[] => {
    if (typeof item === 'string' || typeof item === 'number') {
      return [{ value: String(item), label: String(item) }]
    }
    if (typeof item !== 'object' || item === null) return []

    const record = item as Record<string, unknown>
    if ('value' in record || 'label' in record) {
      const optionValue = str(record['value'] ?? record['label'])
      if (!optionValue) return []
      return [
        {
          value: optionValue,
          label: str(record['label'] ?? record['value'], optionValue),
          disabled: bool(record['disabled']),
        },
      ]
    }

    const entry = Object.entries(record)[0]
    if (!entry) return []
    return [{ value: entry[0], label: str(entry[1], entry[0]) }]
  })
}
