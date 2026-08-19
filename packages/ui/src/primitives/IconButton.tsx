'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '../lib/cn'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: the button has no text, so this is its only accessible name. */
  label: string
  icon: ReactNode
  size?: 'sm' | 'md'
  /** Renders in the accent colour, used for an applied reaction. */
  active?: boolean
  tone?: 'default' | 'danger'
  /** Show the label as a tooltip on hover and focus. */
  tooltip?: boolean
}

/**
 * Square icon-only button with a CSS-only tooltip.
 *
 * The tooltip is a pseudo-element rather than a portal because these appear in dense
 * hover rows: a portalled tooltip per action button is a lot of machinery for a string,
 * and `aria-label` already carries the name for assistive tech.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', active, tone = 'default', tooltip = true, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-cc-tooltip={tooltip ? label : undefined}
      aria-pressed={active}
      className={cn(
        'group/icon relative inline-flex shrink-0 items-center justify-center rounded-cc-sm',
        'transition-colors duration-150 ease-cc',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'size-6' : 'size-7',
        active
          ? 'bg-cc-accent-subtle text-cc-accent'
          : tone === 'danger'
            ? 'text-cc-muted hover:bg-cc-danger-subtle hover:text-cc-danger'
            : 'text-cc-muted hover:bg-cc-subtle hover:text-cc-fg',
        // The tooltip: hidden until hover or keyboard focus, never intercepting pointer
        // events so it cannot block the button underneath it.
        tooltip && [
          'after:pointer-events-none after:absolute after:bottom-[calc(100%+6px)] after:left-1/2',
          'after:-translate-x-1/2 after:whitespace-nowrap after:rounded-cc-xs',
          'after:bg-cc-fg after:px-1.5 after:py-1 after:text-cc-xs after:font-medium',
          'after:text-cc-canvas after:opacity-0 after:transition-opacity after:duration-150',
          'after:content-[attr(data-cc-tooltip)] after:z-20',
          'hover:after:opacity-100 focus-visible:after:opacity-100',
        ],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
})
