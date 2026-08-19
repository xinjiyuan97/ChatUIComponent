'use client'

import type { ChatMessage, A2UIPart as A2UIPartData } from '@agent-chat/core'
import { A2UIRenderer, type A2UINode } from '@agent-chat/a2ui'

import { cn } from '../lib/cn'
import { AlertIcon } from '../icons'
import { useChatTheme } from '../provider/ChatThemeProvider'

export type A2UIPartProps = {
  part: A2UIPartData
  message: ChatMessage
  className?: string
}

/**
 * An agent-authored UI surface embedded in the transcript.
 *
 * Everything here is defensive on purpose. The spec is model output, which means it is
 * untrusted input in the ordinary security sense *and* unreliable in the ordinary
 * engineering sense — it can name components that don't exist, nest a thousand levels
 * deep, or arrive half-written. Each of those degrades to something readable instead of
 * taking the message down with it.
 */
export function A2UIPart({ part, message, className }: A2UIPartProps) {
  const { a2uiRegistry, onA2UIAction, locale } = useChatTheme()

  return (
    <div
      className={cn(
        'my-2.5 rounded-cc-md border border-cc-border bg-cc-surface p-3.5 shadow-cc-card',
        // A resolved surface reads as a record of what happened, not as something still
        // asking for input.
        part.resolved && 'opacity-70',
        className,
      )}
      data-cc-surface={part.surfaceId}
    >
      <A2UIRenderer
        spec={part.spec as A2UINode}
        registry={a2uiRegistry}
        data={part.data}
        surfaceId={part.surfaceId}
        disabled={part.resolved}
        onAction={(action) => onA2UIAction?.(action, message)}
        renderUnknown={(node) => (
          <div className="rounded-cc-xs bg-cc-subtle px-2 py-1.5 font-cc-mono text-cc-xs text-cc-muted">
            {locale.a2uiUnknownComponent(node.type)}
          </div>
        )}
        renderTruncated={() => (
          <div className="mt-2 flex items-center gap-1.5 text-cc-xs text-cc-faint">
            <AlertIcon size={12} />
            {locale.a2uiTruncated}
          </div>
        )}
        renderError={() => (
          <div className="flex items-center gap-1.5 text-cc-sm text-cc-danger">
            <AlertIcon size={13} />
            {locale.a2uiError}
          </div>
        )}
      />

      {part.resolved && <div className="mt-2 text-cc-xs text-cc-faint">{locale.a2uiSubmitted}</div>}
    </div>
  )
}
