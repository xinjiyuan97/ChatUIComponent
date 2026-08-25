'use client'

import type { A2UIComponentProps } from '@xinjiyuan97/chat-a2ui'
import { createElement, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { AlertIcon, CheckIcon, CloseIcon, ExternalLinkIcon } from '../icons'
import { CodeBlock as UICodeBlock } from '../markdown/CodeBlock'
import { Markdown as UIMarkdown } from '../markdown/Markdown'
import { arr, bool, num, oneOf, optionalStr, str } from './props'

/** Text content comes from `props.text`, `props.value`, or the node's children. */
function textOf(props: Record<string, unknown>, children: ReactNode): ReactNode {
  const explicit = optionalStr(props['text'] ?? props['value'] ?? props['content'])
  return explicit ?? children
}

const TONES = {
  default: 'text-cc-fg',
  muted: 'text-cc-muted',
  faint: 'text-cc-faint',
  accent: 'text-cc-accent',
  success: 'text-cc-success',
  warning: 'text-cc-warning',
  danger: 'text-cc-danger',
} as const

type Tone = keyof typeof TONES

const SIZES = {
  xs: 'text-cc-xs',
  sm: 'text-cc-sm',
  md: 'text-cc-body',
  lg: 'text-[1.05rem]',
} as const

export function Text({ props, children }: A2UIComponentProps) {
  return (
    <p
      className={cn(
        'leading-[1.6]',
        SIZES[oneOf(props['size'], Object.keys(SIZES) as Array<keyof typeof SIZES>, 'sm')],
        TONES[oneOf(props['tone'], Object.keys(TONES) as Tone[], 'default')],
        bool(props['bold']) && 'font-medium',
        bool(props['mono']) && 'font-mono text-cc-xs',
      )}
    >
      {textOf(props, children)}
    </p>
  )
}

export function Heading({ props, children }: A2UIComponentProps) {
  // Clamped to h3–h5: a card lives inside a message, so it must not outrank the page.
  const level = Math.min(5, Math.max(3, num(props['level'], 3)))
  const sizes: Record<number, string> = {
    3: 'text-[1.05rem]',
    4: 'text-cc-body',
    5: 'text-cc-sm',
  }

  return createElement(
    `h${level}`,
    { className: cn('font-medium text-cc-fg', sizes[level]) },
    textOf(props, children),
  )
}

export function Markdown({ props, children }: A2UIComponentProps) {
  const source = str(textOf(props, children))
  return <UIMarkdown className="text-cc-sm">{source}</UIMarkdown>
}

export function CodeBlock({ props, children }: A2UIComponentProps) {
  return (
    <UICodeBlock
      code={str(textOf(props, children))}
      language={optionalStr(props['language'] ?? props['lang'])}
      filename={optionalStr(props['filename'])}
    />
  )
}

export function Link({ props, children }: A2UIComponentProps) {
  // `href` has already been scheme-checked by the renderer's sanitiser; a rejected URL
  // arrives as undefined, and a link with no destination should not look clickable.
  const href = optionalStr(props['href'] ?? props['url'])
  const label = textOf(props, children)
  if (!href) return <span className="text-cc-muted">{label}</span>

  const external = /^https?:/i.test(href)

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'inline-flex items-center gap-1 text-cc-sm text-cc-accent underline decoration-cc-accent/30',
        'underline-offset-2 transition-colors duration-150 ease-cc hover:decoration-cc-accent',
      )}
    >
      {label}
      {external && <ExternalLinkIcon size={11} className="opacity-60" />}
    </a>
  )
}

export function Image({ props }: A2UIComponentProps) {
  const src = optionalStr(props['src'] ?? props['url'])
  if (!src) return null

  return (
    <figure className="flex flex-col gap-1">
      <img
        src={src}
        alt={str(props['alt'])}
        loading="lazy"
        className="max-h-80 w-full rounded-cc-sm border border-cc-border object-contain"
      />
      {optionalStr(props['caption']) && (
        <figcaption className="text-cc-xs text-cc-faint">{str(props['caption'])}</figcaption>
      )}
    </figure>
  )
}

const BADGE_TONES = {
  default: 'bg-cc-subtle text-cc-muted',
  accent: 'bg-cc-accent-subtle text-cc-accent',
  success: 'bg-cc-success-subtle text-cc-success',
  warning: 'bg-cc-warning-subtle text-cc-warning',
  danger: 'bg-cc-danger-subtle text-cc-danger',
} as const

export function Badge({ props, children }: A2UIComponentProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-cc-full px-2 py-0.5 text-cc-xs font-medium',
        BADGE_TONES[
          oneOf(
            props['tone'],
            Object.keys(BADGE_TONES) as Array<keyof typeof BADGE_TONES>,
            'default',
          )
        ],
      )}
    >
      {textOf(props, children)}
    </span>
  )
}

const ALERT_TONES = {
  info: { box: 'border-cc-border bg-cc-subtle', icon: 'text-cc-muted' },
  success: { box: 'border-cc-success/30 bg-cc-success-subtle', icon: 'text-cc-success' },
  warning: { box: 'border-cc-warning/30 bg-cc-warning-subtle', icon: 'text-cc-warning' },
  danger: { box: 'border-cc-danger/30 bg-cc-danger-subtle', icon: 'text-cc-danger' },
} as const

export function Alert({ props, children }: A2UIComponentProps) {
  const tone = oneOf(
    props['tone'],
    Object.keys(ALERT_TONES) as Array<keyof typeof ALERT_TONES>,
    'info',
  )
  const style = ALERT_TONES[tone]
  const title = optionalStr(props['title'])

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-cc-sm border p-3', style.box)}
    >
      <span className={cn('mt-px shrink-0', style.icon)}>
        {tone === 'success' ? <CheckIcon size={14} /> : <AlertIcon size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-cc-sm font-medium text-cc-fg">{title}</p>}
        <div className="text-cc-sm leading-[1.6] text-cc-muted">{textOf(props, children)}</div>
      </div>
    </div>
  )
}

export function Progress({ props }: A2UIComponentProps) {
  const max = Math.max(1, num(props['max'], 100))
  const value = Math.min(max, Math.max(0, num(props['value'], 0)))
  const percent = Math.round((value / max) * 100)
  const label = optionalStr(props['label'])

  return (
    <div className="flex flex-col gap-1.5">
      {(label || bool(props['showValue'], true)) && (
        <div className="flex items-baseline justify-between text-cc-xs">
          <span className="text-cc-muted">{label}</span>
          {bool(props['showValue'], true) && <span className="text-cc-faint">{percent}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-cc-full bg-cc-sunken"
      >
        <div
          className="h-full rounded-cc-full bg-cc-accent transition-[width] duration-300 ease-cc"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function List({ props, children }: A2UIComponentProps) {
  const items = arr(props['items'])
  const ordered = bool(props['ordered'])

  // Children win when present: a spec can nest arbitrary nodes per row instead of strings.
  if (items.length === 0) {
    return createElement(
      ordered ? 'ol' : 'ul',
      {
        className: cn(
          'flex flex-col gap-1 pl-5 text-cc-sm',
          ordered ? 'list-decimal' : 'list-disc',
        ),
      },
      children,
    )
  }

  return createElement(
    ordered ? 'ol' : 'ul',
    {
      className: cn(
        'flex flex-col gap-1 pl-5 text-cc-sm text-cc-muted',
        ordered ? 'list-decimal' : 'list-disc',
      ),
    },
    items.map((item, index) => (
      <li key={index} className="leading-[1.6]">
        {renderCell(item)}
      </li>
    )),
  )
}

/**
 * A data table.
 *
 * Accepts `columns` as strings or `{key,label}` objects, and rows as arrays or objects.
 * Models emit all four combinations, and rejecting three of them means the card renders
 * empty for reasons the agent can't see.
 */
export function Table({ props }: A2UIComponentProps) {
  const rawColumns = arr(props['columns'] ?? props['headers'])
  const rows = arr(props['rows'] ?? props['data'])

  const columns = rawColumns.map((column, index) => {
    if (typeof column === 'object' && column !== null) {
      const record = column as Record<string, unknown>
      return {
        key: str(record['key'] ?? record['field'] ?? index),
        label: str(record['label'] ?? record['title'] ?? record['key'], String(index)),
      }
    }
    return { key: str(column, String(index)), label: str(column, String(index)) }
  })

  if (columns.length === 0 || rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-cc-sm border border-cc-border">
      <table className="w-full border-collapse text-cc-sm">
        <thead>
          <tr className="border-b border-cc-border bg-cc-subtle/60">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-3 py-2 text-left text-cc-xs font-medium text-cc-muted"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-cc-border last:border-0">
              {columns.map((column, columnIndex) => (
                <td key={column.key} className="px-3 py-2 align-top text-cc-fg">
                  {renderCell(cellOf(row, column.key, columnIndex))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function cellOf(row: unknown, key: string, index: number): unknown {
  if (Array.isArray(row)) return row[index]
  if (typeof row === 'object' && row !== null) return (row as Record<string, unknown>)[key]
  return index === 0 ? row : undefined
}

/** Renders a cell value without ever handing an object to React as a child. */
function renderCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

export function KeyValue({ props }: A2UIComponentProps) {
  const entries = Object.entries(
    typeof props['items'] === 'object' && props['items'] !== null && !Array.isArray(props['items'])
      ? (props['items'] as Record<string, unknown>)
      : {},
  )
  if (entries.length === 0) return null

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-cc-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-cc-xs text-cc-faint">{key}</dt>
          <dd className="min-w-0 truncate text-cc-fg">{renderCell(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Icon({ props }: A2UIComponentProps) {
  const name = str(props['name']).toLowerCase()
  const size = num(props['size'], 14)
  const map: Record<string, typeof CheckIcon> = {
    check: CheckIcon,
    close: CloseIcon,
    alert: AlertIcon,
    link: ExternalLinkIcon,
  }
  const Component = map[name]
  if (!Component) return null

  return (
    <Component
      size={size}
      className={TONES[oneOf(props['tone'], Object.keys(TONES) as Tone[], 'muted')]}
    />
  )
}
