'use client'

import type { ChatMessage, MessagePart, SourcePart } from '@agent-chat/core'
import { useRef, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { CitationProvider } from '../markdown/Citation'
import { A2UIPart } from '../parts/A2UIPart'
import { ErrorPart } from '../parts/ErrorPart'
import { FilePart } from '../parts/FilePart'
import { ReasoningPart } from '../parts/ReasoningPart'
import { SourcesPart } from '../parts/SourcesPart'
import { TextPart } from '../parts/TextPart'
import { ToolCallPart } from '../parts/ToolCallPart'

export type MessageContentProps = {
  message: ChatMessage
  onRetry?: () => void
  /**
   * Replaces the built-in renderer for a part. Return `undefined` to fall through to the
   * default — that way a host can special-case one part type without reimplementing the
   * other seven.
   */
  renderPart?: (part: MessagePart, index: number, message: ChatMessage) => ReactNode | undefined
  className?: string
}

/**
 * Renders a message's parts in order.
 *
 * Order is the whole point of the parts model: text that came *after* a tool call has to
 * appear after it, and any renderer that groups by type instead of walking the array
 * silently rewrites the transcript.
 */
export function MessageContent({ message, onRetry, renderPart, className }: MessageContentProps) {
  const streaming = message.status === 'streaming'
  const sources = useStableSources(message.parts)
  const lastIndex = message.parts.length - 1

  return (
    /* Scoped to the message so `[1]` in two answers on screen means two different
     * documents, and so the numbering is just the position in `parts`. */
    <CitationProvider sources={sources}>
      <div className={cn('min-w-0', className)}>
        {message.parts.map((part, index) => {
          const custom = renderPart?.(part, index, message)
          if (custom !== undefined) return <div key={index}>{custom}</div>

          // Only the trailing part can still be receiving tokens; anything above it is
          // settled even while the message as a whole is streaming.
          const partStreaming = streaming && index === lastIndex

          switch (part.type) {
            case 'text':
              return (
                <TextPart
                  key={index}
                  part={part}
                  streaming={partStreaming}
                  plain={message.role === 'user'}
                />
              )
            case 'reasoning':
              return <ReasoningPart key={index} part={part} streaming={partStreaming} />
            case 'tool':
              return <ToolCallPart key={index} part={part} message={message} />
            case 'a2ui':
              return <A2UIPart key={index} part={part} message={message} />
            case 'file':
              return <FilePart key={index} part={part} />
            case 'error':
              return <ErrorPart key={index} part={part} onRetry={onRetry} />
            case 'source':
              // Collected and rendered once at the end instead of inline.
              return null
            case 'custom':
              // Unhandled by design: `renderPart` above is the hook for host-specific
              // parts, and guessing at a default here would only produce debug output.
              return null
          }
        })}

        {sources.length > 0 && <SourcesPart sources={sources} />}
      </div>
    </CitationProvider>
  )
}

function isSource(part: MessagePart): part is SourcePart {
  return part.type === 'source'
}

/**
 * The message's sources, with a reference that only changes when the sources do.
 *
 * `filter` produces a new array on every render, and that array is the citation context's
 * value — an unstable one would push a context update through every memoised Markdown
 * block on every streamed token, which is exactly the work the per-block memoisation
 * exists to avoid. Compared by field rather than by identity because a streaming store
 * hands back rebuilt part objects each delta.
 */
function useStableSources(parts: MessagePart[]): SourcePart[] {
  const next = parts.filter(isSource)
  const ref = useRef(next)
  const previous = ref.current

  const unchanged =
    previous.length === next.length &&
    next.every(
      (source, index) =>
        previous[index]?.url === source.url &&
        previous[index]?.title === source.title &&
        previous[index]?.snippet === source.snippet,
    )

  if (!unchanged) ref.current = next
  return ref.current
}
