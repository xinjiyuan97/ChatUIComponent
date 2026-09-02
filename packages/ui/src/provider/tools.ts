'use client'

import type { ChatMessage, ToolPart } from '@xinjiyuan97/chat-core'
import type { ComponentType, ReactNode } from 'react'

import type { IconProps } from '../icons'

export type ToolRendererProps = {
  part: ToolPart
  message: ChatMessage
}

/**
 * A host-supplied component that renders one tool call in full.
 *
 * The heaviest of the extension points: it replaces the row, the status icon, the timing
 * and the disclosure. Reach for `ToolDefinition`'s lighter fields first — most tools only
 * need a different glyph, not a different component.
 */
export type ToolRenderer = ComponentType<ToolRendererProps>

/** Colour of the row's glyph. `default` follows the call's own status colours. */
export type ToolTone = 'default' | 'accent' | 'success' | 'warning' | 'danger'

/**
 * Motion applied to the glyph while the call is in flight.
 *
 * `spin` suits glyphs built around a circle; on anything else — a camera, a magnifier — a
 * rotation reads as a rendering bug, which is why `pulse` exists and is the default for
 * custom icons.
 */
export type ToolMotion = 'none' | 'spin' | 'pulse' | 'ping'

/**
 * A glyph, given either as an icon component or as a ready-made node.
 *
 * Deliberately not `(part) => ReactNode`: a component and a render function are both
 * plain functions at runtime, so a union of the two cannot be told apart without a
 * convention that would silently mis-render whichever form guessed wrong.
 */
export type ToolGlyph = ComponentType<IconProps> | ReactNode

/**
 * How one named tool should look in the transcript.
 *
 * Every field is optional and each one replaces exactly one piece of the default row, so
 * giving `generate_image` its own icon does not mean reimplementing the status glyph, the
 * timing readout and the disclosure alongside it. `render` remains available for the cases
 * where the row itself is the wrong shape.
 */
export type ToolDefinition = {
  /** Display name in place of the raw tool name. */
  label?: string | ((part: ToolPart) => ReactNode)
  icon?: ToolGlyph
  /** Replaces `icon` while the call is in flight. */
  runningIcon?: ToolGlyph
  /**
   * Defaults to `pulse` whenever a custom icon is set. Tools that register no icon keep
   * the built-in spinner and ignore this field.
   */
  runningMotion?: ToolMotion
  tone?: ToolTone
  /** Renders as a single row with no disclosure. See `ChatThemeProvider.toolVariant`. */
  compact?: boolean
  /** Replaces the one-line argument summary derived by `summarizeToolInput`. */
  summary?: (part: ToolPart) => ReactNode
  /** Replaces the body under the row, keeping the standard header. */
  renderBody?: (props: ToolRendererProps) => ReactNode
  /** Replaces the whole block, header included. */
  render?: ToolRenderer
}

/**
 * Identity function that pins the type of a tool definition at the point it is written.
 *
 * Without it, a definition declared in a standalone `const` is inferred structurally and
 * a typo in `runningMotion` only surfaces later, at the registration site, pointing at the
 * whole object rather than at the bad field.
 */
export function defineTool(definition: ToolDefinition): ToolDefinition {
  return definition
}

/** How a tool call is laid out: full card with a disclosure, or a single log-style row. */
export type ToolVariant = 'default' | 'compact'
