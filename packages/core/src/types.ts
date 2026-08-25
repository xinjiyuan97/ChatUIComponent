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
 * A declarative UI node emitted by an agent. Kept in core (rather than in `@xinjiyuan97/chat-a2ui`)
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

/* ------------------------------------------------------------------ permission */

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny'

/**
 * Rough blast radius of the pending action.
 *
 * Advisory only — the library never decides for itself that a command is dangerous. It is
 * the host that knows whether `rm -rf` points at a scratch directory or at production.
 */
export type PermissionRisk = 'low' | 'medium' | 'high'

export type PermissionOption = {
  /** Handed back verbatim in the resolution. */
  value: string
  /** Drives the read-back wording and, for `deny`, the reason field. */
  decision: PermissionDecision
  /** Falls back to the locale's wording for `decision`. */
  label?: string
  description?: string
  /**
   * Choosing this option opens a free-text field instead of committing immediately —
   * "no, do it this other way" is the answer that carries the most information back to
   * the model, and it is lost if picking deny ends the interaction.
   */
  promptForReason?: boolean
  /** With `promptForReason`, the field may not be left empty. */
  requiresReason?: boolean
  disabled?: boolean
}

/**
 * An action the agent is asking to be allowed to take.
 *
 * Deliberately carries the payload as text (`detail`) rather than as the tool's parsed
 * arguments: what the user is approving is the *concrete* thing that will happen — this
 * command, this path, this URL — and re-deriving that from an argument object is guesswork
 * that differs per tool.
 */
export type PermissionRequest = {
  id: string
  /** The tool asking, e.g. `bash`. */
  toolName: string
  /** Ties the request back to the `ToolPart` it belongs to, when there is one. */
  toolCallId?: string
  /** One line: what will happen. Falls back to the locale's wording for `toolName`. */
  title?: string
  /** The thing being approved, shown verbatim in a mono block. */
  detail?: string
  /** Language tag for `detail`, surfaced as a data attribute for host styling. */
  detailLanguage?: string
  risk?: PermissionRisk
  /** Replaces the three built-in options. */
  options?: PermissionOption[]
  createdAt?: number
  metadata?: Record<string, unknown>
}

export type PermissionResolution = {
  requestId: string
  /** `value` of the chosen option. */
  option: string
  decision: PermissionDecision
  /** Free text the user typed when denying. */
  reason?: string
  decidedAt?: number
}

export type PermissionPart = {
  type: 'permission'
  request: PermissionRequest
  /** Set once decided; the menu then renders as a read-only record. */
  resolution?: PermissionResolution
}

/**
 * The three answers every approval prompt needs.
 *
 * Carries no copy on purpose — labels come from the UI layer's locale, so core stays free
 * of translation strings.
 */
export const DEFAULT_PERMISSION_OPTIONS: PermissionOption[] = [
  { value: 'allow-once', decision: 'allow-once' },
  { value: 'allow-always', decision: 'allow-always' },
  // Opens the reason box but does not demand one: a denial with no explanation is still a
  // valid answer, and blocking on a text field would make "no" the slowest option.
  { value: 'deny', decision: 'deny', promptForReason: true },
]

/* ------------------------------------------------------------------ todo */

export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'

export type TodoItem = {
  id: string
  title: string
  status: TodoStatus
  /** Present-tense form shown while the item runs, e.g. 「正在重构 auth.ts」. */
  activeTitle?: string
  /** One dim line under the title. */
  note?: string
  metadata?: Record<string, unknown>
}

/**
 * The agent's plan for the current task.
 *
 * `todoId` is what keeps a long run readable: an agent revises its plan a dozen times, and
 * re-emitting the same id replaces the block in place instead of pushing another copy of
 * the checklist into the transcript.
 */
export type TodoPart = {
  type: 'todo'
  todoId: string
  items: TodoItem[]
  title?: string
}

/** Escape hatch: anything the host wants to render itself. */
export type CustomPart = {
  type: 'custom'
  name: string
  data: unknown
}

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | A2UIPart
  | PermissionPart
  | TodoPart
  | FilePart
  | SourcePart
  | ErrorPart
  | CustomPart

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

export function isPermissionPart(part: MessagePart): part is PermissionPart {
  return part.type === 'permission'
}

export function isTodoPart(part: MessagePart): part is TodoPart {
  return part.type === 'todo'
}

export type TodoProgress = {
  /** Excludes cancelled items — see the note on `ratio`. */
  total: number
  completed: number
  inProgress: number
  pending: number
  cancelled: number
  /** 0–1. Always 0 for an empty list rather than NaN. */
  ratio: number
  /** What to show when the list is collapsed to one line. */
  current?: TodoItem
  done: boolean
}

/**
 * Counts for a plan, in the form a progress display needs.
 *
 * Cancelled items are excluded from the denominator: a plan whose last two steps were
 * dropped is *finished*, and a bar that stops at 5/7 forever reads as a stalled task.
 * They are still counted separately so the list can render them struck through.
 */
export function getTodoProgress(items: TodoItem[]): TodoProgress {
  let completed = 0
  let inProgress = 0
  let pending = 0
  let cancelled = 0

  for (const item of items) {
    if (item.status === 'completed') completed++
    else if (item.status === 'in-progress') inProgress++
    else if (item.status === 'cancelled') cancelled++
    else pending++
  }

  const total = items.length - cancelled
  return {
    total,
    completed,
    inProgress,
    pending,
    cancelled,
    ratio: total === 0 ? 0 : completed / total,
    // Whatever the agent is on right now; failing that, whatever it will pick up next.
    current:
      items.find((item) => item.status === 'in-progress') ??
      items.find((item) => item.status === 'pending'),
    done: total > 0 && completed === total,
  }
}

/** Concatenated plain text of a message — used for copy-to-clipboard and a11y labels. */
export function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join('\n\n')
}
