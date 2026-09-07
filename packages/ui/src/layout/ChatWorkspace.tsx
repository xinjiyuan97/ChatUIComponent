'use client'

import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

export type ChatWorkspaceProps = {
  /** The left rail — normally a `ConversationSidebar`. */
  sidebar?: ReactNode
  /** The middle column: the transcript and the composer. */
  children: ReactNode
  /** The right column — normally a `SidePanel`. */
  panel?: ReactNode
  className?: string
}

/**
 * The three-column application shell: conversations, transcript, side panel.
 *
 * Thin on purpose — the two side columns own their own widths, so all that is left is the
 * frame around them. It exists because that frame has three details every host otherwise
 * has to rediscover, and two of them fail in ways that look like bugs in something else:
 *
 * - `min-w-0` on the middle column. Without it a flex item refuses to shrink below its
 *   content, so one long code block or one unbroken URL widens the transcript and pushes
 *   the panel off screen.
 * - `relative`, which is the positioning context the panel's overlay mode needs on narrow
 *   screens.
 * - An unbroken `h-full min-h-0` chain, without which the transcript scrolls the page
 *   instead of scrolling itself.
 */
export function ChatWorkspace({ sidebar, children, panel, className }: ChatWorkspaceProps) {
  return (
    <div className={cn('relative flex h-full min-h-0 w-full overflow-hidden', className)}>
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      {panel}
    </div>
  )
}
