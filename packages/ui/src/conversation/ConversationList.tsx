'use client'

import {
  useAgentConversations,
  useConversationList,
  type Agent,
  type AgentSection,
  type Conversation,
  type ConversationGroupKey,
} from '@xinjiyuan97/core'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import { cn } from '../lib/cn'
import { Skeleton } from '../primitives/Skeleton'
import { useLocale } from '../provider/ChatThemeProvider'
import { AGENT_HEADER_HEIGHT, AgentSectionHeader } from './AgentGroup'
import { ConversationItem, SUBTITLE_ROW_HEIGHT } from './ConversationItem'

export type ConversationListProps = {
  conversations: Conversation[]
  activeId?: string
  /** Search term: filters the list and highlights matches. */
  query?: string
  loading?: boolean
  collapsed?: boolean
  /** Agents to group under. Passing any of them flips `groupBy` to `'agent'` by default. */
  agents?: Agent[]
  groupBy?: 'date' | 'agent' | 'none'
  /** Controlled agent collapse; omit to let the list manage its own. */
  collapsedAgentIds?: string[]
  defaultCollapsedAgentIds?: string[]
  onAgentToggle?: (agentId: string, collapsed: boolean) => void
  /** Shows a `+` on each agent header. Never offered for the unassigned bucket. */
  onNewChatInAgent?: (agentId: string) => void
  onSelect?: (id: string) => void
  onRename?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onTogglePin?: (id: string) => void
  /** Switch to windowed rendering above this many rows. */
  virtualizeAfter?: number
  /** Injected for deterministic stories and tests. */
  now?: number
  className?: string
}

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 30
/** Rows rendered beyond the viewport, so a fast flick doesn't reveal blank space. */
const OVERSCAN = 8

const NO_AGENTS: Agent[] = []

type Row =
  | { kind: 'header'; key: ConversationGroupKey; height: number }
  | { kind: 'agent-header'; section: AgentSection; expanded: boolean; height: number }
  | {
      kind: 'item'
      conversation: Conversation
      index: number
      height: number
      subtitle?: string
      level?: number
    }

/**
 * The scrollable conversation list.
 *
 * Two things here are worth more than they look. Grouping by date is what makes a sidebar
 * with 500 entries navigable at all — without it every row is equally plausible and the
 * user scans linearly. And the list virtualises itself past a threshold: a chat app
 * accumulates conversations forever, and 2000 DOM rows makes every keystroke in the search
 * box janky.
 *
 * Agent grouping rides on the same row array: a collapsed agent simply stops contributing
 * item rows, the prefix-sum offsets recompute, and windowing keeps working without a
 * special case.
 */
export function ConversationList(props: ConversationListProps) {
  const {
    conversations,
    activeId,
    query,
    loading = false,
    collapsed = false,
    agents = NO_AGENTS,
    groupBy,
    collapsedAgentIds,
    defaultCollapsedAgentIds,
    onAgentToggle,
    onNewChatInAgent,
    onSelect,
    onRename,
    onDelete,
    onTogglePin,
    virtualizeAfter = 100,
    now,
    className,
  } = props

  const locale = useLocale()

  // Passing `agents` but still having to write `groupBy="agent"` is a trap nobody escapes
  // on the first try, so the presence of agents is what picks the mode.
  const mode = groupBy ?? (agents.length > 0 ? 'agent' : 'date')
  const agentMode = mode === 'agent' && !collapsed && agents.length > 0

  const dateList = useConversationList({
    conversations,
    query,
    groupBy: collapsed || mode !== 'date' ? 'none' : 'date',
    now,
  })
  const agentList = useAgentConversations({ agents, conversations, query })
  const { isEmpty, isFilteredEmpty } = agentMode ? agentList : dateList

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [ownCollapsedAgents, setOwnCollapsedAgents] = useState<string[]>(
    () => defaultCollapsedAgentIds ?? [],
  )

  const collapsedAgents = useMemo(
    () => new Set(collapsedAgentIds ?? ownCollapsedAgents),
    [collapsedAgentIds, ownCollapsedAgents],
  )

  const toggleAgent = useCallback(
    (agentId: string) => {
      const next = !collapsedAgents.has(agentId)
      if (collapsedAgentIds === undefined) {
        setOwnCollapsedAgents((previous) =>
          next ? [...previous, agentId] : previous.filter((id) => id !== agentId),
        )
      }
      onAgentToggle?.(agentId, next)
    },
    [collapsedAgentIds, collapsedAgents, onAgentToggle],
  )

  const { groups } = dateList
  const rows = useMemo<Row[]>(() => {
    const built: Row[] = []
    let index = 0

    if (agentMode) {
      // Searching flattens the tree: a hit three agents down is still a hit, and hiding it
      // behind a collapsed section would make the search look broken. Each row says which
      // agent it came from instead.
      if (agentList.searching) {
        for (const conversation of agentList.matches) {
          const owner = agentList.agentOf(conversation.id)
          built.push({
            kind: 'item',
            conversation,
            index,
            height: SUBTITLE_ROW_HEIGHT,
            subtitle: locale.inAgent(owner?.name ?? locale.unassignedAgent),
          })
          index += 1
        }
        return built
      }

      for (const section of agentList.sections) {
        const expanded = !collapsedAgents.has(section.id)
        built.push({ kind: 'agent-header', section, expanded, height: AGENT_HEADER_HEIGHT })
        if (!expanded) continue
        for (const conversation of section.conversations) {
          built.push({ kind: 'item', conversation, index, height: ROW_HEIGHT, level: 2 })
          index += 1
        }
      }
      return built
    }

    for (const group of groups) {
      // A single unnamed group means grouping is off; a header would be noise.
      if (!collapsed && mode === 'date') {
        built.push({ kind: 'header', key: group.key, height: HEADER_HEIGHT })
      }
      for (const conversation of group.conversations) {
        built.push({ kind: 'item', conversation, index, height: ROW_HEIGHT })
        index += 1
      }
    }
    return built
  }, [agentList, agentMode, collapsed, collapsedAgents, groups, locale, mode])

  /* Keyboard navigation walks the rows we actually rendered, not the unfiltered list —
   * otherwise the cursor steps into a collapsed agent's children and vanishes. */
  const items = useMemo(
    () => rows.flatMap((row) => (row.kind === 'item' ? [row.conversation] : [])),
    [rows],
  )

  const offsets = useMemo(() => {
    const result: number[] = [0]
    for (const row of rows) result.push((result[result.length - 1] as number) + row.height)
    return result
  }, [rows])

  const totalHeight = offsets[offsets.length - 1] ?? 0
  const virtualise = items.length > virtualizeAfter
  const range = useVisibleRange(scrollRef, offsets, virtualise)

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = Math.min(Math.max(focusedIndex + delta, 0), items.length - 1)
        setFocusedIndex(next)
        scrollRowIntoView(scrollRef.current, rows, offsets, next)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setFocusedIndex(0)
        scrollRowIntoView(scrollRef.current, rows, offsets, 0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setFocusedIndex(items.length - 1)
        scrollRowIntoView(scrollRef.current, rows, offsets, items.length - 1)
        return
      }
      if (event.key === 'Enter' && focusedIndex >= 0) {
        event.preventDefault()
        const conversation = items[focusedIndex]
        if (conversation) onSelect?.(conversation.id)
      }
    },
    [focusedIndex, items, offsets, onSelect, rows],
  )

  if (loading) return <ConversationListSkeleton collapsed={collapsed} className={className} />

  /* With agents around, "no conversations yet" is worse than a column of empty sections:
   * the headers are what tell you which assistants exist and where to start the first
   * chat. Only a search that matched nothing is genuinely empty. */
  const nothingToShow = agentMode ? rows.length === 0 : isEmpty || isFilteredEmpty
  if (nothingToShow) {
    return (
      <p className={cn('px-3 py-6 text-center text-cc-sm text-cc-faint', className)}>
        {isFilteredEmpty ? locale.noResults : locale.noConversations}
      </p>
    )
  }

  const visible = virtualise ? rows.slice(range.start, range.end) : rows
  const paddingTop = virtualise ? (offsets[range.start] ?? 0) : 0

  return (
    <div
      ref={scrollRef}
      // A collapsible section with an `aria-expanded` toggle is not a listbox option, so
      // agent mode moves to a tree. Date mode keeps the flat listbox it has always been.
      role={agentMode ? 'tree' : 'listbox'}
      tabIndex={0}
      aria-label={locale.conversations}
      onKeyDown={onKeyDown}
      onBlur={() => setFocusedIndex(-1)}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 outline-none',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cc-accent/30',
        className,
      )}
    >
      {/* `role="presentation"` on the virtualisation wrappers so the rows stay direct
          children of the tree/listbox as far as assistive tech is concerned. */}
      <div
        role="presentation"
        style={virtualise ? { height: totalHeight, position: 'relative' } : undefined}
      >
        <div
          role="presentation"
          style={virtualise ? { transform: `translateY(${paddingTop}px)` } : undefined}
        >
          {visible.map((row) => {
            if (row.kind === 'header') {
              return (
                <ConversationGroupHeader key={`group-${row.key}`} label={locale.groups[row.key]} />
              )
            }
            if (row.kind === 'agent-header') {
              const { section } = row
              const { agent } = section
              return (
                <AgentSectionHeader
                  key={`agent-${section.id}`}
                  agent={agent}
                  count={section.conversations.length}
                  expanded={row.expanded}
                  active={section.conversations.some((c) => c.id === activeId)}
                  role="treeitem"
                  level={1}
                  onToggle={() => toggleAgent(section.id)}
                  // The unassigned bucket is not a place you can start a chat in.
                  onNewChat={
                    onNewChatInAgent && agent ? () => onNewChatInAgent(agent.id) : undefined
                  }
                />
              )
            }
            return (
              <ConversationItem
                key={row.conversation.id}
                conversation={row.conversation}
                active={row.conversation.id === activeId}
                focused={row.index === focusedIndex}
                query={query}
                collapsed={collapsed}
                subtitle={row.subtitle}
                role={agentMode ? 'treeitem' : 'option'}
                level={row.level}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export type ConversationGroupProps = Omit<
  ConversationListProps,
  | 'conversations'
  | 'loading'
  | 'virtualizeAfter'
  | 'groupBy'
  | 'now'
  | 'agents'
  | 'collapsedAgentIds'
  | 'defaultCollapsedAgentIds'
  | 'onAgentToggle'
  | 'onNewChatInAgent'
> & {
  label: string
  conversations: Conversation[]
}

/**
 * One labelled section of rows.
 *
 * `ConversationList` doesn't use this — it flattens groups into a single row array so
 * virtualisation can span section boundaries. It's here for consumers assembling a
 * sidebar by hand.
 */
export function ConversationGroup({
  label,
  conversations,
  activeId,
  query,
  collapsed,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
  className,
}: ConversationGroupProps) {
  if (conversations.length === 0) return null

  return (
    <div className={className}>
      {!collapsed && <ConversationGroupHeader label={label} />}
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === activeId}
          query={query}
          collapsed={collapsed}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  )
}

export function ConversationGroupHeader({ label }: { label: string }) {
  return (
    <div
      role="presentation"
      className="flex h-[30px] items-end px-2.5 pb-1 text-cc-xs font-medium text-cc-faint"
    >
      {label}
    </div>
  )
}

export function ConversationListSkeleton({
  collapsed,
  rows = 7,
  className,
}: {
  collapsed?: boolean
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5 px-2 py-2', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-6 rounded-cc-sm', collapsed ? 'mx-auto w-8' : widthFor(index))}
        />
      ))}
    </div>
  )
}

/** Varies placeholder widths so the skeleton reads as titles, not as a table. */
function widthFor(index: number): string {
  const widths = ['w-full', 'w-4/5', 'w-11/12', 'w-3/5', 'w-5/6']
  return widths[index % widths.length] as string
}

/**
 * Tracks which rows intersect the viewport.
 *
 * Rows have two different heights (group headers are shorter), so the offsets are
 * precomputed as a prefix sum and searched by bisection — no assumption of a uniform row
 * height, and no per-row measurement either.
 */
function useVisibleRange(
  scrollRef: RefObject<HTMLDivElement | null>,
  offsets: number[],
  enabled: boolean,
) {
  const [range, setRange] = useState({ start: 0, end: 40 })

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !enabled) return

    const update = () => {
      const top = element.scrollTop
      const bottom = top + element.clientHeight
      const start = Math.max(0, bisect(offsets, top) - OVERSCAN)
      const end = Math.min(offsets.length - 1, bisect(offsets, bottom) + OVERSCAN)
      setRange((previous) =>
        previous.start === start && previous.end === end ? previous : { start, end },
      )
    }

    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined
    observer?.observe(element)

    return () => {
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [enabled, offsets, scrollRef])

  return range
}

/** Index of the last offset less than or equal to `value`. */
function bisect(offsets: number[], value: number): number {
  let low = 0
  let high = offsets.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if ((offsets[mid] as number) <= value) low = mid
    else high = mid - 1
  }
  return low
}

function scrollRowIntoView(
  element: HTMLDivElement | null,
  rows: Row[],
  offsets: number[],
  itemIndex: number,
) {
  if (!element) return
  const rowIndex = rows.findIndex((row) => row.kind === 'item' && row.index === itemIndex)
  if (rowIndex === -1) return

  const top = offsets[rowIndex] ?? 0
  const bottom = top + (rows[rowIndex]?.height ?? ROW_HEIGHT)
  if (top < element.scrollTop) element.scrollTop = top
  else if (bottom > element.scrollTop + element.clientHeight) {
    element.scrollTop = bottom - element.clientHeight
  }
}
