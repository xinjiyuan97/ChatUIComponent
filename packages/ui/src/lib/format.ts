/** Human-readable duration for thinking blocks and tool timings. */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/** Compact byte size for attachments. */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)}${units[unit]}`
}

/**
 * Time-of-day for message timestamps.
 *
 * Uses the caller's locale rather than a hand-rolled format so 12h/24h follows the
 * user's own region settings.
 */
export function formatTime(timestamp: number | undefined, locale: string): string {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(timestamp),
  )
}

/** Longer form for conversation list tooltips. */
export function formatDateTime(timestamp: number | undefined, locale: string): string {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(timestamp),
  )
}

/** Truncates a single-line preview without cutting a surrogate pair in half. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`
}

/**
 * Best-effort one-line summary of a tool's arguments, shown on the collapsed row.
 *
 * Picks the first string-ish value, preferring keys that usually name the subject of the
 * call, so a row reads `read_file · src/auth.ts` instead of just `read_file`.
 */
export function summarizeToolInput(input: unknown): string {
  if (input === undefined || input === null) return ''
  if (typeof input === 'string') return truncate(input, 60)
  if (typeof input !== 'object' || Array.isArray(input)) return ''

  const record = input as Record<string, unknown>
  const preferred = [
    'path',
    'file_path',
    'filePath',
    'file',
    'query',
    'q',
    'url',
    'name',
    'command',
  ]
  for (const key of preferred) {
    const value = record[key]
    if (typeof value === 'string' && value) return truncate(value, 60)
  }
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value) return truncate(value, 60)
    if (typeof value === 'number') return String(value)
  }
  return ''
}
