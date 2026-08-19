/**
 * Streaming-safe Markdown preprocessing.
 *
 * Half-written Markdown is not a subset of finished Markdown: while the tokens for
 * "```ts\nconst a = 1" are on screen, a parser sees a paragraph starting with three
 * backticks, so the text renders as prose and then snaps into a code block the moment the
 * closing fence arrives. Across a long reply that produces a constant flicker. Closing the
 * open constructs before parsing keeps each frame a valid document, so blocks appear in
 * their final form from the first character.
 */

const FENCE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/

type FenceState = {
  /** The fence marker that opened the current block, or null when outside one. */
  marker: string | null
  indent: string
}

export type CompleteMarkdownOptions = {
  /**
   * Also balance inline markers (`**`, `` ` ``, links).
   *
   * Only safe while text is still arriving. On a finished message the heuristics can fire
   * on legitimate prose — an unmatched asterisk that the author meant literally would gain
   * a partner and become visible — so the caller turns this off once the stream ends.
   */
  inline?: boolean
}

/** Returns the text with any unterminated construct closed off. */
export function completeMarkdown(text: string, options: CompleteMarkdownOptions = {}): string {
  if (!text) return text
  const { inline = true } = options

  const lines = text.split('\n')
  const fence = scanFences(lines)

  if (fence.marker) {
    // Inside a code block: nothing else can be open, and closing it is all that matters.
    const trailingNewline = text.endsWith('\n') ? '' : '\n'
    return `${text}${trailingNewline}${fence.indent}${fence.marker}`
  }

  return inline ? closeInline(text) : text
}

function scanFences(lines: string[]): FenceState {
  let marker: string | null = null
  let indent = ''

  for (const line of lines) {
    const match = FENCE.exec(line)
    if (!match) continue
    const [, lineIndent = '', found = '', rest = ''] = match

    if (marker === null) {
      marker = found
      indent = lineIndent
    } else if (
      // A closing fence uses the same character, is at least as long, and carries no
      // info string.
      found[0] === marker[0] &&
      found.length >= marker.length &&
      rest.trim() === ''
    ) {
      marker = null
      indent = ''
    }
  }

  return { marker, indent }
}

/**
 * Balances inline markers outside code spans.
 *
 * Order matters: the backtick pass runs first and records which regions are code, so an
 * asterisk inside `a * b` is never counted as emphasis.
 */
function closeInline(text: string): string {
  let out = text

  // 1. Inline code. An odd count of single backticks means one span is still open.
  const backticks = countOutsideEscapes(out, '`')
  if (backticks % 2 === 1) out += '`'

  const codeRanges = findCodeSpans(out)
  const visible = (index: number) =>
    !codeRanges.some(([start, end]) => index >= start && index < end)

  // 2. Emphasis, longest marker first so `**` is not consumed as two `*`.
  for (const marker of ['***', '**', '~~', '*', '__', '_']) {
    if (hasOpenEmphasis(out, marker, visible)) out += marker
  }

  // 3. A link whose destination is still arriving renders as literal text and then jumps
  //    into an anchor. Closing the paren keeps it an anchor throughout.
  const openLink = out.lastIndexOf('](')
  if (openLink !== -1 && visible(openLink) && out.indexOf(')', openLink) === -1) {
    out += ')'
  }

  return out
}

function countOutsideEscapes(text: string, char: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i += 1
      continue
    }
    if (text[i] === char) count += 1
  }
  return count
}

/**
 * Whether an emphasis run is still open at the end of the text.
 *
 * Counting markers and testing for an odd total is the obvious approach and it is wrong:
 * `2 * 3 * 4` has three asterisks and no emphasis at all, so a naive count appends a
 * fourth and puts a stray character on screen. CommonMark decides by *flanking* — a
 * delimiter can open only when followed by a non-space and close only when preceded by
 * one — and applying just that rule removes essentially all the false positives.
 */
function hasOpenEmphasis(
  text: string,
  marker: string,
  visible: (index: number) => boolean,
): boolean {
  const char = marker[0] as string
  let open = false
  let index = text.indexOf(marker)

  while (index !== -1) {
    const next = index + marker.length
    const escaped = index > 0 && text[index - 1] === '\\'
    // Skip a longer run: `***` must not also register as `**` followed by `*`.
    const partOfLongerRun = text[next] === char
    if (escaped || partOfLongerRun || !visible(index)) {
      index = text.indexOf(marker, next)
      continue
    }

    const before = text[index - 1]
    const after = text[next]
    const canOpen = after !== undefined && !/\s/.test(after)
    const canClose = before !== undefined && !/\s/.test(before)

    if (!open && canOpen) open = true
    else if (open && canClose) open = false

    index = text.indexOf(marker, next)
  }

  return open
}

/** Byte ranges covered by inline code spans, used to mask emphasis detection. */
function findCodeSpans(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') {
      i += 1
      continue
    }
    if (text[i] !== '`') continue
    if (start === -1) start = i
    else {
      ranges.push([start, i + 1])
      start = -1
    }
  }
  return ranges
}

/**
 * Splits a document into top-level blocks, keeping fenced code intact.
 *
 * Blocks are the unit of memoisation in `Markdown`: during streaming only the final block
 * changes, so everything above it keeps its React elements and is never re-parsed. Without
 * this, every token re-runs the full Markdown pipeline over the entire reply, and a long
 * answer with several code blocks visibly drops frames.
 */
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d{1,9}[.)])[ \t]/
const BLOCK_QUOTE = /^\s{0,3}>/
const INDENTED_CONTINUATION = /^(?:[ ]{2,}|\t)\S/

export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let fenceMarker: string | null = null

  const flush = () => {
    if (current.length === 0) return
    const block = current.join('\n')
    if (block.trim()) blocks.push(block)
    current = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    const match = FENCE.exec(line)

    if (match) {
      const found = match[2] as string
      const rest = (match[3] ?? '').trim()
      if (fenceMarker === null) {
        // A fence starts a new block so the code stays whole and separately memoised.
        flush()
        fenceMarker = found
        current.push(line)
        continue
      }
      current.push(line)
      if (found[0] === fenceMarker[0] && found.length >= fenceMarker.length && rest === '') {
        fenceMarker = null
        flush()
      }
      continue
    }

    if (fenceMarker === null && line.trim() === '') {
      // A blank line usually ends a block, but a loose list is separated by blank lines
      // and is still one list. Splitting there would restart `1.` at every item.
      if (continuesContainer(current, lines, i)) current.push(line)
      else flush()
      continue
    }

    current.push(line)
  }

  flush()
  return blocks
}

/** True when the blank line at `index` sits inside a list or quote rather than ending it. */
function continuesContainer(current: string[], lines: string[], index: number): boolean {
  const first = current.find((line) => line.trim() !== '')
  if (!first) return false
  const inList = LIST_ITEM.test(first)
  const inQuote = BLOCK_QUOTE.test(first)
  if (!inList && !inQuote) return false

  let next = index + 1
  while (next < lines.length && (lines[next] as string).trim() === '') next++
  if (next >= lines.length) return false

  const following = lines[next] as string
  if (inQuote) return BLOCK_QUOTE.test(following)
  return LIST_ITEM.test(following) || INDENTED_CONTINUATION.test(following)
}
