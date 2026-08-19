/**
 * Lenient JSON completion for specs that are still streaming.
 *
 * A spec arrives one token at a time, so most of the time the text on hand is a valid
 * prefix of an object rather than a complete one. Closing the open structures lets the
 * renderer show the part that has arrived instead of a blank space that pops into a full
 * card at the end.
 */
export function parsePartialJSON<T = unknown>(text: string): T | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Fall through to repair.
  }

  const repaired = completeJSON(trimmed)
  if (repaired === undefined) return undefined
  try {
    return JSON.parse(repaired) as T
  } catch {
    return undefined
  }
}

/** Closes unterminated strings, arrays and objects, and drops a dangling tail. */
export function completeJSON(text: string): string | undefined {
  const stack: Array<'{' | '['> = []
  let inString = false
  let escaped = false
  /** Index just past the last token that could legally end the document. */
  let lastComplete = -1

  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string

    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') {
        inString = false
        lastComplete = i
      }
      continue
    }

    switch (char) {
      case '"':
        inString = true
        break
      case '{':
      case '[':
        stack.push(char)
        break
      case '}':
      case ']':
        stack.pop()
        lastComplete = i
        break
      case ',':
      case ':':
        break
      default:
        if (!/\s/.test(char)) lastComplete = i
        break
    }
  }

  if (stack.length === 0 && !inString) return text

  let out = text
  if (inString) {
    // An unterminated string is truncated mid-value; close it so the key survives.
    out += '"'
  } else {
    // Trim a trailing comma or a half-written key such as `{"na`.
    const tail = out.slice(lastComplete + 1).trim()
    if (tail === ',' || /[,:]$/.test(out.trimEnd())) {
      out = out.trimEnd().replace(/[,:]$/, '')
    } else if (tail && !/[}\]"\d\w]$/.test(out.trimEnd())) {
      out = out.slice(0, lastComplete + 1)
    }
  }

  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']'
  }
  return out
}
