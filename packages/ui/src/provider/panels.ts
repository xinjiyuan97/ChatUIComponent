'use client'

import type { SidePanelItem } from '@xinjiyuan97/chat-core'
import type { ComponentType, ReactNode } from 'react'

import type { IconProps } from '../icons'

export type PanelRenderProps<T = unknown> = {
  item: SidePanelItem<T>
  /**
   * Closes this tab from inside its own content.
   *
   * A preview that discovers its file is gone, or a task panel whose run has ended, is the
   * only thing that knows it should not be on screen any more.
   */
  close: () => void
}

/**
 * A glyph for the tab, given either as an icon component or as a ready-made node.
 *
 * Deliberately not `(item) => ReactNode`, for the same reason as `ToolGlyph`: a component
 * and a render function are both plain functions at runtime, so a union of the two cannot
 * be told apart without a convention that silently mis-renders whichever form guessed
 * wrong.
 */
export type PanelGlyph = ComponentType<IconProps> | ReactNode

/**
 * How one `kind` of side-panel item is drawn.
 *
 * The panel shell knows nothing beyond this: it draws a tab strip from `SidePanelItem`s
 * and hands the active one to the matching definition. That is what keeps the right-hand
 * column reusable — a file preview, a diff, a run log and a settings pane are all just
 * different entries in this registry.
 */
export type PanelDefinition<T = unknown> = {
  icon?: PanelGlyph
  render: ComponentType<PanelRenderProps<T>>
  /**
   * Padding around the content. On by default; turn it off for anything that should reach
   * the panel's edges — an image, a PDF viewer, its own toolbar.
   */
  padded?: boolean
}

/** What the provider holds: one definition per `kind`. */
export type PanelRegistry = Record<string, PanelDefinition>

/**
 * Pins the type of a panel definition where it is written, then widens it for the registry.
 *
 * The type parameter is the point: inside `render`, `item.data` is the payload this panel
 * actually receives rather than `unknown`, and a mistake in the definition is reported on
 * the offending field instead of on the whole object at the registration site.
 *
 * The registry itself has to be homogeneous, and a component's props are contravariant, so
 * `PanelDefinition<Payload>` is not assignable to `PanelDefinition<unknown>` — the widening
 * cast below is the price of typed payloads. It is sound in the direction that matters: the
 * shell only ever hands a definition the item that was registered alongside it.
 */
export function definePanel<T = unknown>(definition: PanelDefinition<T>): PanelDefinition {
  return definition as PanelDefinition
}
