/**
 * Core data model.
 *
 * A message is a *list of parts*, not a single content string. An assistant turn is
 * naturally a mixed sequence — reasoning, then a few tool calls, then text, then maybe
 * an agent-driven UI surface — and any model that flattens it to one string loses
 * ordering information we can never recover at render time.
 */

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageStatus = 'streaming' | 'complete' | 'error' | 'aborted'

/** Lifecycle of a single tool call, mirroring how providers stream them. */
export type ToolState =
  /** Arguments are still arriving as a partial JSON string. */
  | 'input-streaming'
  /** Arguments are complete and parsed; execution has not been reported yet. */
  | 'input-available'
  /** The host told us the tool is running. */
  | 'executing'
  | 'output-available'
  | 'output-error'

/**
 * A declarative UI node emitted by an agent. Kept in core (rather than in `@agent-chat/a2ui`)
 * so the message model has no dependency on the renderer — it is plain data.
 */
export type A2UINode = {
  type: string
  key?: string
  /** Values may contain `{{path.to.value}}` templates, resolved against the surface data. */
  props?: Record<string, unknown>
  children?: A2UINode[] | string
  /** Conditional render. Only `path`, `!path` and `path == 'literal'` are supported. */
  when?: string
}

export type A2UIPatch = {
  op: 'replace' | 'merge' | 'append'
  /** Dot path into the surface data. Omitted means the whole surface. */
  path?: string
  value: unknown
}

export type TextPart = {
  type: 'text'
  text: string
}

export type ReasoningPart = {
  type: 'reasoning'
  text: string
  /** Filled in when the reasoning block closes. */
  durationMs?: number
  /** Wall-clock start, used to render a live counter while streaming. */
  startedAt?: number
}

export type ToolPart = {
  type: 'tool'
  toolCallId: string
  name: string
  state: ToolState
  /** Parsed arguments. Only present once the JSON is complete and valid. */
  input?: unknown
  /** Raw argument text. Always present while streaming, and kept if JSON parsing fails. */
  inputText?: string
  output?: unknown
  error?: string
  startedAt?: number
  durationMs?: number
}

export type A2UIPart = {
  type: 'a2ui'
  surfaceId: string
  spec: A2UINode
  /** Data bound into the spec's `{{...}}` templates. */
  data?: Record<string, unknown>
  /** Set once the user has acted on the surface, so it can render read-only. */
  resolved?: boolean
}

export type FilePart = {
  type: 'file'
  url: string
  mediaType: string
  name?: string
  size?: number
}

export type SourcePart = {
  type: 'source'
  url: string
  title?: string
  snippet?: string
}

export type ErrorPart = {
  type: 'error'
  message: string
  retryable?: boolean
}

/** Escape hatch: anything the host wants to render itself. */
export type CustomPart = {
  type: 'custom'
  name: string
  data: unknown
}

export type MessagePart =
  TextPart | ReasoningPart | ToolPart | A2UIPart | FilePart | SourcePart | ErrorPart | CustomPart

export type Reaction = {
  /** Emoji, or a semantic key like `like` / `dislike`. */
  key: string
  count?: number
  /** Whether the current user has applied this reaction. */
  active?: boolean
}

export type ChatMessage = {
  id: string
  role: MessageRole
  parts: MessagePart[]
  createdAt?: number
  status?: MessageStatus
  reactions?: Reaction[]
  metadata?: Record<string, unknown>
}

/**
 * A passage the user is replying to, shown above the composer.
 *
 * Carries a copy of the text rather than only a `messageId`, because the quote is usually
 * a *selection* — the two sentences worth answering out of a long reply — and re-deriving
 * that from an id is not possible. The id rides along for hosts that want to thread.
 */
export type QuotedMessage = {
  messageId?: string
  /** Shown as the strip's title, e.g. the assistant's name. */
  author?: string
  /** Always rendered as plain text; never parsed as Markdown. */
  text: string
}

export type TokenUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

/** Status of the conversation as a whole, not of an individual message. */
export type ChatStatus = 'idle' | 'submitted' | 'streaming' | 'error'

/**
 * A named assistant that conversations can belong to.
 *
 * Deliberately thin: the sidebar needs a label and a glyph, nothing more. Prompts, tool
 * configuration and model selection are the host's business — putting them here would
 * make a display type into a configuration format.
 */
export type Agent = {
  id: string
  name: string
  /** One line under the name in the section header. */
  description?: string
  /** Character or emoji for the badge; falls back to the first character of `name`. */
  avatar?: string
  metadata?: Record<string, unknown>
}

/**
 * One entry in the composer's model picker.
 *
 * Purely a label for something the host already knows how to call — the library never
 * maps an id onto an endpoint. Keeping it that way is what lets the same picker list
 * OpenAI models, a local Ollama build and "fast / thorough" presets side by side.
 */
export type ChatModel = {
  id: string
  name: string
  /** One line under the name in the menu. */
  description?: string
  /** Short tag on the right, e.g. `快` or `Pro`. */
  badge?: string
  /** Listed but not selectable — out of quota, not enabled for this workspace. */
  disabled?: boolean
  metadata?: Record<string, unknown>
}

export type Conversation = {
  id: string
  title: string
  updatedAt: number
  createdAt?: number
  pinned?: boolean
  /** Rendered as dimmed secondary text under the title. */
  preview?: string
  unread?: boolean
  /** Owning agent. Missing — or pointing at an unknown agent — means "unassigned". */
  agentId?: string
  metadata?: Record<string, unknown>
}

/* ------------------------------------------------------------------ helpers */

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === 'text'
}

export function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === 'reasoning'
}

export function isToolPart(part: MessagePart): part is ToolPart {
  return part.type === 'tool'
}

export function isA2UIPart(part: MessagePart): part is A2UIPart {
  return part.type === 'a2ui'
}

/** Concatenated plain text of a message — used for copy-to-clipboard and a11y labels. */
export function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join('\n\n')
}
