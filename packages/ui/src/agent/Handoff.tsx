'use client'

import type { HandoffPart as HandoffPartData } from '@xinjiyuan97/chat-core'
import { useMemo, useState } from 'react'

import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'
import { AgentBadge } from './AgentIdentity'

export type HandoffContextProps = {
  part: HandoffPartData
  onAcknowledge?: (part: HandoffPartData) => void
  className?: string
}

export function HandoffContext({ part, onAcknowledge, className }: HandoffContextProps) {
  const locale = useLocale()
  const missing = part.missing ?? []
  const [checked, setChecked] = useState<string[]>(
    part.acknowledged ? missing.map((item) => item.id) : [],
  )
  const allChecked = missing.length === 0 || missing.every((item) => checked.includes(item.id))
  return (
    <div
      className={cn('rounded-cc-sm border border-cc-border bg-cc-surface p-3', className)}
      data-cc-handoff-context
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ContextColumn title={locale.handoffCarried} items={part.carried ?? []} />
        <div>
          <h4 className="mb-1.5 text-cc-xs font-semibold text-cc-fg">{locale.handoffMissing}</h4>
          <ul className="space-y-1.5">
            {missing.map((item) => (
              <li key={item.id} className="flex gap-2 text-cc-xs text-cc-muted">
                {onAcknowledge ? (
                  <input
                    type="checkbox"
                    checked={checked.includes(item.id)}
                    onChange={() =>
                      setChecked((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    aria-label={item.label}
                  />
                ) : (
                  <span className="mt-1 size-1.5 shrink-0 rounded-cc-full bg-cc-warning" />
                )}
                <span>
                  <span className="font-medium text-cc-fg">{item.label}</span>
                  {item.detail && <span className="block text-cc-faint">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {onAcknowledge && missing.length > 0 && (
        <button
          type="button"
          disabled={!allChecked}
          onClick={() => onAcknowledge(part)}
          className="mt-3 rounded-cc-sm bg-cc-accent px-2.5 py-1.5 text-cc-xs font-medium text-cc-accent-fg disabled:pointer-events-none disabled:opacity-45"
        >
          {locale.handoffAcknowledge}
        </button>
      )}
    </div>
  )
}

function ContextColumn({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; detail?: string }>
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-cc-xs font-semibold text-cc-fg">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="text-cc-xs text-cc-muted">
            <span className="font-medium text-cc-fg">{item.label}</span>
            {item.detail && <span className="block text-cc-faint">{item.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export type HandoffTrailProps = {
  parts: HandoffPartData[]
  currentAgentId?: string
  className?: string
}

export function HandoffTrail({ parts, currentAgentId, className }: HandoffTrailProps) {
  const locale = useLocale()
  const nodes = useMemo(() => {
    const result: Array<{ id: string; name?: string }> = []
    for (const part of parts) {
      if (!result.some((node) => node.id === part.from.agentId))
        result.push({ id: part.from.agentId, name: part.from.name })
      if (!result.some((node) => node.id === part.to.agentId))
        result.push({ id: part.to.agentId, name: part.to.name })
    }
    return result
  }, [parts])
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-cc-sm border border-cc-border p-3',
        className,
      )}
      data-cc-handoff-trail
    >
      {nodes.map((node, index) => (
        <span key={node.id} className="contents">
          {index > 0 && (
            <span className="text-cc-xs text-cc-faint">
              → {parts[index - 1]?.reason ?? locale.handoffReasonFallback}
            </span>
          )}
          <span
            className={cn(
              'rounded-cc-sm px-2 py-1 text-cc-xs',
              currentAgentId === node.id
                ? 'bg-cc-accent/15 ring-1 ring-cc-accent text-cc-fg'
                : 'bg-cc-subtle text-cc-muted',
            )}
            data-cc-agent-node={node.id}
            data-testid={`cc-agent-node-${node.id}`}
          >
            <AgentBadge name={node.name ?? node.id} />
          </span>
        </span>
      ))}
    </div>
  )
}

export type HandoffPartProps = HandoffContextProps

export function HandoffPart({ part, onAcknowledge, className }: HandoffPartProps) {
  return (
    <div className={cn('my-2 space-y-2', className)} data-cc-handoff={part.handoffId}>
      <div className="flex items-center gap-2 text-cc-xs text-cc-muted">
        <AgentBadge name={part.from.name ?? part.from.agentId} />
        <span>→</span>
        <AgentBadge name={part.to.name ?? part.to.agentId} />
        {part.rule && <span className="font-cc-mono text-cc-faint">{part.rule}</span>}
      </div>
      {part.reason && <p className="text-cc-xs text-cc-faint">{part.reason}</p>}
      <HandoffContext part={part} onAcknowledge={onAcknowledge} />
    </div>
  )
}
