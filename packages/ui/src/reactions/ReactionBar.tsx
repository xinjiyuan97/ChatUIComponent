'use client'

import type { Reaction } from '@agent-chat/core'
import { useState } from 'react'

import { cn } from '../lib/cn'
import { PlusIcon } from '../icons'

export type ReactionBarProps = {
  reactions: Reaction[]
  onToggle: (key: string) => void
  /** Emoji offered by the picker. */
  palette?: string[]
  /** Hides the add button, e.g. on a read-only transcript. */
  readOnly?: boolean
  className?: string
}

const DEFAULT_PALETTE = ['👍', '❤️', '🎉', '🤔', '😄', '👀']

/**
 * Emoji reactions with counts.
 *
 * Only reactions that someone has actually used are shown as pills; the rest live behind
 * the `+` so a message with no reactions costs one small button of visual weight instead
 * of a row of grey emoji.
 */
export function ReactionBar({
  reactions,
  onToggle,
  palette = DEFAULT_PALETTE,
  readOnly = false,
  className,
}: ReactionBarProps) {
  const [picking, setPicking] = useState(false)
  const visible = reactions.filter((reaction) => (reaction.count ?? 0) > 0 || reaction.active)

  if (readOnly && visible.length === 0) return null

  return (
    <div className={cn('relative flex flex-wrap items-center gap-1', className)}>
      {visible.map((reaction) => (
        <button
          key={reaction.key}
          type="button"
          onClick={() => onToggle(reaction.key)}
          aria-pressed={reaction.active}
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-cc-full border px-2',
            'text-cc-xs transition-colors duration-150 ease-cc',
            'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
            reaction.active
              ? 'border-cc-accent/40 bg-cc-accent-subtle text-cc-accent'
              : 'border-cc-border bg-cc-surface text-cc-muted hover:bg-cc-subtle',
          )}
        >
          <span className="text-[13px] leading-none">{reaction.key}</span>
          {(reaction.count ?? 0) > 0 && <span className="tabular-nums">{reaction.count}</span>}
        </button>
      ))}

      {!readOnly && (
        <>
          <button
            type="button"
            aria-label="Add reaction"
            aria-expanded={picking}
            onClick={() => setPicking((open) => !open)}
            className={cn(
              'inline-flex size-6 items-center justify-center rounded-cc-full border border-cc-border',
              'text-cc-faint transition-colors duration-150 ease-cc',
              'hover:bg-cc-subtle hover:text-cc-muted',
              'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
            )}
          >
            <PlusIcon size={12} />
          </button>

          {picking && (
            <>
              {/* A transparent full-screen layer closes the picker on any outside click
                  without a document listener that has to be torn down. */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPicking(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                className={cn(
                  'absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-cc-md',
                  'border border-cc-border bg-cc-surface p-1 shadow-cc-overlay animate-cc-rise',
                )}
              >
                {palette.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onToggle(emoji)
                      setPicking(false)
                    }}
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-cc-sm text-[15px]',
                      'transition-transform duration-150 ease-cc hover:scale-110 hover:bg-cc-subtle',
                      'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
