'use client'

import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

export type PreviewFrameProps = {
  /** The toolbar row. Omit for a viewer that has no controls. */
  toolbar?: ReactNode
  children: ReactNode
  /** Turns off the content area's own scrolling, for a viewer that scrolls internally. */
  scroll?: boolean
  className?: string
  contentClassName?: string
}

/**
 * Toolbar over content, shared by every preview.
 *
 * Its only job is consistency: a PDF, a spreadsheet and an image each want a different set
 * of controls, but if each one positions its own bar they end up at three different heights
 * and the panel flickers as you switch tabs. The bar is `shrink-0` and the content
 * `min-h-0`, which is the pair that keeps a long document scrolling inside the panel rather
 * than stretching it.
 */
export function PreviewFrame({
  toolbar,
  children,
  scroll = true,
  className,
  contentClassName,
}: PreviewFrameProps) {
  return (
    /*
     * `@container` so toolbars can respond to the *panel's* width. A media query is the wrong
     * tool here: the panel is resizable and can be 280px wide on a 27" display, which every
     * viewport breakpoint would call "wide". The frame already takes its width from its
     * parent, so `container-type: inline-size` costs nothing.
     */
    <div className={cn('@container flex h-full min-h-0 flex-col bg-cc-canvas', className)}>
      {toolbar && (
        <div
          className={cn(
            'flex h-9 shrink-0 items-center gap-1 border-b border-cc-border px-1.5',
            // Controls scroll rather than wrap: a wrapped toolbar changes the content
            // area's height, and in a panel that is being dragged narrower that means the
            // document reflows twice for every pixel of drag.
            'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {toolbar}
        </div>
      )}
      <div
        className={cn(
          'min-h-0 flex-1',
          scroll && 'overflow-auto overscroll-contain',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** A vertical rule between groups of toolbar buttons. */
export function PreviewToolbarSeparator() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-cc-border" />
}

/** Pushes everything after it to the right end of the toolbar. */
export function PreviewToolbarSpacer() {
  return <span aria-hidden className="flex-1" />
}

/** A read-only piece of status in the toolbar — a language name, a zoom percentage. */
export function PreviewToolbarLabel({
  children,
  collapse,
}: {
  children: ReactNode
  /**
   * Drop this label when the panel gets narrow. Set it on status text that a crowded toolbar
   * can afford to lose — the page total, the zoom percentage — so the *buttons* stay on
   * screen. A toolbar that scrolls hides its right-hand end behind a gesture nobody thinks to
   * make; losing "共 4 页" costs a glance, losing 下载 costs the feature.
   */
  collapse?: boolean
}) {
  return (
    <span
      className={cn(
        'shrink-0 px-1.5 text-cc-xs tabular-nums text-cc-muted',
        collapse && '@max-[22rem]:hidden',
      )}
    >
      {children}
    </span>
  )
}

export type PreviewToggleOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

export type PreviewToggleProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: PreviewToggleOption<T>[]
  /** Names the group for assistive tech — "view mode", say. */
  label?: string
}

/**
 * The rendered/source switch, as a segmented control.
 *
 * Both states are visible at once rather than one button that toggles, because the label on
 * a toggle is ambiguous the moment you look away from it: a button reading "Source" could
 * mean "you are viewing source" or "click for source". Two segments with one selected has
 * no such reading.
 */
export function PreviewToggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: PreviewToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center gap-0.5 rounded-cc-sm bg-cc-subtle p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-cc-sm px-1.5 py-0.5 text-cc-xs',
              'transition-colors duration-150 ease-cc outline-none',
              'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
              selected
                ? 'bg-cc-surface text-cc-fg shadow-cc-card'
                : 'text-cc-muted hover:text-cc-fg',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
