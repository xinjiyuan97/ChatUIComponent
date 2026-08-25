import type { ChatEvent } from './events'
import type { ChatMessage, MessagePart, ReasoningPart, TextPart, ToolPart } from './types'

/**
 * Applies one normalised event to the in-flight assistant message.
 *
 * Returns a new message object (never mutates), because React consumers rely on
 * reference identity to decide what to re-render. Only the parts that actually changed
 * get new references, so memoised part renderers stay stable.
 */
export function applyEvent(
  message: ChatMessage,
  event: ChatEvent,
  now: number = Date.now(),
): ChatMessage {
  switch (event.type) {
    case 'message-start':
      return { ...message, id: event.id ?? message.id, status: 'streaming' }

    case 'text-start':
      // Explicitly opens a new block even if the previous part was also text.
      return withParts(message, [...message.parts, { type: 'text', text: '' }])

    case 'text-delta':
      return appendToLast<TextPart>(
        message,
        'text',
        (part) => ({ ...part, text: part.text + event.delta }),
        () => ({ type: 'text', text: event.delta }),
      )

    case 'text-end':
      return message

    case 'reasoning-start':
      return withParts(message, [...message.parts, { type: 'reasoning', text: '', startedAt: now }])

    case 'reasoning-delta':
      return appendToLast<ReasoningPart>(
        message,
        'reasoning',
        (part) => ({ ...part, text: part.text + event.delta }),
        () => ({ type: 'reasoning', text: event.delta, startedAt: now }),
      )

    case 'reasoning-end': {
      const index = lastIndexOfType(message.parts, 'reasoning')
      if (index === -1) return message
      const part = message.parts[index] as ReasoningPart
      // Already closed — a duplicate end event must not reset the recorded duration.
      if (part.durationMs !== undefined) return message
      return replacePart(message, index, {
        ...part,
        durationMs: part.startedAt !== undefined ? now - part.startedAt : undefined,
      })
    }

    case 'tool-input-start':
      return withParts(message, [
        ...message.parts,
        {
          type: 'tool',
          toolCallId: event.toolCallId,
          name: event.name,
          state: 'input-streaming',
          inputText: '',
          startedAt: now,
        },
      ])

    case 'tool-input-delta':
      return updateTool(message, event.toolCallId, now, (part) => ({
        ...part,
        state: 'input-streaming',
        inputText: (part.inputText ?? '') + event.delta,
      }))

    case 'tool-input-available':
      return updateTool(message, event.toolCallId, now, (part) => ({
        ...part,
        state: 'input-available',
        input: event.input,
      }))

    case 'tool-executing':
      return updateTool(message, event.toolCallId, now, (part) => ({
        ...part,
        // Arguments are implicitly final once execution starts.
        ...finaliseToolInput(part),
        state: 'executing',
      }))

    case 'tool-output':
      return updateTool(message, event.toolCallId, now, (part) => ({
        ...part,
        ...finaliseToolInput(part),
        state: 'output-available',
        output: event.output,
        durationMs: part.startedAt !== undefined ? now - part.startedAt : undefined,
      }))

    case 'tool-error':
      return updateTool(message, event.toolCallId, now, (part) => ({
        ...part,
        ...finaliseToolInput(part),
        state: 'output-error',
        error: event.error,
        durationMs: part.startedAt !== undefined ? now - part.startedAt : undefined,
      }))

    case 'a2ui': {
      const index = message.parts.findIndex(
        (p) => p.type === 'a2ui' && p.surfaceId === event.surfaceId,
      )
      const next = {
        type: 'a2ui' as const,
        surfaceId: event.surfaceId,
        spec: event.spec,
        data: event.data,
      }
      // Re-emitting the same surface replaces it in place, which is how a transport
      // streams a progressively-parsed spec without the card jumping to the bottom.
      return index === -1
        ? withParts(message, [...message.parts, next])
        : replacePart(message, index, next)
    }

    case 'a2ui-patch': {
      const index = message.parts.findIndex(
        (p) => p.type === 'a2ui' && p.surfaceId === event.surfaceId,
      )
      if (index === -1) return message
      const part = message.parts[index]
      if (part?.type !== 'a2ui') return message
      const { op, path, value } = event.patch

      if (op === 'replace' && path === undefined) {
        return replacePart(message, index, { ...part, spec: value as never })
      }
      const data = { ...(part.data ?? {}) }
      if (path === undefined) {
        return replacePart(message, index, {
          ...part,
          data: op === 'merge' ? { ...data, ...(value as object) } : (value as never),
        })
      }
      return replacePart(message, index, { ...part, data: setPath(data, path, value, op) })
    }

    case 'permission-request': {
      const index = message.parts.findIndex(
        (p) => p.type === 'permission' && p.request.id === event.request.id,
      )
      const next = { type: 'permission' as const, request: event.request }
      // A re-sent request updates the card in place. Stacking two menus for the same
      // action would leave one of them unanswerable.
      return index === -1
        ? withParts(message, [...message.parts, next])
        : replacePart(message, index, next)
    }

    case 'permission-resolved': {
      const index = message.parts.findIndex(
        (p) => p.type === 'permission' && p.request.id === event.requestId,
      )
      if (index === -1) return message
      const part = message.parts[index]
      if (part?.type !== 'permission') return message
      return replacePart(message, index, { ...part, resolution: event.resolution })
    }

    case 'todo': {
      const todoId = event.todoId ?? 'default'
      const index = message.parts.findIndex((p) => p.type === 'todo' && p.todoId === todoId)
      const next = { type: 'todo' as const, todoId, items: event.items, title: event.title }
      // Same in-place replacement as `a2ui`: an agent revises its plan many times per run,
      // and appending each revision would bury the conversation under checklists.
      return index === -1
        ? withParts(message, [...message.parts, next])
        : replacePart(message, index, next)
    }

    case 'file':
      return withParts(message, [
        ...message.parts,
        { type: 'file', url: event.url, mediaType: event.mediaType, name: event.name },
      ])

    case 'source':
      return withParts(message, [
        ...message.parts,
        { type: 'source', url: event.url, title: event.title, snippet: event.snippet },
      ])

    case 'custom':
      return withParts(message, [
        ...message.parts,
        { type: 'custom', name: event.name, data: event.data },
      ])

    case 'message-end':
      return {
        ...message,
        status: 'complete',
        parts: closeDanglingParts(message.parts, now),
        metadata: {
          ...message.metadata,
          ...(event.finishReason ? { finishReason: event.finishReason } : {}),
          ...(event.usage ? { usage: event.usage } : {}),
        },
      }

    case 'error':
      return {
        ...message,
        status: 'error',
        parts: [
          ...closeDanglingParts(message.parts, now),
          { type: 'error', message: event.error, retryable: true },
        ],
      }

    default: {
      // Unknown event types are ignored rather than thrown, so a newer server can add
      // events without breaking an older client.
      const _exhaustive: never = event
      void _exhaustive
      return message
    }
  }
}

/** Convenience for replaying a whole stream, mainly used in tests and fixtures. */
export function applyEvents(
  message: ChatMessage,
  events: ChatEvent[],
  now: number = Date.now(),
): ChatMessage {
  return events.reduce((acc, event) => applyEvent(acc, event, now), message)
}

/* ------------------------------------------------------------------ internals */

function withParts(message: ChatMessage, parts: MessagePart[]): ChatMessage {
  return { ...message, parts }
}

function replacePart(message: ChatMessage, index: number, part: MessagePart): ChatMessage {
  const parts = message.parts.slice()
  parts[index] = part
  return withParts(message, parts)
}

function lastIndexOfType(parts: MessagePart[], type: MessagePart['type']): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.type === type) return i
  }
  return -1
}

/**
 * Appends to the trailing part when it is of the expected type, otherwise starts a new
 * one. Checking only the *last* part (rather than the last of that type) is what makes
 * interleaving work: text after a tool call correctly becomes a second text block.
 */
function appendToLast<T extends MessagePart>(
  message: ChatMessage,
  type: T['type'],
  update: (part: T) => T,
  create: () => T,
): ChatMessage {
  const index = message.parts.length - 1
  const last = message.parts[index]
  if (last?.type === type) {
    return replacePart(message, index, update(last as T))
  }
  return withParts(message, [...message.parts, create()])
}

function updateTool(
  message: ChatMessage,
  toolCallId: string,
  now: number,
  update: (part: ToolPart) => ToolPart,
): ChatMessage {
  const index = message.parts.findIndex((p) => p.type === 'tool' && p.toolCallId === toolCallId)
  if (index === -1) {
    // Output for a call we never saw start — synthesise a placeholder rather than drop it.
    const placeholder: ToolPart = {
      type: 'tool',
      toolCallId,
      name: 'unknown',
      state: 'input-available',
      startedAt: now,
    }
    return withParts(message, [...message.parts, update(placeholder)])
  }
  return replacePart(message, index, update(message.parts[index] as ToolPart))
}

/**
 * Turns accumulated argument text into a parsed object. Invalid JSON is left as
 * `inputText` so the UI can still show the raw arguments instead of an empty panel —
 * truncated tool arguments are common when a stream is aborted mid-call.
 */
function finaliseToolInput(part: ToolPart): Partial<ToolPart> {
  if (part.input !== undefined) return {}
  const text = part.inputText?.trim()
  if (!text) return {}
  try {
    return { input: JSON.parse(text) }
  } catch {
    return {}
  }
}

/**
 * On stream end, close any reasoning block that never got an explicit end event.
 *
 * An undecided permission request is deliberately left alone. A stream that ends with a
 * menu still on screen is the *normal* shape of an approval turn — the agent stopped
 * precisely because it is waiting for an answer — and auto-denying it here would be the
 * renderer making a security decision that belongs to the host.
 */
function closeDanglingParts(parts: MessagePart[], now: number): MessagePart[] {
  return parts.map((part) => {
    if (part.type === 'reasoning' && part.durationMs === undefined && part.startedAt) {
      return { ...part, durationMs: now - part.startedAt }
    }
    if (part.type === 'tool' && (part.state === 'input-streaming' || part.state === 'executing')) {
      // The stream ended without a result: surface it as an error rather than an
      // eternally-spinning row.
      return {
        ...part,
        ...finaliseToolInput(part),
        state: 'output-error' as const,
        error: part.error ?? 'Stream ended before the tool returned a result',
      }
    }
    return part
  })
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
  op: 'replace' | 'merge' | 'append',
): Record<string, unknown> {
  const keys = path.split('.').filter(Boolean)
  if (keys.length === 0) return target
  const root = { ...target }
  let cursor: Record<string, unknown> = root

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return target
    const next = cursor[key]
    const copy = isPlainObject(next) ? { ...next } : {}
    cursor[key] = copy
    cursor = copy
  }

  const leaf = keys[keys.length - 1] as string
  if (leaf === '__proto__' || leaf === 'constructor' || leaf === 'prototype') return target

  const existing = cursor[leaf]
  if (op === 'merge' && isPlainObject(existing) && isPlainObject(value)) {
    cursor[leaf] = { ...existing, ...value }
  } else if (op === 'append') {
    cursor[leaf] = Array.isArray(existing) ? [...existing, value] : [value]
  } else {
    cursor[leaf] = value
  }
  return root
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
