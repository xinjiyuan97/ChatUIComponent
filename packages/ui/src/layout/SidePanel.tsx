'use client'

import {
  useResizablePanel,
  type SidePanelController,
  type SidePanelItem,
} from '@xinjiyuan97/chat-core'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { cn } from '../lib/cn'
import { CloseIcon, FileIcon } from '../icons'
import { useLocale, usePanelDefinition } from '../provider/ChatThemeProvider'
import type { PanelGlyph } from '../provider/panels'

const DEFAULT_WIDTH = 360
const MIN_WIDTH = 280
const MAX_WIDTH = 720

/** `matches` throws on a pseudo-class the engine does not know, and a focus handler is not
 * a place to throw. Falling back to "not keyboard focus" only costs a transition. */
function isKeyboardFocus(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return false
  }
}

export type SidePanelProps = {
  panel: SidePanelController
  /** Controlled width in px; omit to let the panel manage its own. */
  width?: number
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  onWidthChange?: (width: number) => void
  /** `localStorage` key for remembering the width across sessions. Omit to not persist. */
  storageKey?: string
  /** Drag handle on the inner edge. On by default. */
  resizable?: boolean
  /** Extra controls at the right end of the tab strip — close-all, pop-out, a menu. */
  actions?: ReactNode
  className?: string
}

/**
 * The right-hand column: a tab strip over one piece of host-registered content.
 *
 * Knows nothing about what it holds. Every item names a `kind`, the theme provider's
 * `panels` registry says what draws that kind, and the panel just supplies the frame —
 * which is what lets the same column show a file preview now and a diff, a run log or a
 * settings pane later without touching this file.
 *
 * The shell stays mounted at zero width when nothing is open. Mounting it only when there
 * are tabs would mean no open/close transition at all, since there is no previous width to
 * animate from; keeping it and collapsing `width` is the horizontal twin of the
 * `grid-template-rows` trick in `ChatDock`, and it transitions to a real layout with no
 * magic numbers. The contents are still unmounted while closed, so nothing inside keeps
 * fetching or playing.
 */
export function SidePanel({
  panel,
  width: controlledWidth,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  onWidthChange,
  storageKey,
  resizable = true,
  actions,
  className,
}: SidePanelProps) {
  const locale = useLocale()
  const resize = useResizablePanel({
    defaultWidth,
    min: minWidth,
    max: maxWidth,
    width: controlledWidth,
    onWidthChange,
    storageKey,
    side: 'left',
  })

  /**
   * True while the handle holds *keyboard* focus, which is what turns the width transition
   * off for arrow-key resizing. Deliberately not `:has(...:focus-visible)` in a class: the
   * nested brackets that variant needs break Tailwind's scan of this file, and it silently
   * takes `w-[var(--cc-panel-w)]` down with it.
   */
  const [keying, setKeying] = useState(false)

  const open = panel.items.length > 0

  return (
    <aside
      aria-label={locale.sidePanel}
      // Nothing is mounted inside while closed, so hiding the empty landmark costs no
      // focusable content and spares screen readers a stray, permanently empty region.
      aria-hidden={!open || undefined}
      data-cc-panel={open ? 'open' : 'closed'}
      /* A custom property rather than `style={{ width }}`: an inline width would outrank
       * every class, including the narrow-screen overlay rules below. */
      style={{ '--cc-panel-w': `${resize.width}px` } as CSSProperties}
      className={cn(
        // `relative` is for the drag handle: without it the handle would resolve against
        // the workspace and sit on the wrong edge of the screen.
        'relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-cc-canvas',
        open ? 'w-[var(--cc-panel-w)] border-l border-cc-border' : 'w-0 border-l-0',
        /* The animation is only for open and close. Resizing with a transition attached
         * feels like the panel is lagging behind: dragging goes rubbery, and each arrow key
         * would glide 16px over 200ms, so a held key trails a fifth of a second behind and
         * keeps moving after release. */
        resize.dragging || keying ? 'transition-none' : 'transition-[width] duration-200 ease-cc',
        /* Below `lg` the panel floats over the transcript instead of squeezing it. A
         * measure that has already lost the sidebar's width cannot also give up 360px and
         * still hold a line of prose. No scrim: reading the document and typing the next
         * question are the same task. */
        open && 'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20',
        open && 'max-lg:w-full max-lg:max-w-96 max-lg:shadow-cc-raised',
        className,
      )}
    >
      {open && (
        <>
          {resizable && (
            /* A `div` rather than a `button`: `handleProps` already supplies
             * `role="separator"` with the value semantics screen readers read out, and a
             * button that reports itself as a separator is a contradiction. */
            <div
              {...resize.handleProps}
              aria-label={locale.resizePanel}
              title={locale.resizePanel}
              // A handle left focused by a click keeps the transition, so open and close
              // still animate after a drag; only keyboard focus suppresses it.
              onFocus={(event) => setKeying(isKeyboardFocus(event.currentTarget))}
              onBlur={() => setKeying(false)}
              className={cn(
                'absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize touch-none',
                'bg-transparent transition-colors duration-150 ease-cc',
                'hover:bg-cc-accent/35 focus-visible:bg-cc-accent/45 focus-visible:outline-none',
                '[&[data-cc-dragging]]:bg-cc-accent/45',
                // The overlay has no neighbour to steal width from, so there is nothing
                // sensible for the handle to do there.
                'max-lg:hidden',
              )}
            />
          )}

          <PanelTabs panel={panel} actions={actions} />
          <PanelBody panel={panel} />
        </>
      )}
    </aside>
  )
}

/**
 * The tab strip.
 *
 * A real `tablist`: arrow keys move between tabs and only the active one is tabbable, so
 * reaching the content past twelve open files takes one Tab rather than twelve.
 */
function PanelTabs({ panel, actions }: { panel: SidePanelController; actions?: ReactNode }) {
  const locale = useLocale()
  const stripRef = useRef<HTMLDivElement>(null)

  /*
   * Scroll the active tab into view.
   *
   * The strip scrolls horizontally but hides its scrollbar, so a tab that opens past the
   * right edge is both invisible and unhinted — the panel's content changes and nothing in
   * the strip moves, which reads as "my click did nothing". An agent opening its fourth
   * artefact is the ordinary case here, not an edge case.
   *
   * Rect arithmetic rather than `scrollIntoView`: that one is free to scroll every
   * scrollable ancestor, and the transcript beside the panel is one of them.
   */
  useEffect(() => {
    const strip = stripRef.current
    if (!strip || !panel.activeId) return

    strip.querySelectorAll<HTMLElement>('[data-cc-tab]').forEach((tab) => {
      if (tab.dataset.ccTab !== panel.activeId) return
      const stripRect = strip.getBoundingClientRect()
      const tabRect = tab.getBoundingClientRect()
      if (tabRect.left < stripRect.left) strip.scrollLeft -= stripRect.left - tabRect.left
      else if (tabRect.right > stripRect.right) strip.scrollLeft += tabRect.right - stripRect.right
    })
  }, [panel.activeId, panel.items])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step === 0) return

      const index = panel.items.findIndex((item) => item.id === panel.activeId)
      if (index === -1) return
      const next = panel.items[(index + step + panel.items.length) % panel.items.length]
      if (!next) return

      event.preventDefault()
      panel.activate(next.id)
      /* Focus has to follow the selection, or the next arrow key starts from the tab the
       * user just left and the strip appears to jump back. Matched by scanning `dataset`
       * rather than by building a selector: ids come from the host and may contain
       * anything, and `CSS.escape` is not everywhere this library runs. */
      const tabs = stripRef.current?.querySelectorAll<HTMLElement>('[data-cc-tab]')
      tabs?.forEach((tab) => {
        if (tab.dataset.ccTab === next.id) tab.focus()
      })
    },
    [panel],
  )

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-cc-border pl-1 pr-1.5">
      <div
        ref={stripRef}
        role="tablist"
        aria-label={locale.sidePanel}
        onKeyDown={onKeyDown}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {panel.items.map((item) => (
          <PanelTab
            key={item.id}
            item={item}
            active={item.id === panel.activeId}
            onSelect={() => panel.activate(item.id)}
            onClose={() => panel.close(item.id)}
          />
        ))}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

function PanelTab({
  item,
  active,
  onSelect,
  onClose,
}: {
  item: SidePanelItem
  active: boolean
  onSelect: () => void
  onClose: () => void
}) {
  const locale = useLocale()
  const definition = usePanelDefinition(item.kind)
  const closable = item.closable !== false

  return (
    <div
      className={cn(
        'group/tab flex max-w-48 shrink-0 items-center rounded-cc-sm',
        'transition-colors duration-150 ease-cc',
        active ? 'bg-cc-subtle' : 'hover:bg-cc-subtle/60',
      )}
    >
      <button
        type="button"
        role="tab"
        id={`cc-tab-${item.id}`}
        data-cc-tab={item.id}
        aria-selected={active}
        aria-controls={`cc-tabpanel-${item.id}`}
        // Roving tabindex: the strip is one stop, not one per open file.
        tabIndex={active ? 0 : -1}
        onClick={onSelect}
        title={item.title}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-cc-sm py-1 pl-2 text-cc-xs',
          closable ? 'pr-1' : 'pr-2',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          active ? 'text-cc-fg' : 'text-cc-muted',
        )}
      >
        <TabGlyph glyph={definition?.icon} active={active} />
        <span className="truncate">{item.title}</span>
      </button>

      {closable && (
        <button
          type="button"
          tabIndex={-1}
          onClick={onClose}
          aria-label={locale.closePanel}
          title={locale.closePanel}
          className={cn(
            'mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded-cc-xs',
            'text-cc-faint transition-[opacity,color] duration-150 ease-cc hover:text-cc-fg',
            // Always visible on the tab being read; revealed on hover elsewhere, so a row
            // of tabs is not a row of crosses.
            active ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100',
          )}
        >
          <CloseIcon size={10} />
        </button>
      )}
    </div>
  )
}

function TabGlyph({ glyph, active }: { glyph: PanelGlyph | undefined; active: boolean }) {
  const className = cn('shrink-0', active ? 'text-cc-muted' : 'text-cc-faint')

  if (glyph === undefined) return <FileIcon size={12} className={className} />
  if (typeof glyph === 'function') {
    const Glyph = glyph
    return <Glyph size={12} className={className} />
  }
  return <span className={cn('inline-flex items-center', className)}>{glyph}</span>
}

/**
 * The active tab's content.
 *
 * Only the active item is mounted. That is the direct consequence of showing one at a
 * time: a background tab holding a `<video>`, a PDF viewer or a polling log would go on
 * costing bandwidth and main-thread time for something nobody is looking at. The trade is
 * that switching away and back remounts — a renderer that must survive it should keep its
 * state above the panel or in the item's `data`.
 */
function PanelBody({ panel }: { panel: SidePanelController }) {
  const locale = useLocale()
  const item = panel.active
  const definition = usePanelDefinition(item?.kind ?? '')

  if (!item) return null

  const Render = definition?.render

  return (
    <div
      role="tabpanel"
      id={`cc-tabpanel-${item.id}`}
      aria-labelledby={`cc-tab-${item.id}`}
      tabIndex={0}
      className={cn(
        'min-h-0 flex-1 overflow-auto overscroll-contain outline-none',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cc-accent/45',
        // On by default; anything meant to reach the edges — an image, a PDF, a renderer
        // with its own toolbar — turns it off.
        definition?.padded === false ? '' : 'p-3',
      )}
    >
      {Render ? (
        /* Keyed by id so switching tabs of the same kind gives the renderer a fresh mount
         * instead of feeding new `data` into the previous one's state. */
        <Render key={item.id} item={item} close={() => panel.close(item.id)} />
      ) : (
        <p className="p-3 text-cc-sm text-cc-muted">{locale.panelUnavailable(item.kind)}</p>
      )}
    </div>
  )
}
