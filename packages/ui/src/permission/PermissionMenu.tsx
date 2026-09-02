'use client'

import {
  usePermissionMenu,
  type PermissionDecision,
  type PermissionOption,
  type PermissionRequest,
  type PermissionResolution,
} from '@xinjiyuan97/chat-core'
import { useEffect, useRef } from 'react'

import { cn } from '../lib/cn'
import { BanIcon, CheckIcon, ShieldIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import type { ChatLocale } from '../provider/locale'

export type PermissionMenuProps = {
  request: PermissionRequest
  /** Controlled resolution. Present means the card renders as a read-only record. */
  resolution?: PermissionResolution
  onDecide?: (resolution: PermissionResolution) => void
  /** Overrides both `request.options` and the built-in three. */
  options?: PermissionOption[]
  /** Escape denies. On by default. */
  denyOnEscape?: boolean
  className?: string
}

/**
 * The approval prompt: what is about to happen, and the three ways to answer.
 *
 * Inline in the transcript rather than a modal, for two reasons. A modal would hide the
 * reasoning and tool calls that led here — which is exactly the context needed to judge
 * the request — and it would vanish on answer, leaving no record of what was approved.
 * This card stays put and collapses into a one-line receipt.
 *
 * The keyboard model is the terminal's: number keys commit directly, Escape means "no".
 * See `usePermissionMenu` in core for the state machine.
 */
export function PermissionMenu(props: PermissionMenuProps) {
  const { request, resolution, onDecide, options, denyOnEscape, className } = props
  const locale = useLocale()

  const menu = usePermissionMenu({ request, resolution, options, onDecide, denyOnEscape })
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  /* Focus follows the cursor only when the cursor was moved by the keyboard. Doing it on
   * mount would yank a scrolling transcript to this card, and doing it on hover would
   * fight the pointer. */
  useEffect(() => {
    if (!menu.focusActive) return
    optionRefs.current[menu.activeIndex]?.focus()
  }, [menu.focusActive, menu.activeIndex])

  /* Choosing "deny" hands the caret straight to the reason box — that option exists to be
   * typed into. Keyed on `promptSeq` rather than on `promptingForReason` so that merely
   * arrowing across the deny row leaves focus on the menu. */
  const { promptSeq } = menu
  useEffect(() => {
    if (promptSeq > 0) reasonRef.current?.focus()
  }, [promptSeq])

  if (menu.settled && menu.resolution) {
    return <PermissionRecord request={request} resolution={menu.resolution} className={className} />
  }

  const risk = request.risk ?? 'low'

  return (
    <div
      className={cn(
        'my-2.5 overflow-hidden rounded-cc-md border bg-cc-surface shadow-cc-card',
        // The whole card carries the risk, not just a badge. A red glyph on an otherwise
        // ordinary panel is exactly what a reader skims past on the way to the buttons.
        risk === 'high' && 'border-cc-danger/40 bg-cc-danger-subtle/40',
        risk === 'medium' && 'border-cc-warning/40 bg-cc-warning-subtle/40',
        risk === 'low' && 'border-cc-border',
        className,
      )}
      data-cc-permission={request.id}
      data-cc-risk={risk}
    >
      <div className="px-3.5 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <ShieldIcon
            size={15}
            className={cn(
              'shrink-0',
              risk === 'high'
                ? 'text-cc-danger'
                : risk === 'medium'
                  ? 'text-cc-warning'
                  : 'text-cc-muted',
            )}
          />
          <span className="min-w-0 flex-1 truncate text-cc-sm font-medium text-cc-fg">
            {request.title ?? locale.permissionTitle(request.toolName)}
          </span>
          {risk !== 'low' && (
            <span
              className={cn(
                'shrink-0 rounded-cc-xs px-1.5 py-px text-cc-xs font-medium',
                risk === 'high'
                  ? 'bg-cc-danger/12 text-cc-danger'
                  : 'bg-cc-warning/15 text-cc-warning',
              )}
            >
              {risk === 'high' ? locale.permissionRiskHigh : locale.permissionRiskMedium}
            </span>
          )}
        </div>

        {request.detail && (
          /* Verbatim and selectable. The user is approving *this string*, so it must be
             copyable and must never be reflowed or prettified. */
          <pre
            className={cn(
              'mt-2 overflow-x-auto rounded-cc-sm bg-cc-sunken/70 px-2.5 py-2',
              'font-cc-mono text-cc-xs leading-[1.6] text-cc-fg',
            )}
            data-cc-lang={request.detailLanguage}
          >
            {request.detail}
          </pre>
        )}
      </div>

      {/* The container owns the arrow / number / Escape handling for its roving-tabindex
          children, so the key handler sits here rather than on each button. */}
      <div
        role="menu"
        aria-label={locale.permissionMenu}
        onKeyDown={menu.onKeyDown}
        className="border-t border-cc-border/70 p-1"
      >
        {/* The cursor deliberately does not follow the pointer. Hover only tints the row;
            moving the selection on `mouseenter` made the card twitch — the active row swaps
            its label to `font-medium` and fills its number badge, so simply crossing the
            menu on the way somewhere else animated three rows in turn. Clicking still
            commits the row under the pointer, so nothing is lost. */}
        {menu.options.map((option, index) => {
          const active = index === menu.activeIndex
          return (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              type="button"
              role="menuitem"
              disabled={option.disabled}
              tabIndex={active ? 0 : -1}
              onClick={() => menu.choose(index)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-cc-xs px-2 py-1.5 text-left',
                'transition-colors duration-150 ease-cc outline-none',
                'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                'disabled:pointer-events-none disabled:opacity-45',
                // No accent fill on the active row: the accent budget for a screen is one
                // place, and in a chat that place is the send button.
                active ? 'bg-cc-subtle' : 'hover:bg-cc-subtle/60',
              )}
            >
              <span
                className={cn(
                  'mt-px flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center',
                  'rounded-cc-xs font-cc-mono text-cc-xs tabular-nums',
                  active ? 'bg-cc-sunken text-cc-fg' : 'text-cc-faint',
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'truncate text-cc-sm',
                    active ? 'font-medium text-cc-fg' : 'text-cc-muted',
                  )}
                >
                  {option.label ?? defaultLabel(option.decision, locale)}
                </span>
                <span className="mt-0.5 text-cc-xs leading-[1.5] text-cc-faint">
                  {option.description ?? defaultHint(option.decision, locale)}
                </span>
              </span>
            </button>
          )
        })}

        {menu.promptingForReason && (
          <div className="animate-cc-fade-in px-2 pb-1 pt-1.5">
            <label className="sr-only" htmlFor={`${request.id}-reason`}>
              {locale.permissionReasonLabel}
            </label>
            <textarea
              id={`${request.id}-reason`}
              ref={reasonRef}
              rows={2}
              value={menu.reason}
              onChange={(event) => menu.setReason(event.target.value)}
              onKeyDown={(event) => {
                /* Every key is handled here rather than bubbling: inside a textarea, `2`
                   and `↓` are text and caret movement, not menu commands. */
                event.stopPropagation()
                if (event.nativeEvent.isComposing) return
                // Enter and Escape both commit the denial. The hand is already in the box
                // after typing a reason; reaching back to the menu row is pure friction.
                if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
                  event.preventDefault()
                  menu.submit()
                }
              }}
              placeholder={locale.permissionReasonPlaceholder}
              className={cn(
                'w-full resize-none rounded-cc-sm border border-cc-border bg-cc-surface',
                'px-2 py-1.5 text-cc-sm text-cc-fg placeholder:text-cc-faint',
                'outline-none transition-colors duration-150 ease-cc',
                'focus:border-cc-border-strong focus-visible:ring-2 focus-visible:ring-cc-accent/45',
              )}
            />
            <div className="mt-1.5 flex justify-end">
              <button
                type="button"
                disabled={!menu.canSubmit}
                onClick={() => menu.submit()}
                className={cn(
                  'inline-flex h-7 items-center rounded-cc-sm px-2.5 text-cc-xs font-medium',
                  'bg-cc-subtle text-cc-fg transition-colors duration-150 ease-cc',
                  'hover:bg-cc-sunken disabled:pointer-events-none disabled:opacity-45',
                  'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                )}
              >
                {locale.permissionSubmit}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * What a decided request leaves behind.
 *
 * One line, dimmed, still in place. The transcript is the audit trail — an approval that
 * disappears once granted is one nobody can point at afterwards.
 */
function PermissionRecord({
  request,
  resolution,
  className,
}: {
  request: PermissionRequest
  resolution: PermissionResolution
  className?: string
}) {
  const locale = useLocale()
  const denied = resolution.decision === 'deny'

  return (
    <div
      className={cn(
        'my-1.5 rounded-cc-sm border border-cc-border bg-cc-surface/60 px-2.5 py-2 opacity-70',
        className,
      )}
      data-cc-permission={request.id}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {denied ? (
          <BanIcon size={13} className="shrink-0 text-cc-muted" />
        ) : (
          <CheckIcon size={13} className="shrink-0 text-cc-success" />
        )}
        <span className="shrink-0 text-cc-xs font-medium text-cc-fg">
          {denied
            ? locale.permissionDenied
            : resolution.decision === 'allow-always'
              ? locale.permissionAllowedAlways
              : locale.permissionAllowedOnce}
        </span>
        <span className="shrink-0 text-cc-faint">·</span>
        <span className="truncate font-cc-mono text-cc-xs text-cc-muted">
          {request.detail ?? request.title ?? request.toolName}
        </span>
      </div>

      {resolution.reason && (
        <p className="mt-1 pl-[1.15rem] text-cc-xs leading-[1.5] text-cc-faint">
          {resolution.reason}
        </p>
      )}
    </div>
  )
}

function defaultLabel(decision: PermissionDecision, locale: ChatLocale): string {
  if (decision === 'allow-once') return locale.permissionAllowOnce
  if (decision === 'allow-always') return locale.permissionAllowAlways
  return locale.permissionDeny
}

function defaultHint(decision: PermissionDecision, locale: ChatLocale): string {
  if (decision === 'allow-once') return locale.permissionAllowOnceHint
  if (decision === 'allow-always') return locale.permissionAllowAlwaysHint
  return locale.permissionDenyHint
}
