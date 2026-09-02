'use client'

import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

/** Where the content sits inside the composer box. */
export type PromptBackdropPlacement =
  'center' | 'top-right' | 'bottom-right' | 'bottom-left' | 'fill'

export type PromptBackdropProps = {
  children: ReactNode
  /**
   * Defaults to `top-right`, the one part of an empty composer nothing else claims: the
   * placeholder sits at the top left and the toolbar spans the entire bottom row, send
   * button included. `bottom-right` puts a watermark directly under that send button.
   */
  placement?: PromptBackdropPlacement
  /**
   * 0–1. Defaults to 0.06, which looks far too faint in isolation and is about right
   * behind live text — a watermark tuned by looking at it alone is always too heavy.
   * Ignored for `fill`, whose content is expected to carry its own alpha.
   */
  opacity?: number
  className?: string
}

const PLACEMENT: Record<PromptBackdropPlacement, string> = {
  center: 'inset-0 flex items-center justify-center p-3',
  'top-right': 'right-0 top-0 p-3',
  'bottom-right': 'bottom-0 right-0 p-3',
  'bottom-left': 'bottom-0 left-0 p-3',
  fill: 'inset-0',
}

/**
 * Positions something inside `PromptInput`'s `background` slot.
 *
 * The slot itself already handles the layering and the pointer-events; this adds the part
 * that is easy to get subtly wrong — placement that stays clear of the text, and an alpha
 * low enough that the watermark never competes with what the user is writing.
 */
export function PromptBackdrop({
  children,
  placement = 'top-right',
  opacity,
  className,
}: PromptBackdropProps) {
  const resolved = opacity ?? (placement === 'fill' ? 1 : 0.06)

  return (
    <div
      className={cn('absolute text-cc-fg', PLACEMENT[placement], className)}
      style={{ opacity: resolved }}
    >
      {children}
    </div>
  )
}
