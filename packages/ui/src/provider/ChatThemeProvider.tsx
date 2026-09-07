'use client'

import type { ChatMessage, PermissionResolution } from '@xinjiyuan97/chat-core'
import type { A2UIAction, A2UIRegistry } from '@xinjiyuan97/chat-a2ui'
import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { cn } from '../lib/cn'
/* Type-only, so this does not create an import cycle with `CodeBlock`, which imports
 * `useChatTheme` from here at runtime. */
import type { CodeRunner } from '../markdown/CodeBlock'
import { locales, zhCN, type ChatLocale, type LocaleName } from './locale'
import type { PanelDefinition, PanelRegistry } from './panels'
import type { PreviewRegistry } from './previews'
import type { ToolDefinition, ToolRenderer, ToolVariant } from './tools'

export type Density = 'comfortable' | 'compact'

export type AvatarRenderer = (message: ChatMessage) => ReactNode

export type ChatThemeContextValue = {
  locale: ChatLocale
  density: Density
  /**
   * The registry components actually read: `toolRenderers` normalised into
   * `ToolDefinition`s and merged under `tools`.
   */
  tools: Record<string, ToolDefinition>
  /** @deprecated Use `tools`. Kept so existing readers of the context keep working. */
  toolRenderers: Record<string, ToolRenderer>
  /** Layout for tool calls that do not set `compact` themselves. */
  toolVariant: ToolVariant
  /** What draws each `kind` of side-panel item. Keyed by `SidePanelItem.kind`. */
  panels: PanelRegistry
  /**
   * Host-registered file previews. Read through `usePreviewDefinition`, which falls back to
   * the built-ins — so this holds only what the host added, and entries here win.
   */
  previews: PreviewRegistry
  /**
   * URL of the `pdfjs-dist` worker. Without it there is no PDF preview.
   *
   * Deliberately not defaulted to a CDN: an intranet or air-gapped deployment would fail
   * silently, and a worker whose version does not match the installed `pdfjs-dist` produces
   * an error nobody can diagnose from the message. Better to say what is missing.
   */
  pdfWorkerSrc?: string
  a2uiRegistry: A2UIRegistry
  onA2UIAction?: (action: A2UIAction, message: ChatMessage) => void
  /**
   * Called when the user answers an approval prompt.
   *
   * Unset means the menu still works and still shows its receipt, but nothing downstream
   * happens — resuming the agent and remembering a session-wide grant are the host's
   * decisions, and there is no safe default for either.
   */
  onPermissionDecision?: (resolution: PermissionResolution, message: ChatMessage) => void
  renderUserAvatar?: AvatarRenderer
  renderAssistantAvatar?: AvatarRenderer
  /** Shiki themes, keyed by colour scheme. */
  codeThemes: { light: string; dark: string }
  /**
   * Gives every code block in a reply a run button, wired to the host's executor.
   *
   * Unset by default, and unset means no run button anywhere: executing model output is a
   * decision the application makes, not one the renderer makes for it.
   */
  onRunCode?: CodeRunner
  /** Renders ```mermaid fences as diagrams. On by default. */
  mermaid: boolean
  /** Turns the typewriter reveal off globally, e.g. for a printable transcript. */
  typewriter: boolean
}

const ChatThemeContext = createContext<ChatThemeContextValue | null>(null)

const FALLBACK: ChatThemeContextValue = {
  locale: zhCN,
  density: 'comfortable',
  tools: {},
  toolRenderers: {},
  toolVariant: 'default',
  panels: {},
  previews: {},
  a2uiRegistry: {},
  codeThemes: { light: 'github-light', dark: 'github-dark' },
  mermaid: true,
  typewriter: true,
}

/**
 * Reading the theme works outside a provider too, falling back to sane defaults.
 *
 * Components that silently break when someone forgets a provider are a bad trade for a
 * component library — the defaults here are what a first-time user would want anyway.
 */
export function useChatTheme(): ChatThemeContextValue {
  return useContext(ChatThemeContext) ?? FALLBACK
}

export function useLocale(): ChatLocale {
  return useChatTheme().locale
}

/** How the host wants one named tool rendered, if it registered anything for it. */
export function useToolDefinition(name: string): ToolDefinition | undefined {
  return useChatTheme().tools[name]
}

/**
 * What draws one `kind` of side-panel item, if anything is registered for it.
 *
 * An unregistered kind is a normal outcome, not a bug: what ends up in the side panel is
 * driven by agent output, so the shell has to be able to say "nothing here knows how to
 * show this" without taking the page down.
 */
export function usePanelDefinition(kind: string): PanelDefinition | undefined {
  return useChatTheme().panels[kind]
}

export type ChatThemeProviderProps = {
  children: ReactNode
  locale?: LocaleName | ChatLocale
  density?: Density
  /**
   * Per-tool presentation: glyph, label, motion, layout, or a full replacement renderer.
   *
   * Wins over `toolRenderers` for the same name.
   */
  tools?: Record<string, ToolDefinition>
  /** @deprecated Use `tools` with a `render` field. */
  toolRenderers?: Record<string, ToolRenderer>
  /**
   * Default layout for every tool call. `compact` collapses them to one log-style line
   * each, which is what makes a twenty-call turn readable; individual tools can still opt
   * in or out via their `ToolDefinition`.
   */
  toolVariant?: ToolVariant
  /**
   * What draws each `kind` of side-panel item, keyed by `SidePanelItem.kind`.
   *
   * `SidePanel` looks everything up here, which is the whole reason the right-hand column
   * is not a file-preview component: registering a kind is how anything else — a diff, a
   * run log, a settings pane — gets to live there too.
   */
  panels?: PanelRegistry
  /**
   * Extra file previews, or replacements for the built-in ones.
   *
   * Entries here are consulted before the built-ins, so swapping our markdown viewer for
   * your own needs no unregistration — just claim `extensions: ['md']`. See
   * `resolvePreview` for the exact order.
   */
  previews?: PreviewRegistry
  /** URL of the `pdfjs-dist` worker. Required for the PDF preview; there is no default. */
  pdfWorkerSrc?: string
  a2uiRegistry?: A2UIRegistry
  onA2UIAction?: (action: A2UIAction, message: ChatMessage) => void
  onPermissionDecision?: (resolution: PermissionResolution, message: ChatMessage) => void
  renderUserAvatar?: AvatarRenderer
  renderAssistantAvatar?: AvatarRenderer
  codeThemes?: { light: string; dark: string }
  onRunCode?: CodeRunner
  mermaid?: boolean
  typewriter?: boolean
  className?: string
  /** Render only the context, without the wrapper element. */
  asFragment?: boolean
}

/**
 * Root of the library.
 *
 * Besides carrying configuration, the wrapper element is what scopes the density
 * variables and the reduced-motion override in `tokens.css`, so rendering it matters
 * even when every prop is left at its default.
 */
export function ChatThemeProvider(props: ChatThemeProviderProps) {
  const {
    children,
    locale = 'zh-CN',
    density = 'comfortable',
    tools,
    toolRenderers,
    toolVariant = 'default',
    panels,
    previews,
    pdfWorkerSrc,
    a2uiRegistry,
    onA2UIAction,
    onPermissionDecision,
    renderUserAvatar,
    renderAssistantAvatar,
    codeThemes,
    onRunCode,
    mermaid = true,
    typewriter = true,
    className,
    asFragment = false,
  } = props

  const value = useMemo<ChatThemeContextValue>(
    () => ({
      locale: typeof locale === 'string' ? (locales[locale] ?? zhCN) : locale,
      density,
      // The two registries are flattened into one here rather than at every read site, so
      // no component downstream has to know that the deprecated shape ever existed.
      tools: mergeToolRegistries(toolRenderers, tools),
      toolRenderers: toolRenderers ?? {},
      toolVariant,
      panels: panels ?? {},
      previews: previews ?? {},
      pdfWorkerSrc,
      a2uiRegistry: a2uiRegistry ?? {},
      onA2UIAction,
      onPermissionDecision,
      renderUserAvatar,
      renderAssistantAvatar,
      codeThemes: codeThemes ?? FALLBACK.codeThemes,
      onRunCode,
      mermaid,
      typewriter,
    }),
    [
      locale,
      density,
      tools,
      toolRenderers,
      toolVariant,
      panels,
      previews,
      pdfWorkerSrc,
      a2uiRegistry,
      onA2UIAction,
      onPermissionDecision,
      renderUserAvatar,
      renderAssistantAvatar,
      codeThemes,
      onRunCode,
      mermaid,
      typewriter,
    ],
  )

  if (asFragment) {
    return <ChatThemeContext.Provider value={value}>{children}</ChatThemeContext.Provider>
  }

  return (
    <ChatThemeContext.Provider value={value}>
      <div
        data-cc-root=""
        data-cc-density={density}
        lang={value.locale.code}
        className={cn(
          'cc-root font-cc-sans text-cc-body text-cc-fg antialiased',
          '[text-rendering:optimizeLegibility]',
          className,
        )}
      >
        {children}
      </div>
    </ChatThemeContext.Provider>
  )
}

/**
 * Folds the deprecated `toolRenderers` map into the `tools` registry.
 *
 * A bare renderer is exactly a definition whose only field is `render`, so the old prop
 * survives as sugar rather than as a second code path. `tools` wins on collision: a host
 * mid-migration has the new registration as the one it just wrote.
 */
function mergeToolRegistries(
  renderers: Record<string, ToolRenderer> | undefined,
  definitions: Record<string, ToolDefinition> | undefined,
): Record<string, ToolDefinition> {
  if (!renderers) return definitions ?? {}

  const merged: Record<string, ToolDefinition> = {}
  for (const [name, render] of Object.entries(renderers)) merged[name] = { render }
  return definitions ? { ...merged, ...definitions } : merged
}
