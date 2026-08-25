'use client'

import type { Agent, Conversation } from '@xinjiyuan97/core'
import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { CloseIcon, PlusIcon, SearchIcon, SidebarIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { AgentBadge } from './AgentGroup'
import { ConversationList } from './ConversationList'

export type ConversationSidebarProps = {
  conversations: Conversation[]
  activeId?: string
  loading?: boolean
  /** Groups the list into collapsible per-agent sections. */
  agents?: Agent[]
  /** Controlled agent collapse; omit to let the list manage its own. */
  collapsedAgentIds?: string[]
  defaultCollapsedAgentIds?: string[]
  onAgentToggle?: (agentId: string, collapsed: boolean) => void
  /** Adds a `+` to each agent header. The host decides what a new chat there means. */
  onNewChatInAgent?: (agentId: string) => void
  /** Controlled collapse; omit to let the sidebar manage its own. */
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Controlled search term; omit to let the sidebar manage its own. */
  query?: string
  onQueryChange?: (query: string) => void
  /** Hides the search field entirely — sensible for short, fixed lists. */
  searchable?: boolean
  onNewChat?: () => void
  onSelect?: (id: string) => void
  onRename?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onTogglePin?: (id: string) => void
  /** Pinned to the bottom — account row, settings, storage meter. */
  footer?: ReactNode
  /** Injected for deterministic stories and tests. */
  now?: number
  className?: string
}

/**
 * The whole left rail: new-chat button, search, grouped list, footer slot.
 *
 * Collapsing keeps the rail on screen at 56px rather than removing it. A sidebar that
 * disappears entirely costs the user their place — the icons keep the spatial memory of
 * where each conversation sat.
 */
export function ConversationSidebar(props: ConversationSidebarProps) {
  const {
    conversations,
    activeId,
    loading,
    agents,
    collapsedAgentIds,
    defaultCollapsedAgentIds,
    onAgentToggle,
    onNewChatInAgent,
    collapsed: controlledCollapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    query: controlledQuery,
    onQueryChange,
    searchable = true,
    onNewChat,
    onSelect,
    onRename,
    onDelete,
    onTogglePin,
    footer,
    now,
    className,
  } = props

  const locale = useLocale()
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed)
  const [uncontrolledQuery, setUncontrolledQuery] = useState('')

  const collapsed = controlledCollapsed ?? uncontrolledCollapsed
  const query = controlledQuery ?? uncontrolledQuery

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed
    if (controlledCollapsed === undefined) setUncontrolledCollapsed(next)
    onCollapsedChange?.(next)
  }, [collapsed, controlledCollapsed, onCollapsedChange])

  const setQuery = useCallback(
    (next: string) => {
      if (controlledQuery === undefined) setUncontrolledQuery(next)
      onQueryChange?.(next)
    },
    [controlledQuery, onQueryChange],
  )

  return (
    <aside
      data-cc-collapsed={collapsed || undefined}
      aria-label={locale.conversations}
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col border-r border-cc-border bg-cc-sunken/40',
        // Width is the only thing that animates; the contents swap instantly so text never
        // squeezes through intermediate widths.
        'transition-[width] duration-200 ease-cc',
        collapsed ? 'w-cc-sidebar-collapsed' : 'w-cc-sidebar',
        className,
      )}
    >
      <div className={cn('flex shrink-0 items-center gap-1 p-2', collapsed && 'flex-col gap-1.5')}>
        <SidebarToggle collapsed={collapsed} onClick={toggleCollapsed} />
        {onNewChat && <NewChatButton collapsed={collapsed} onClick={onNewChat} />}
      </div>

      {searchable && !collapsed && (
        <div className="shrink-0 px-2 pb-2">
          <ConversationSearch value={query} onChange={setQuery} />
        </div>
      )}

      {/* While loading there is nothing to summarise, so the list's skeleton wins. */}
      {collapsed && !loading && agents && agents.length > 0 ? (
        <AgentRail
          agents={agents}
          activeAgentId={conversations.find((c) => c.id === activeId)?.agentId}
          onSelect={toggleCollapsed}
        />
      ) : (
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          query={collapsed ? undefined : query}
          loading={loading}
          collapsed={collapsed}
          agents={agents}
          collapsedAgentIds={collapsedAgentIds}
          defaultCollapsedAgentIds={defaultCollapsedAgentIds}
          onAgentToggle={onAgentToggle}
          onNewChatInAgent={onNewChatInAgent}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          now={now}
        />
      )}

      {footer && (
        <div className={cn('shrink-0 border-t border-cc-border p-2', collapsed && 'px-1')}>
          {footer}
        </div>
      )}
    </aside>
  )
}

/**
 * The 56px rail, agent edition.
 *
 * Once conversations live under agents, a column of conversation initials is the wrong
 * summary — the thing worth keeping visible while collapsed is which assistants exist and
 * which one you are currently talking to. Clicking a badge expands the sidebar; picking a
 * conversation is a job for the full-width list.
 */
function AgentRail({
  agents,
  activeAgentId,
  onSelect,
}: {
  agents: Agent[]
  activeAgentId?: string
  onSelect: () => void
}) {
  const locale = useLocale()

  return (
    <div
      aria-label={locale.agents}
      className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain px-1 py-1"
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={onSelect}
          title={agent.name}
          aria-label={`${agent.name} — ${locale.expandSidebar}`}
          className={cn(
            'shrink-0 rounded-cc-sm p-0.5 transition-colors duration-150 ease-cc',
            'outline-none hover:bg-cc-subtle focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          )}
        >
          <AgentBadge agent={agent} active={agent.id === activeAgentId} size="md" />
        </button>
      ))}
    </div>
  )
}

export function NewChatButton({
  onClick,
  collapsed = false,
  className,
}: {
  onClick: () => void
  collapsed?: boolean
  className?: string
}) {
  const locale = useLocale()

  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? locale.newChat : undefined}
      aria-label={locale.newChat}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-cc-sm border border-cc-border',
        'bg-cc-surface text-cc-sm font-medium text-cc-fg shadow-cc-card',
        'transition-colors duration-150 ease-cc hover:border-cc-border-strong hover:bg-cc-subtle',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        collapsed ? 'size-8' : 'h-8 flex-1 px-2.5',
        className,
      )}
    >
      <PlusIcon size={14} className="text-cc-muted" />
      {!collapsed && <span className="truncate">{locale.newChat}</span>}
    </button>
  )
}

export function SidebarToggle({
  collapsed,
  onClick,
  className,
}: {
  collapsed: boolean
  onClick: () => void
  className?: string
}) {
  const locale = useLocale()
  const label = collapsed ? locale.expandSidebar : locale.collapseSidebar

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-expanded={!collapsed}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-cc-sm text-cc-muted',
        'transition-colors duration-150 ease-cc hover:bg-cc-subtle hover:text-cc-fg',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      <SidebarIcon size={16} />
    </button>
  )
}

export type ConversationSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * The search field.
 *
 * Escape clears rather than blurring: with the list filtered down, getting back to the
 * full list is what the user actually wants, and it takes one key instead of selecting
 * the text first.
 */
export function ConversationSearch({
  value,
  onChange,
  placeholder,
  className,
}: ConversationSearchProps) {
  const locale = useLocale()
  const ref = useRef<HTMLInputElement | null>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || value === '') return
    event.preventDefault()
    event.stopPropagation()
    onChange('')
  }

  return (
    <div
      className={cn(
        'relative flex h-8 items-center rounded-cc-sm border border-cc-border bg-cc-surface',
        'transition-colors duration-150 ease-cc focus-within:border-cc-border-strong',
        className,
      )}
    >
      <SearchIcon size={13} className="pointer-events-none absolute left-2.5 text-cc-faint" />
      <input
        ref={ref}
        type="search"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? locale.searchPlaceholder}
        aria-label={placeholder ?? locale.searchPlaceholder}
        className={cn(
          'w-full bg-transparent pl-8 pr-7 text-cc-sm text-cc-fg outline-none',
          'placeholder:text-cc-faint',
          // Safari draws its own clear button on type="search"; ours is styleable.
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      {value && (
        <button
          type="button"
          aria-label={locale.cancel}
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
          className={cn(
            'absolute right-1.5 inline-flex size-5 items-center justify-center rounded-cc-xs',
            'text-cc-faint transition-colors duration-150 ease-cc hover:text-cc-fg',
            'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          )}
        >
          <CloseIcon size={11} />
        </button>
      )}
    </div>
  )
}
