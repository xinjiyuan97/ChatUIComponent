'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import { useEffect, useState } from 'react'

import { cn } from '../lib/cn'
import { DownloadIcon, SpinnerIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { PreviewFrame, PreviewToolbarLabel, PreviewToolbarSpacer } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { UnsupportedPreview } from './UnsupportedPreview'
import { parseXlsx, type SheetData, type XlsxParseResult } from './xlsx-renderer'

export type ExcelPreviewProps = {
  file: PreviewFile
  className?: string
}

/** A workbook: `exceljs` reads it, the grid below is ours. */
export function ExcelPreview({ file, className }: ExcelPreviewProps) {
  return (
    <PreviewLoader file={file} as="arrayBuffer">
      {(data) => <ExcelWorkbook data={data} file={file} className={className} />}
    </PreviewLoader>
  )
}

function ExcelWorkbook({
  data,
  file,
  className,
}: {
  data: ArrayBuffer
  file: PreviewFile
  className?: string
}) {
  const locale = useLocale()
  const [result, setResult] = useState<XlsxParseResult | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    let cancelled = false
    setResult(null)
    setActive(0)
    void parseXlsx(data).then((next) => {
      if (!cancelled) setResult(next)
    })
    return () => {
      cancelled = true
    }
  }, [data])

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-cc-sm text-cc-faint">
        <SpinnerIcon size={14} />
        {locale.previewLoading}
      </div>
    )
  }

  if (result.status !== 'ok') {
    return (
      <UnsupportedPreview
        file={file}
        className={className}
        reason={result.status === 'unavailable' ? 'renderer-missing' : 'render-failed'}
        packageName="exceljs"
        detail={result.status === 'error' ? result.message : undefined}
      />
    )
  }

  const sheet = result.sheets[active]

  return (
    <PreviewFrame
      className={className}
      scroll={false}
      toolbar={
        <>
          <PreviewToolbarLabel>{locale.previewSheets}</PreviewToolbarLabel>
          {/* Tabs live in the toolbar rather than along the bottom edge as in Excel: the
              panel is already short, and a second horizontal bar down there costs a row of
              cells on every screen to save one habit. */}
          <div className="flex min-w-0 items-center gap-0.5">
            {result.sheets.map((entry, index) => (
              <button
                key={entry.name}
                type="button"
                aria-pressed={index === active}
                onClick={() => setActive(index)}
                className={cn(
                  'max-w-32 shrink-0 truncate rounded-cc-sm px-1.5 py-0.5 text-cc-xs',
                  'transition-colors duration-150 ease-cc outline-none',
                  'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                  index === active
                    ? 'bg-cc-accent-subtle text-cc-accent'
                    : 'text-cc-muted hover:bg-cc-subtle hover:text-cc-fg',
                )}
              >
                {entry.name}
              </button>
            ))}
          </div>
          <PreviewToolbarSpacer />
          {canDownload(file) && (
            <IconButton
              size="sm"
              label={locale.previewDownload}
              icon={<DownloadIcon size={14} />}
              onClick={() => downloadFile(file)}
            />
          )}
        </>
      }
    >
      {sheet ? <SheetGrid sheet={sheet} /> : null}
    </PreviewFrame>
  )
}

function SheetGrid({ sheet }: { sheet: SheetData }) {
  const locale = useLocale()
  const [header, ...body] = sheet.rows

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="border-separate border-spacing-0 text-cc-xs">
          {header && (
            <thead>
              <tr>
                {/* The corner: sticky on both axes, so it does not slide out from under the
                    row numbers when the grid is scrolled diagonally. */}
                <th className="sticky left-0 top-0 z-20 border-b border-r border-cc-border bg-cc-subtle px-2 py-1" />
                {header.map((cell, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={cn(
                      'sticky top-0 z-10 border-b border-r border-cc-border bg-cc-subtle',
                      'max-w-64 truncate px-2 py-1 text-left font-medium text-cc-fg',
                    )}
                    title={cell.text}
                  >
                    {cell.text}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex} className="group/row">
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 border-b border-r border-cc-border bg-cc-subtle',
                    'px-2 py-1 text-right font-normal tabular-nums text-cc-faint',
                  )}
                >
                  {/* +2: row 1 is the header, and the file counts from 1. */}
                  {rowIndex + 2}
                </th>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      'max-w-64 truncate border-b border-r border-cc-border px-2 py-1 text-cc-fg',
                      'group-hover/row:bg-cc-subtle',
                      cell.numeric && 'text-right tabular-nums',
                    )}
                    title={cell.text}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sheet.truncated && (
        <p className="shrink-0 border-t border-cc-border px-3 py-1.5 text-cc-xs text-cc-faint">
          {locale.previewRowsTruncated(sheet.rows.length, sheet.totalRows)}
        </p>
      )}
    </div>
  )
}
