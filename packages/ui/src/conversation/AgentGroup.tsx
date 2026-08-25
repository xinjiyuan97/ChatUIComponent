'use client'

import type { Agent } from '@xinjiyuan97/chat-core'
import type { MouseEvent as ReactMouseEvent } from 'react'

import { cn } from '../lib/cn'
import { AgentIcon, ChevronDownIcon, PlusIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

/** Row height of a section header, in px. Shared with the list's virtualisation maths. */
export const AGENT_HEADER_HEIGHT = 34

export type AgentBadgeProps = {
  /** `null` renders the unassigned bucket's glyph. */
  agent: Agent | null
  /** Only the agent owning the current conversation should get this. */
  active?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * The square glyph in front of an agent's name.
 *
 * Neutral by default and accented only for the active agent. A column of differently
 * coloured badges would read as a palette rather than a hierarchy, and it would spend the
 * one accent the sidebar is allowed to use on something that isn't the current position.
 */
export function AgentBadge({ agent, active = false, size = 'sm', className }: AgentBadgeProps) {
  const initial = agent?.avatar?.trim() || agent?.name.trim().slice(0, 1).toUpperCase()

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-cc-xs font-medium',
        'transition-colors duration-150 ease-cc',
        size === 'sm' ? 'size-5 text-[0.6875rem]' : 'size-8 text-cc-xs',
        active ? 'bg-cc-accent-subtle text-cc-accent' : 'bg-cc-subtle text-cc-muted',
        className,
      )}
    >
      {initial ?? <AgentIcon size={size === 'sm' ? 12 : 15} />}
    </span>
  )
}

export type AgentSectionHeaderProps = {
  /** `null` for the trailing unassigned section. */
  agent: Agent | null
  count: number
  expanded: boolean
  /** True when this section holds the active conversation. */
  active?: boolean
  onToggle: () => void
  /** Omit to hide the `+` affordance — e.g. for the unassigned bucket. */
  onNewChat?: () => void
  /** `treeitem` inside `ConversationList`; overridable for hand-assembled sidebars. */
  role?: string
  level?: number
  className?: string
}

/**
 * One collapsible agent header.
 *
 * The toggle is a real `<button>` so Space and Enter work without us reimplementing them,
 * and the `+` sits beside it rather than inside it — nesting a button in a button is
 * invalid, and browsers resolve it by dropping one of the two click targets.
 */
export function AgentSectionHeader(props: AgentSectionHeaderProps) {
  const {
    agent,
    count,
    expanded,
    active = false,
    onToggle,
    onNewChat,
    role,
    level,
    className,
  } = props

  const locale = useLocale()
  const name = agent?.name ?? locale.unassignedAgent
  const toggleLabel = expanded ? locale.collapseAgent(name) : locale.expandAgent(name)

  return (
    <div
      role="presentation"
      className={cn('group/agent relative flex items-center', className)}
      style={{ height: AGENT_HEADER_HEIGHT }}
    >
      <button
        type="button"
        role={role}
        aria-expanded={expanded}
        aria-level={level}
        aria-label={`${name}，${locale.agentConversations(count)}`}
        title={agent?.description ?? toggleLabel}
        onClick={onToggle}
        className={cn(
          'flex h-[26px] w-full items-center gap-2 rounded-cc-sm pl-1 pr-1.5',
          'text-left transition-colors duration-150 ease-cc hover:bg-cc-subtle',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          onNewChat && 'group-hover/agent:pr-7',
        )}
      >
        <ChevronDownIcon
          size={12}
          className={cn(
            'shrink-0 text-cc-faint transition-transform duration-150 ease-cc',
            !expanded && '-rotate-90',
          )}
        />
        <AgentBadge agent={agent} active={active} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-cc-xs font-medium',
            active ? 'text-cc-fg' : 'text-cc-muted',
          )}
        >
          {name}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0 text-cc-xs tabular-nums text-cc-faint',
            onNewChat && 'group-hover/agent:opacity-0',
          )}
        >
          {count}
        </span>
      </button>

      {onNewChat && (
        <button
          type="button"
          aria-label={locale.newChatIn(name)}
          title={locale.newChatIn(name)}
          onClick={(event: ReactMouseEvent) => {
            event.stopPropagation()
            onNewChat()
          }}
          className={cn(
            'absolute right-1 inline-flex size-5 items-center justify-center rounded-cc-xs',
            'text-cc-faint opacity-0 transition-[opacity,color] duration-150 ease-cc',
            'hover:bg-cc-sunken hover:text-cc-fg',
            'group-hover/agent:opacity-100 focus-visible:opacity-100',
            'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          )}
        >
          <PlusIcon size={12} />
        </button>
      )}
    </div>
  )
}
