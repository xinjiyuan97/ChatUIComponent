'use client'

import { useId, useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { ChevronRightIcon } from '../icons'

export type CollapsibleProps = {
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Rendered inside the trigger button, to the right of the chevron. */
  header: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  /** Hides the chevron when the disclosure state is conveyed some other way. */
  hideChevron?: boolean
}

/**
 * Disclosure used by reasoning blocks, tool calls and JSON panels.
 *
 * The open/close animation uses `grid-template-rows: 0fr -> 1fr` rather than an
 * animated `max-height`. A max-height animation needs a guessed upper bound, which either
 * clips tall content or makes short content ease for most of its duration against empty
 * space; the grid technique animates to the content's real height with no magic number.
 */
export function Collapsible(props: CollapsibleProps) {
  const {
    open: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    header,
    children,
    className,
    headerClassName,
    contentClassName,
    hideChevron,
  } = props

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const contentId = useId()

  const toggle = () => {
    const next = !open
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-cc-sm py-1 text-left',
          'text-cc-sm text-cc-muted transition-colors duration-150 ease-cc',
          'hover:text-cc-fg',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          headerClassName,
        )}
      >
        {!hideChevron && (
          <ChevronRightIcon
            size={14}
            className={cn(
              'shrink-0 text-cc-faint transition-transform duration-200 ease-cc',
              'group-hover:text-cc-muted',
              open && 'rotate-90',
            )}
          />
        )}
        {header}
      </button>

      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-cc',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        {/* `min-h-0` is required for the collapsed row to actually reach zero height. */}
        <div className={cn('min-h-0 overflow-hidden', contentClassName)} aria-hidden={!open}>
          {children}
        </div>
      </div>
    </div>
  )
}
