'use client'

import type { ChatMessage, PermissionResolution, ToolPart } from '@xinjiyuan97/core'
import type { A2UIAction, A2UIRegistry } from '@xinjiyuan97/a2ui'
import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react'

import { cn } from '../lib/cn'
/* Type-only, so this does not create an import cycle with `CodeBlock`, which imports
 * `useChatTheme` from here at runtime. */
import type { CodeRunner } from '../markdown/CodeBlock'
import { locales, zhCN, type ChatLocale, type LocaleName } from './locale'

export type Density = 'comfortable' | 'compact'

export type ToolRendererProps = {
  part: ToolPart
  message: ChatMessage
}

/**
 * A host-supplied renderer for one tool.
 *
 * This is the main extension point for function calls: register `read_file` and its
 * results render as a diff, register `search` and they render as a result list, while
 * every unregistered tool falls back to the generic JSON panel.
 */
export type ToolRenderer = ComponentType<ToolRendererProps>

export type AvatarRenderer = (message: ChatMessage) => ReactNode

export type ChatThemeContextValue = {
  locale: ChatLocale
  density: Density
  toolRenderers: Record<string, ToolRenderer>
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
  toolRenderers: {},
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

export type ChatThemeProviderProps = {
  children: ReactNode
  locale?: LocaleName | ChatLocale
  density?: Density
  toolRenderers?: Record<string, ToolRenderer>
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
    toolRenderers,
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
      toolRenderers: toolRenderers ?? {},
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
      toolRenderers,
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
