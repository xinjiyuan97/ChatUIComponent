'use client'

import { useSmoothText, type TextPart as TextPartData } from '@xinjiyuan97/core'

import { cn } from '../lib/cn'
import { Markdown } from '../markdown/Markdown'
import { useChatTheme } from '../provider/ChatThemeProvider'

export type TextPartProps = {
  part: TextPartData
  streaming?: boolean
  /** Skips Markdown parsing — used for user messages, which are literal text. */
  plain?: boolean
  className?: string
}

/**
 * Assistant prose.
 *
 * Two layers of smoothing stack here and they solve different problems: the store batches
 * events to one flush per frame so React renders at most 60 times a second, and
 * `useSmoothText` then paces those frames' worth of characters evenly so a 40-character
 * burst followed by a 300ms silence still reads as continuous typing.
 */
export function TextPart({ part, streaming = false, plain = false, className }: TextPartProps) {
  const { typewriter } = useChatTheme()
  const { displayed, isTyping } = useSmoothText(part.text, {
    enabled: typewriter && streaming,
  })

  if (plain) {
    return (
      <div className={cn('whitespace-pre-wrap break-words text-cc-body leading-[1.65]', className)}>
        {displayed}
      </div>
    )
  }

  return (
    <div className={className} data-cc-typing={isTyping || streaming ? 'true' : undefined}>
      {/* `streaming` is passed through so half-written syntax is repaired before parsing;
          see `completeMarkdown`. */}
      <Markdown streaming={streaming}>{displayed}</Markdown>
    </div>
  )
}
