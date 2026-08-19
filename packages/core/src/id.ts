let counter = 0

/**
 * Stable-ish unique id. `crypto.randomUUID` when available, otherwise a monotonic
 * counter — the counter branch keeps SSR and older browsers working.
 */
export function generateId(prefix = 'msg'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`
  }
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`
}
