'use client'

import type { ChatMessage, PermissionPart as PermissionPartData } from '@xinjiyuan97/core'

import { PermissionMenu } from '../permission/PermissionMenu'
import { useChatTheme } from '../provider/ChatThemeProvider'

export type PermissionPartProps = {
  part: PermissionPartData
  message: ChatMessage
  className?: string
}

/**
 * A pending approval, in the transcript.
 *
 * The decision goes to `onPermissionDecision` on the provider rather than back into the
 * message: what happens next — resuming the agent, remembering the grant for the session,
 * writing an audit entry — is the host's business, and this component has no way to do any
 * of it. Rendering the answer is the reducer's job, via a `permission-resolved` event or a
 * fresh message list.
 */
export function PermissionPart({ part, message, className }: PermissionPartProps) {
  const { onPermissionDecision } = useChatTheme()

  return (
    <PermissionMenu
      request={part.request}
      resolution={part.resolution}
      onDecide={(resolution) => onPermissionDecision?.(resolution, message)}
      className={className}
    />
  )
}
