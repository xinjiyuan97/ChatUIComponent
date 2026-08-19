'use client'

import { useState } from 'react'

import { cn } from '../lib/cn'
import { ChevronRightIcon } from '../icons'

export type JsonViewerProps = {
  value: unknown
  /** Nodes at or below this depth start expanded. */
  defaultExpandedDepth?: number
  /** Raw text shown verbatim when the value could not be parsed as JSON. */
  raw?: string
  className?: string
}

/**
 * Collapsible tree for tool arguments and results.
 *
 * Tool payloads are frequently a small envelope wrapped around one enormous field — a file
 * body, a page of search results. Printing them with `JSON.stringify(value, null, 2)`
 * buries the useful keys under thousands of lines, so this renders one level at a time and
 * lets the reader open only the branch they care about.
 */
export function JsonViewer({ value, defaultExpandedDepth = 1, raw, className }: JsonViewerProps) {
  if (raw !== undefined) {
    return (
      <pre
        className={cn(
          'overflow-x-auto whitespace-pre-wrap break-words font-cc-mono text-cc-xs text-cc-muted',
          className,
        )}
      >
        {raw}
      </pre>
    )
  }

  return (
    <div className={cn('font-cc-mono text-cc-xs leading-[1.7] text-cc-fg', className)}>
      <JsonNode value={value} depth={0} defaultExpandedDepth={defaultExpandedDepth} />
    </div>
  )
}

type NodeProps = {
  name?: string
  value: unknown
  depth: number
  defaultExpandedDepth: number
  /** Renders a trailing comma, so sibling rows read as real JSON. */
  comma?: boolean
}

function JsonNode({ name, value, depth, defaultExpandedDepth, comma }: NodeProps) {
  const container = isContainer(value)
  const [open, setOpen] = useState(depth < defaultExpandedDepth)

  if (!container) {
    return (
      <div className="flex items-start gap-1.5" style={indent(depth)}>
        {name !== undefined && <JsonKey name={name} />}
        <Primitive value={value} />
        {comma && <span className="text-cc-faint">,</span>}
      </div>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const array = Array.isArray(value)
  const [openBrace, closeBrace] = array ? ['[', ']'] : ['{', '}']

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-expanded={open}
        className={cn(
          'group/json flex w-full items-center gap-1 rounded-cc-xs text-left',
          'outline-none hover:bg-cc-subtle/70 focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        )}
        style={indent(depth)}
      >
        <ChevronRightIcon
          size={11}
          className={cn(
            'shrink-0 text-cc-faint transition-transform duration-150 ease-cc',
            open && 'rotate-90',
          )}
        />
        {name !== undefined && <JsonKey name={name} />}
        <span className="text-cc-faint">{openBrace}</span>
        {!open && (
          <>
            {/* The count is what makes a collapsed row informative — "12 items" tells you
                whether opening it is worth the scroll. */}
            <span className="px-1 text-cc-faint">
              {entries.length === 0 ? '' : `… ${entries.length}`}
            </span>
            <span className="text-cc-faint">{closeBrace}</span>
            {comma && <span className="text-cc-faint">,</span>}
          </>
        )}
      </button>

      {open && (
        <>
          {entries.map(([key, child], index) => (
            <JsonNode
              key={key}
              name={array ? undefined : key}
              value={child}
              depth={depth + 1}
              defaultExpandedDepth={defaultExpandedDepth}
              comma={index < entries.length - 1}
            />
          ))}
          <div className="flex items-center gap-1 text-cc-faint" style={indent(depth)}>
            {/* Aligns the closing brace with the chevron column above it. */}
            <span className="inline-block w-[11px]" />
            <span>{closeBrace}</span>
            {comma && <span>,</span>}
          </div>
        </>
      )}
    </div>
  )
}

function JsonKey({ name }: { name: string }) {
  return (
    <span className="shrink-0 text-cc-muted">
      {name}
      <span className="text-cc-faint">:</span>
    </span>
  )
}

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-cc-faint">null</span>
  if (value === undefined) return <span className="text-cc-faint">undefined</span>

  switch (typeof value) {
    case 'string':
      return (
        <span className="whitespace-pre-wrap break-all text-cc-fg">
          <span className="text-cc-faint">&quot;</span>
          {value}
          <span className="text-cc-faint">&quot;</span>
        </span>
      )
    case 'number':
    case 'bigint':
      return <span className="text-cc-accent tabular-nums">{String(value)}</span>
    case 'boolean':
      return <span className="text-cc-accent">{String(value)}</span>
    default:
      return <span className="text-cc-faint">{String(value)}</span>
  }
}

function isContainer(value: unknown): boolean {
  return typeof value === 'object' && value !== null
}

/** Indentation as padding rather than nested elements, so deep trees stay flat in the DOM. */
function indent(depth: number) {
  return { paddingLeft: `${depth * 0.9}rem` }
}
