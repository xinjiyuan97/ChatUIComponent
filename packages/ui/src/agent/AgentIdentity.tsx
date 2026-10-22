'use client'

import type { Agent } from '@xinjiyuan97/chat-core'
import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { MessageAvatar } from '../message/Message'
import { useLocale } from '../provider/ChatThemeProvider'

export type AgentStatus =
  'idle' | 'thinking' | 'speaking' | 'waiting' | 'blocked' | 'done' | 'error'

export type AgentBadgeProps = {
  agent?: Pick<Agent, 'id' | 'name' | 'avatar'> & { model?: string }
  name?: string
  model?: string
  className?: string
}

export function AgentBadge({ agent, name, model, className }: AgentBadgeProps) {
  const label = name ?? agent?.name
  if (!label) return null
  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-1.5', className)}
      data-cc-agent-badge
      data-testid="cc-agent-badge"
    >
      <span className="truncate text-cc-sm font-semibold text-cc-fg">{label}</span>
      {(model ?? agent?.model) && (
        <span className="truncate text-cc-xs text-cc-faint">{model ?? agent?.model}</span>
      )}
    </span>
  )
}

export type AgentAvatarProps = {
  agent?: Pick<Agent, 'name' | 'avatar'>
  name?: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  overlay?: ReactNode
  className?: string
}

export function AgentAvatar({
  agent,
  name,
  src,
  size = 'md',
  overlay,
  className,
}: AgentAvatarProps) {
  return (
    <span className="relative inline-flex shrink-0" data-cc-agent-avatar>
      <MessageAvatar
        name={name ?? agent?.name}
        src={src ?? agent?.avatar}
        className={cn(size === 'sm' && 'size-5', size === 'lg' && 'size-9', className)}
      />
      {overlay}
    </span>
  )
}

export type AgentStatusDotProps = {
  status: AgentStatus
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function AgentStatusDot({ status, size = 'md', label, className }: AgentStatusDotProps) {
  const locale = useLocale()
  const labels: Record<AgentStatus, string> = {
    idle: locale.agentStatusIdle,
    thinking: locale.agentStatusThinking,
    speaking: locale.agentStatusSpeaking,
    waiting: locale.agentStatusWaiting,
    blocked: locale.agentBlocked,
    done: locale.agentDone,
    error: locale.agentFailed,
  }
  return (
    <span
      role="img"
      className={cn(
        'inline-block shrink-0 rounded-cc-full border-2 border-cc-surface',
        size === 'sm' ? 'size-1.5' : size === 'lg' ? 'size-2.5' : 'size-2',
        status === 'blocked' || status === 'error'
          ? 'bg-cc-danger'
          : status === 'done'
            ? 'bg-cc-success'
            : status === 'waiting'
              ? 'bg-cc-warning'
              : 'bg-cc-accent',
        (status === 'thinking' || status === 'speaking') &&
          'animate-cc-pulse motion-reduce:animate-none',
        className,
      )}
      data-cc-agent-status={status}
      aria-label={label ?? labels[status]}
    />
  )
}

export type AgentPresenceProps = Omit<AgentAvatarProps, 'overlay'> & { status?: AgentStatus }

export function AgentPresence({ status, ...props }: AgentPresenceProps) {
  return (
    <AgentAvatar
      {...props}
      overlay={
        status ? (
          <AgentStatusDot status={status} className="absolute -bottom-0.5 -right-0.5" />
        ) : undefined
      }
    />
  )
}
