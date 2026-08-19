import type { A2UINode, A2UIPatch, TokenUsage } from './types'

/**
 * The normalised event stream.
 *
 * Every transport — SSE, OpenAI, Anthropic, mock — converts its wire format into these
 * events, and the store only ever consumes these. Swapping backends therefore never
 * touches the UI layer.
 */
export type ChatEvent =
  /** A new assistant message begins. `id` lets the host correlate with its own records. */
  | { type: 'message-start'; id?: string }
  | { type: 'text-start' }
  | { type: 'text-delta'; delta: string }
  | { type: 'text-end' }
  | { type: 'reasoning-start' }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'reasoning-end' }
  | { type: 'tool-input-start'; toolCallId: string; name: string }
  /** A chunk of the argument JSON, as raw text. */
  | { type: 'tool-input-delta'; toolCallId: string; delta: string }
  /** Arguments are final. `input` wins over anything accumulated from deltas. */
  | { type: 'tool-input-available'; toolCallId: string; input: unknown }
  | { type: 'tool-executing'; toolCallId: string }
  | { type: 'tool-output'; toolCallId: string; output: unknown }
  | { type: 'tool-error'; toolCallId: string; error: string }
  | { type: 'a2ui'; surfaceId: string; spec: A2UINode; data?: Record<string, unknown> }
  | { type: 'a2ui-patch'; surfaceId: string; patch: A2UIPatch }
  | { type: 'file'; url: string; mediaType: string; name?: string }
  | { type: 'source'; url: string; title?: string; snippet?: string }
  | { type: 'custom'; name: string; data: unknown }
  | { type: 'message-end'; finishReason?: string; usage?: TokenUsage }
  | { type: 'error'; error: string }

export type ChatEventType = ChatEvent['type']
