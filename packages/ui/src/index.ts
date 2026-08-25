/**
 * @xinjiyuan97/ui — styled components.
 *
 * Everything here is a thin skin over the headless hooks in `@xinjiyuan97/core`. If a
 * component's look doesn't fit your product, drop it and keep the hook: the state
 * machines live in core, not in these files.
 *
 * Styles are not imported here. Bring your own:
 *   - Tailwind v4 projects: `@import '@xinjiyuan97/ui/tokens.css'`
 *   - everyone else:        `import '@xinjiyuan97/ui/style.css'`
 */

export * from './lib/cn'
export * from './lib/format'
export * from './icons'

export * from './provider/ChatThemeProvider'
export * from './provider/locale'

export * from './primitives/Button'
export * from './primitives/IconButton'
export * from './primitives/Collapsible'
export * from './primitives/Skeleton'

export * from './layout/ChatContainer'

export * from './message/Message'
export * from './message/MessageContent'
export * from './message/MessageActions'

export * from './parts/TextPart'
export * from './parts/ReasoningPart'
export * from './parts/ToolCallPart'
export * from './parts/A2UIPart'
export * from './parts/PermissionPart'
export * from './parts/TodoPart'
export * from './parts/FilePart'
export * from './parts/SourcesPart'
export * from './parts/ErrorPart'
export * from './parts/JsonViewer'

export * from './markdown/Markdown'
export * from './markdown/Blockquote'
export * from './markdown/Citation'
export * from './markdown/CodeBlock'
export * from './markdown/Mermaid'
export * from './markdown/mermaid-renderer'
export * from './markdown/complete-markdown'

export * from './permission/PermissionMenu'
export * from './todo/TodoList'

export * from './typing/TypingText'

export * from './input/PromptInput'
export * from './input/ModelSelect'
export * from './input/AttachmentList'
export * from './input/QuotePreview'
export * from './input/VoiceButton'

export * from './reactions/ActionButtons'
export * from './reactions/ReactionBar'

export * from './conversation/ConversationSidebar'
export * from './conversation/ConversationList'
export * from './conversation/ConversationItem'
export * from './conversation/AgentGroup'
