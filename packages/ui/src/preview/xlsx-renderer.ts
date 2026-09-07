/**
 * `exceljs`, loaded on demand, turning a workbook into plain rows of strings.
 *
 * Optional peer with the usual contract (see [`mermaid-renderer`](../markdown/mermaid-renderer.ts)).
 *
 * This file deliberately stops at *data*. Drawing is done by `ExcelPreview` with our own
 * tokens, because every off-the-shelf spreadsheet renderer brings a second copy of the
 * parser, a grid virtualiser and a stylesheet that ignores the host theme — and a preview
 * needs none of that, only "what does this file say".
 */

/** Rows past this are dropped, with a notice in the UI. */
export const DEFAULT_MAX_ROWS = 2000
/** Columns past this are dropped. Beyond a few dozen nobody is reading, they are scrolling. */
export const DEFAULT_MAX_COLUMNS = 200

export type SheetCell = {
  text: string
  /** Right-aligned when true, the one piece of formatting a numeric column cannot do without. */
  numeric?: boolean
}

export type SheetData = {
  name: string
  rows: SheetCell[][]
  /** Rows in the file, before truncation. */
  totalRows: number
  truncated: boolean
}

export type XlsxParseResult =
  | { status: 'ok'; sheets: SheetData[] }
  /** `exceljs` is not installed, or its chunk failed to load. */
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

type ExcelCell = {
  value: unknown
  numFmt?: string
  text?: string
}

type ExcelRow = {
  getCell: (column: number) => ExcelCell
}

type ExcelWorksheet = {
  name: string
  rowCount: number
  columnCount: number
  getRow: (row: number) => ExcelRow
}

type ExcelWorkbook = {
  worksheets: ExcelWorksheet[]
  xlsx: { load: (data: ArrayBuffer) => Promise<unknown> }
}

type ExcelModule = { Workbook: new () => ExcelWorkbook }

let modulePromise: Promise<ExcelModule | null> | null = null

async function load(): Promise<ExcelModule | null> {
  if (!modulePromise) {
    modulePromise = import('exceljs')
      .then((mod) => {
        const candidate = mod as unknown as { default?: ExcelModule } & Partial<ExcelModule>
        // The browser build exports the namespace itself; the node build puts it on
        // `default`. Which one a bundler picks depends on its `browser` field handling.
        return candidate.Workbook ? (candidate as ExcelModule) : (candidate.default ?? null)
      })
      .catch(() => null)
  }
  return modulePromise
}

export type ParseXlsxOptions = {
  maxRows?: number
  maxColumns?: number
}

/** Parses a workbook into rows of display strings. Never throws. */
export async function parseXlsx(
  data: ArrayBuffer,
  options: ParseXlsxOptions = {},
): Promise<XlsxParseResult> {
  const { maxRows = DEFAULT_MAX_ROWS, maxColumns = DEFAULT_MAX_COLUMNS } = options

  const excel = await load()
  if (!excel) return { status: 'unavailable' }

  try {
    const workbook = new excel.Workbook()
    await workbook.xlsx.load(data)

    const sheets = workbook.worksheets.map((sheet) => {
      const columns = Math.min(sheet.columnCount || 0, maxColumns)
      const total = sheet.rowCount || 0
      const limit = Math.min(total, maxRows)
      const rows: SheetCell[][] = []

      // 1-based on both axes: that is how the file is addressed, and converting here would
      // only move the off-by-one somewhere less obvious.
      for (let r = 1; r <= limit; r += 1) {
        const row = sheet.getRow(r)
        const cells: SheetCell[] = []
        for (let c = 1; c <= columns; c += 1) {
          cells.push(formatCell(row.getCell(c)))
        }
        rows.push(cells)
      }

      return { name: sheet.name, rows, totalRows: total, truncated: total > limit }
    })

    return { status: 'ok', sheets }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * A cell as text.
 *
 * Number formats are handled approximately and on purpose: the full ECMA-376 format grammar
 * has conditional sections, colour codes and locale tokens, and implementing it would be a
 * bigger job than everything else in this directory put together. What is covered is what
 * actually changes whether a preview is readable — percentages, dates, and a decimal count —
 * and anything else falls back to the value as written.
 */
function formatCell(cell: ExcelCell): SheetCell {
  const value = cell.value

  if (value === null || value === undefined) return { text: '' }

  if (typeof value === 'number') {
    return { text: formatNumber(value, cell.numFmt), numeric: true }
  }

  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' }

  if (value instanceof Date) {
    // A format without a time token means the time is noise, not information.
    const withTime = /[hs]/.test(cell.numFmt ?? '')
    return { text: withTime ? value.toLocaleString() : value.toLocaleDateString(), numeric: true }
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>

    // A formula cell: show what it evaluated to. The formula itself belongs in a tooltip at
    // most — a grid of `=SUM(B2:B9)` tells the reader nothing about the numbers.
    if ('result' in record) return formatCell({ value: record.result, numFmt: cell.numFmt })
    if ('richText' in record && Array.isArray(record.richText)) {
      return {
        text: record.richText.map((run) => String((run as { text?: string }).text ?? '')).join(''),
      }
    }
    if ('text' in record) return { text: String(record.text ?? '') }
    if ('hyperlink' in record) return { text: String(record.hyperlink ?? '') }
    if ('error' in record) return { text: String(record.error ?? '') }
  }

  return { text: String(value) }
}

function formatNumber(value: number, numFmt: string | undefined): string {
  if (!numFmt || numFmt === 'General') return String(value)

  if (numFmt.includes('%')) {
    const decimals = decimalPlaces(numFmt)
    return `${(value * 100).toFixed(decimals)}%`
  }

  // A date stored as a serial number with a date format on it.
  if (/[ymd]/i.test(numFmt) && !/[eE]/.test(numFmt)) {
    const date = excelSerialToDate(value)
    if (date) return /[hs]/.test(numFmt) ? date.toLocaleString() : date.toLocaleDateString()
  }

  const decimals = decimalPlaces(numFmt)
  const grouped = numFmt.includes('#,##')
  if (grouped) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

function decimalPlaces(numFmt: string): number {
  const match = /\.(0+)/.exec(numFmt)
  return match?.[1]?.length ?? 0
}

/**
 * Excel's serial dates: day 1 is 1900-01-01, and the epoch is offset by two days because the
 * format keeps Lotus 1-2-3's non-existent 29 February 1900.
 */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const milliseconds = Math.round((serial - 25_569) * 86_400_000)
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}
