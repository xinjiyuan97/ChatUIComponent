'use client'

import type { Conversation } from '@agent-chat/core'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { cn } from '../lib/cn'
import { formatDateTime } from '../lib/format'
import { CheckIcon, CloseIcon, EditIcon, MoreIcon, PinIcon, TrashIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

export type ConversationItemProps = {
  conversation: Conversation
  active?: boolean
  /** Substring to highlight, from the search box. */
  query?: string
  /** Renders as the keyboard-focused row without moving DOM focus. */
  focused?: boolean
  collapsed?: boolean
  onSelect?: (id: string) => void
  onRename?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onTogglePin?: (id: string) => void
  /** Second line under the title — used by search results to name the owning agent. */
  subtitle?: ReactNode
  /** `treeitem` when the list is grouped by agent; `option` otherwise. */
  role?: 'option' | 'treeitem'
  /** Depth for `aria-level`, only meaningful under `role="treeitem"`. */
  level?: number
  className?: string
}

/** Row height when a subtitle is present, in px. Kept here so the class can't drift. */
export const SUBTITLE_ROW_HEIGHT = 46

/**
 * One row in the sidebar.
 *
 * The active row is marked with a 2px accent bar and a faint fill rather than a solid
 * accent background: the sidebar sits beside the conversation for the entire session, and
 * a saturated block there pulls attention away from the text the whole time.
 */
export function ConversationItem(props: ConversationItemProps) {
  const {
    conversation,
    active = false,
    query,
    focused = false,
    collapsed = false,
    onSelect,
    onRename,
    onDelete,
    onTogglePin,
    subtitle,
    role = 'option',
    level,
    className,
  } = props

  const locale = useLocale()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(conversation.id)}
        title={conversation.title}
        aria-label={conversation.title}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'mx-auto flex size-8 items-center justify-center rounded-cc-sm',
          'text-cc-xs font-medium transition-colors duration-150 ease-cc',
          active ? 'bg-cc-accent-subtle text-cc-accent' : 'text-cc-muted hover:bg-cc-subtle',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          className,
        )}
      >
        {conversation.title.trim().slice(0, 1).toUpperCase() || '·'}
      </button>
    )
  }

  if (renaming) {
    return (
      <RenameField
        initialValue={conversation.title}
        onCancel={() => setRenaming(false)}
        onSubmit={(title) => {
          setRenaming(false)
          if (title && title !== conversation.title) onRename?.(conversation.id, title)
        }}
      />
    )
  }

  return (
    <div
      role={role}
      aria-selected={active}
      aria-level={level}
      data-cc-focused={focused || undefined}
      onClick={() => onSelect?.(conversation.id)}
      onDoubleClick={() => onRename && setRenaming(true)}
      style={subtitle ? { height: SUBTITLE_ROW_HEIGHT } : undefined}
      className={cn(
        'group/item relative flex cursor-pointer items-center',
        !subtitle && 'h-[var(--cc-row-height,2.25rem)]',
        'gap-2 rounded-cc-sm pl-2.5 pr-1 transition-colors duration-150 ease-cc',
        active ? 'bg-cc-accent-subtle/60' : 'hover:bg-cc-subtle',
        // The keyboard cursor has to be visible without stealing DOM focus from the
        // listbox, so it is drawn rather than relying on :focus.
        focused && 'ring-2 ring-cc-accent/40',
        className,
      )}
      title={`${conversation.title}\n${formatDateTime(conversation.updatedAt, locale.code)}`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-cc-accent"
        />
      )}

      {conversation.pinned && <PinIcon size={11} className="shrink-0 text-cc-faint" />}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('truncate text-cc-sm', active ? 'text-cc-fg' : 'text-cc-muted')}>
          <Highlight text={conversation.title} query={query} />
        </span>
        {subtitle && <span className="truncate text-cc-xs text-cc-faint">{subtitle}</span>}
      </span>

      {confirming ? (
        <span className="flex shrink-0 items-center gap-0.5">
          <span className="pr-1 text-cc-xs text-cc-danger">{locale.confirmDelete}</span>
          <RowButton
            label={locale.delete}
            tone="danger"
            onClick={(event) => {
              event.stopPropagation()
              setConfirming(false)
              onDelete?.(conversation.id)
            }}
          >
            <CheckIcon size={13} />
          </RowButton>
          <RowButton
            label={locale.cancel}
            onClick={(event) => {
              event.stopPropagation()
              setConfirming(false)
            }}
          >
            <CloseIcon size={13} />
          </RowButton>
        </span>
      ) : (
        <span
          className={cn(
            'relative flex shrink-0 items-center opacity-0 transition-opacity duration-150 ease-cc',
            'group-hover/item:opacity-100 group-focus-within/item:opacity-100',
            menuOpen && 'opacity-100',
          )}
        >
          <RowButton
            label={locale.conversationOptions}
            expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
          >
            <MoreIcon size={14} />
          </RowButton>

          {menuOpen && (
            <ConversationItemMenu
              pinned={conversation.pinned}
              onClose={() => setMenuOpen(false)}
              onRename={onRename ? () => setRenaming(true) : undefined}
              onDelete={onDelete ? () => setConfirming(true) : undefined}
              onTogglePin={onTogglePin ? () => onTogglePin(conversation.id) : undefined}
            />
          )}
        </span>
      )}
    </div>
  )
}

export type ConversationItemMenuProps = {
  pinned?: boolean
  onClose: () => void
  onRename?: () => void
  onDelete?: () => void
  onTogglePin?: () => void
}

export function ConversationItemMenu({
  pinned,
  onClose,
  onRename,
  onDelete,
  onTogglePin,
}: ConversationItemMenuProps) {
  const locale = useLocale()

  const items = [
    onTogglePin && {
      key: 'pin',
      label: pinned ? locale.unpin : locale.pin,
      icon: <PinIcon size={13} />,
      run: onTogglePin,
      danger: false,
    },
    onRename && {
      key: 'rename',
      label: locale.rename,
      icon: <EditIcon size={13} />,
      run: onRename,
      danger: false,
    },
    onDelete && {
      key: 'delete',
      label: locale.delete,
      icon: <TrashIcon size={13} />,
      run: onDelete,
      danger: true,
    },
  ].filter(Boolean) as Array<{
    key: string
    label: string
    icon: ReactElement
    run: () => void
    danger: boolean
  }>

  return (
    <>
      <div
        className="fixed inset-0 z-20"
        aria-hidden="true"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      />
      <div
        role="menu"
        className={cn(
          'absolute right-0 top-full z-30 mt-1 min-w-32 rounded-cc-md border border-cc-border',
          'bg-cc-surface p-1 shadow-cc-overlay animate-cc-rise',
        )}
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation()
              onClose()
              item.run()
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-cc-xs px-2 py-1.5 text-left text-cc-sm',
              'transition-colors duration-150 ease-cc outline-none',
              item.danger
                ? 'text-cc-danger hover:bg-cc-danger-subtle'
                : 'text-cc-fg hover:bg-cc-subtle',
              'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
            )}
          >
            <span className="text-cc-faint">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

function RowButton({
  label,
  children,
  onClick,
  tone = 'default',
  expanded,
}: {
  label: string
  children: ReactElement
  onClick: (event: ReactMouseEvent) => void
  tone?: 'default' | 'danger'
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-cc-xs',
        'transition-colors duration-150 ease-cc outline-none',
        tone === 'danger'
          ? 'text-cc-danger hover:bg-cc-danger-subtle'
          : 'text-cc-muted hover:bg-cc-sunken hover:text-cc-fg',
        'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
      )}
    >
      {children}
    </button>
  )
}

/** Inline rename, committed on Enter or blur and abandoned on Escape. */
function RenameField({
  initialValue,
  onSubmit,
  onCancel,
}: {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLInputElement | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Renaming is a text field like any other; an IME candidate confirmation must not
      // commit the name.
      if (event.nativeEvent.isComposing) return
      event.preventDefault()
      onSubmit(value.trim())
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelled.current = true
      onCancel()
    }
  }

  return (
    <div className="flex h-[var(--cc-row-height,2.25rem)] items-center px-1">
      <input
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (cancelled.current) return
          onSubmit(value.trim())
        }}
        className={cn(
          'w-full rounded-cc-xs border border-cc-accent/50 bg-cc-surface px-1.5 py-1',
          'text-cc-sm text-cc-fg outline-none',
        )}
      />
    </div>
  )
}

/** Wraps query matches in a subtle mark. Case-insensitive, all occurrences. */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const needle = query?.trim()
  if (!needle) return <>{text}</>

  const parts: Array<{ text: string; match: boolean }> = []
  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  let index = 0

  while (index < text.length) {
    const found = lowerText.indexOf(lowerNeedle, index)
    if (found === -1) {
      parts.push({ text: text.slice(index), match: false })
      break
    }
    if (found > index) parts.push({ text: text.slice(index, found), match: false })
    parts.push({ text: text.slice(found, found + needle.length), match: true })
    index = found + needle.length
  }

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-[2px] bg-cc-warning-subtle text-cc-fg">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}
