'use client'

import type {
  ChatMessage,
  PermissionPart as PermissionPartData,
  PermissionResolution,
} from '@xinjiyuan97/chat-core'

import { PermissionMenu } from '../permission/PermissionMenu'
import { useChatTheme } from '../provider/ChatThemeProvider'

export type PermissionPartProps = {
  part: PermissionPartData
  message: ChatMessage
  /** Optional direct store binding; the theme callback remains the compatibility fallback. */
  onDecide?: (resolution: PermissionResolution, message: ChatMessage) => void | Promise<void>
  className?: string
}

/**
 * A pending approval, in the transcript.
 *
 * The decision can be bound directly to the chat store through `onDecide`; when that is not
 * supplied, the existing provider callback remains the compatibility path for hosts that
 * manage approval persistence themselves.
 */
export function PermissionPart({ part, message, onDecide, className }: PermissionPartProps) {
  const { onPermissionDecision } = useChatTheme()
  const handleDecision = onDecide ?? onPermissionDecision

  return (
    <PermissionMenu
      request={part.request}
      resolution={part.resolution}
      onDecide={(resolution) => {
        void handleDecision?.(resolution, message)
      }}
      className={className}
    />
  )
}
