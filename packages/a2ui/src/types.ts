import type { A2UINode, A2UIPatch } from '@agent-chat/core'
import type { ComponentType, ReactNode } from 'react'

export type { A2UINode, A2UIPatch }

/**
 * What an agent writes into a prop to describe an interaction, e.g.
 * `{ "onClick": { "action": "confirm_order", "payload": { "id": 42 } } }`.
 */
export type A2UIActionDescriptor = {
  action: string
  payload?: unknown
  /** Attach the surface's collected form values. Defaults to true. */
  includeFormData?: boolean
  /** Ask the host to lock the surface after this action. Defaults to true. */
  resolve?: boolean
}

/** What the host receives when the user interacts with a surface. */
export type A2UIAction = {
  action: string
  payload?: unknown
  formData: Record<string, unknown>
  surfaceId: string
  resolve: boolean
}

/** Everything a registry component needs, passed as a single prop bag. */
export type A2UIContext = {
  surfaceId: string
  /** Data bound into `{{...}}` templates. */
  data: Record<string, unknown>
  /** Current values of every named input in this surface. */
  values: Record<string, unknown>
  setValue: (name: string, value: unknown) => void
  /** Fires an action descriptor. Safe to call with `undefined`. */
  emit: (descriptor: unknown) => void
  /** True once the surface has been acted on — components should render read-only. */
  disabled: boolean
}

export type A2UIComponentProps = {
  /** Resolved and sanitised props. Templates are already substituted. */
  props: Record<string, unknown>
  children?: ReactNode
  node: A2UINode
  ctx: A2UIContext
}

export type A2UIComponent = ComponentType<A2UIComponentProps>

export type A2UIRegistry = Record<string, A2UIComponent>

export type A2UILimits = {
  /** Maximum total nodes rendered per surface. */
  maxNodes?: number
  /** Maximum nesting depth. */
  maxDepth?: number
}

export const DEFAULT_LIMITS: Required<A2UILimits> = {
  maxNodes: 500,
  maxDepth: 20,
}
