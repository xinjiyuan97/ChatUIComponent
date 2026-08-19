'use client'

import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'

import { A2UIErrorBoundary } from './ErrorBoundary'
import { createRegistryLookup } from './registry'
import { isActionDescriptor, sanitizeProps } from './sanitize'
import { evaluateCondition, resolveTemplate } from './template'
import {
  DEFAULT_LIMITS,
  type A2UIAction,
  type A2UIActionDescriptor,
  type A2UIComponent,
  type A2UIContext,
  type A2UILimits,
  type A2UINode,
  type A2UIRegistry,
} from './types'

export type A2UIRendererProps = {
  spec: A2UINode | null | undefined
  registry: A2UIRegistry
  /** Bound to `{{...}}` templates and `when` conditions. */
  data?: Record<string, unknown>
  onAction?: (action: A2UIAction) => void
  surfaceId?: string
  /** Renders the surface read-only, e.g. after the user has already submitted. */
  disabled?: boolean
  limits?: A2UILimits
  /** Rendered for a node whose `type` is not in the registry. */
  renderUnknown?: (node: A2UINode) => ReactNode
  /** Rendered once when a budget is exceeded, so truncation is never silent. */
  renderTruncated?: (reason: 'nodes' | 'depth') => ReactNode
  renderError?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error) => void
}

type Lookup = (type: string) => A2UIComponent | undefined

type Budget = {
  /** Remaining node allowance for this render pass. */
  nodes: number
  maxDepth: number
  truncated: 'nodes' | 'depth' | null
}

/**
 * Renders an agent-authored spec.
 *
 * The tree is built in one recursive pass rather than as nested React components, which
 * is what makes the node and depth budgets exact: a runaway spec is cut off before it
 * ever reaches the reconciler, instead of after it has already blown up the render.
 */
export function A2UIRenderer(props: A2UIRendererProps) {
  const {
    spec,
    registry,
    data,
    onAction,
    surfaceId = 'surface',
    disabled = false,
    limits,
    renderUnknown,
    renderTruncated,
    renderError,
    onError,
  } = props

  /** Values of every named input in this surface, submitted together with an action. */
  const [values, setValues] = useState<Record<string, unknown>>({})

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [name]: value }))
  }, [])

  const emit = useCallback(
    (descriptor: unknown) => {
      if (!isActionDescriptor(descriptor)) return
      const typed = descriptor as A2UIActionDescriptor
      onAction?.({
        action: typed.action,
        payload: typed.payload,
        // Sending the whole surface state by default means an agent never has to
        // round-trip individual field changes just to read a form back.
        formData: typed.includeFormData === false ? {} : values,
        surfaceId,
        resolve: typed.resolve !== false,
      })
    },
    [onAction, surfaceId, values],
  )

  const lookup = useMemo<Lookup>(() => createRegistryLookup(registry), [registry])

  // Form state feeds back into template resolution, so `{{values.email}}` works and a
  // spec can show a live summary of what the user has typed.
  const scope = useMemo<Record<string, unknown>>(
    () => ({ ...(data ?? {}), values }),
    [data, values],
  )

  const ctx = useMemo<A2UIContext>(
    () => ({ surfaceId, data: scope, values, setValue, emit, disabled }),
    [surfaceId, scope, values, setValue, emit, disabled],
  )

  const tree = useMemo(() => {
    if (!spec) return null
    const budget: Budget = {
      nodes: limits?.maxNodes ?? DEFAULT_LIMITS.maxNodes,
      maxDepth: limits?.maxDepth ?? DEFAULT_LIMITS.maxDepth,
      truncated: null,
    }
    const rendered = renderNode(spec, ctx, lookup, budget, 0, 'root', renderUnknown)
    return { rendered, truncated: budget.truncated }
  }, [spec, ctx, lookup, limits?.maxNodes, limits?.maxDepth, renderUnknown])

  if (!tree) return null

  return (
    <A2UIErrorBoundary fallback={renderError} onError={(error) => onError?.(error)}>
      {tree.rendered}
      {tree.truncated ? (renderTruncated?.(tree.truncated) ?? null) : null}
    </A2UIErrorBoundary>
  )
}

function renderNode(
  node: A2UINode,
  ctx: A2UIContext,
  lookup: Lookup,
  budget: Budget,
  depth: number,
  key: string,
  renderUnknown?: (node: A2UINode) => ReactNode,
): ReactNode {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null

  if (depth > budget.maxDepth) {
    budget.truncated = 'depth'
    return null
  }
  if (budget.nodes <= 0) {
    budget.truncated = 'nodes'
    return null
  }
  budget.nodes -= 1

  if (!evaluateCondition(node.when, ctx.data)) return null

  const resolved = resolveTemplate(node.props ?? {}, ctx.data)
  const safeProps = sanitizeProps(
    resolved && typeof resolved === 'object' && !Array.isArray(resolved)
      ? (resolved as Record<string, unknown>)
      : {},
  )

  const children = renderChildren(node, ctx, lookup, budget, depth, renderUnknown)
  const Component = lookup(node.type)

  if (!Component) {
    // An unknown type is expected, not exceptional: registries are host-specific and
    // models invent component names. Never throw here.
    return <Fragment key={key}>{renderUnknown?.(node) ?? null}</Fragment>
  }

  return (
    <Component key={node.key ?? key} props={safeProps} node={node} ctx={ctx}>
      {children}
    </Component>
  )
}

function renderChildren(
  node: A2UINode,
  ctx: A2UIContext,
  lookup: Lookup,
  budget: Budget,
  depth: number,
  renderUnknown?: (node: A2UINode) => ReactNode,
): ReactNode {
  const { children } = node
  if (children === undefined || children === null) return undefined

  if (typeof children === 'string') {
    const text = resolveTemplate(children, ctx.data)
    return text === undefined || text === null ? '' : String(text)
  }
  if (!Array.isArray(children)) return undefined

  return children.map((child, index) =>
    renderNode(child, ctx, lookup, budget, depth + 1, `${node.type}-${index}`, renderUnknown),
  )
}
