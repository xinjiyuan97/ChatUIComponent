/**
 * @xinjiyuan97/chat-ui — styled components.
 *
 * Everything here is a thin skin over the headless hooks in `@xinjiyuan97/chat-core`. If a
 * component's look doesn't fit your product, drop it and keep the hook: the state
 * machines live in core, not in these files.
 *
 * Styles are not imported here. Bring your own:
 *   - Tailwind v4 projects: `@import '@xinjiyuan97/chat-ui/tokens.css'`
 *   - everyone else:        `import '@xinjiyuan97/chat-ui/style.css'`
 */

export * from './lib/cn'
export * from './lib/format'
export * from './icons'

export * from './provider/ChatThemeProvider'
export * from './provider/locale'
export * from './provider/tools'
export * from './provider/panels'
export * from './provider/previews'

export * from './primitives/Button'
export * from './primitives/IconButton'
export * from './primitives/Collapsible'
export * from './primitives/Skeleton'
export * from './primitives/ImageSkeleton'

export * from './layout/ChatContainer'
export * from './layout/ChatDock'
export * from './layout/ChatWorkspace'
export * from './layout/SidePanel'

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
export * from './parts/ImagePart'
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
export * from './input/PromptBackdrop'
export * from './input/PromptQueue'
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

/* File preview. The entry points are `filePreviewPanel` / `folderPanel` — one line each to
 * hang the file-type registry off the panel-kind registry. Everything below them is exported
 * too, because a host that wants only the viewer (in a modal, a route, a split pane) should
 * not have to open a side panel to get one. */
export * from './preview/FilePreview'
export * from './preview/FileTree'
export * from './preview/FolderPreview'
export * from './preview/UnsupportedPreview'
export * from './preview/registry'
export * from './preview/PreviewFrame'
export * from './preview/PreviewLoader'
export * from './preview/download'

export * from './preview/TextPreview'
export * from './preview/MarkdownPreview'
export * from './preview/HtmlPreview'
export * from './preview/ImagePreview'
export * from './preview/PdfPreview'
export * from './preview/WordPreview'
export * from './preview/ExcelPreview'
export * from './preview/SlidesPreview'
