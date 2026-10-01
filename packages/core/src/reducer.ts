import type { ChatEvent } from './events'
import type { ChatMessage, FilePart, MessagePart, ReasoningPart, TextPart, ToolPart } from './types'

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
      if (event.blockId !== undefined) {
        if (indexOfBlock(message.parts, 'text', event.blockId) !== -1) return message
        return withParts(message, [
          ...message.parts,
          { type: 'text', blockId: event.blockId, text: '' },
        ])
      }
      return withParts(message, [...message.parts, { type: 'text', text: '' }])

    case 'text-delta':
      if (event.blockId !== undefined) {
        const index = indexOfBlock(message.parts, 'text', event.blockId)
        if (index === -1) return message
        return replacePart(message, index, {
          ...(message.parts[index] as TextPart),
          text: (message.parts[index] as TextPart).text + event.delta,
        })
      }
      return appendToLast<TextPart>(
        message,
        'text',
        (part) => ({ ...part, text: part.text + event.delta }),
        () => ({ type: 'text', text: event.delta }),
      )

    case 'text-end':
      if (
        event.blockId !== undefined &&
        indexOfBlock(message.parts, 'text', event.blockId) === -1
      ) {
        return message
      }
      return message

    case 'reasoning-start':
      if (event.blockId !== undefined) {
        if (indexOfBlock(message.parts, 'reasoning', event.blockId) !== -1) return message
        return withParts(message, [
          ...message.parts,
          {
            type: 'reasoning',
            blockId: event.blockId,
            text: '',
            startedAt: now,
            ...redactedFlag(event.redacted),
          },
        ])
      }
      return withParts(message, [
        ...message.parts,
        { type: 'reasoning', text: '', startedAt: now, ...redactedFlag(event.redacted) },
      ])

    case 'reasoning-delta':
      if (event.blockId !== undefined) {
        const index = indexOfBlock(message.parts, 'reasoning', event.blockId)
        if (index === -1) return message
        const part = message.parts[index] as ReasoningPart
        return replacePart(message, index, { ...part, text: part.text + event.delta })
      }
      return appendToLast<ReasoningPart>(
        message,
        'reasoning',
        (part) => ({ ...part, text: part.text + event.delta }),
        () => ({ type: 'reasoning', text: event.delta, startedAt: now }),
      )

    case 'reasoning-end': {
      if (
        event.blockId !== undefined &&
        indexOfBlock(message.parts, 'reasoning', event.blockId) === -1
      ) {
        return message
      }
      const index =
        event.blockId === undefined
          ? lastIndexOfType(message.parts, 'reasoning')
          : indexOfBlock(message.parts, 'reasoning', event.blockId)
      if (index === -1) return message
      const part = message.parts[index] as ReasoningPart
      // Already closed — a duplicate end event must not reset the recorded duration.
      if (part.durationMs !== undefined) return message
      return replacePart(message, index, {
        ...part,
        // Only ever sets the flag. A start event that already declared the block redacted
        // must survive an end event that says nothing about it.
        ...redactedFlag(event.redacted),
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
          ...(event.execution === 'client' ? { execution: 'client' as const } : {}),
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
        state: part.execution === 'client' ? 'awaiting-client' : 'input-available',
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

    case 'file': {
      const { type: _type, ...fields } = event
      // `mediaType` last: it is the one required field, and letting the widened spread
      // land on top of it would make it optional again.
      const next: FilePart = { ...stripUndefined(fields), type: 'file', mediaType: event.mediaType }

      const index =
        event.id === undefined
          ? -1
          : message.parts.findIndex((p) => p.type === 'file' && p.id === event.id)
      if (index === -1) return withParts(message, [...message.parts, next])

      // Merged, not overwritten: the completion event usually carries only `{id, url,
      // status}`, and the dimensions declared by the placeholder are exactly what keeps
      // the box from collapsing between the two events.
      const previous = message.parts[index] as FilePart
      return replacePart(message, index, { ...previous, ...next })
    }

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
      // `awaiting-permission` is intentionally represented as complete for now because
      // MessageStatus has no waiting value. Its metadata remains authoritative: this is
      // not a final turn, and the server continues it in a new run on the same turn.
      return {
        ...message,
        status: statusForFinishReason(event.finishReason),
        parts: closeDanglingParts(
          message.parts,
          now,
          closeReasonForFinishReason(event.finishReason),
        ),
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
          ...closeDanglingParts(message.parts, now, 'error'),
          {
            type: 'error',
            message: event.error,
            retryable: event.retryable ?? true,
            ...stripUndefined({
              scope: event.scope,
              code: event.code,
              retryAfterMs: event.retryAfterMs,
            }),
          },
        ],
      }

    case 'server-hello':
      return message

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

/** `{ redacted: true }` or nothing — never `{ redacted: false }`, which would clear it. */
function redactedFlag(redacted: boolean | undefined): { redacted?: true } {
  return redacted ? { redacted: true } : {}
}

/**
 * Drops keys whose value is `undefined`.
 *
 * Spreading an event straight onto an existing part would let its absent optional fields
 * overwrite real ones with `undefined` — a completion event that omits `width` must not
 * erase the width the placeholder declared.
 */
function stripUndefined<T extends object>(source: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) result[key] = value
  }
  return result as Partial<T>
}

function lastIndexOfType(parts: MessagePart[], type: MessagePart['type']): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]?.type === type) return i
  }
  return -1
}

function indexOfBlock(parts: MessagePart[], type: 'text' | 'reasoning', blockId: string): number {
  return parts.findIndex((part) => part.type === type && part.blockId === blockId)
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
export type StreamEndReason = 'normal' | 'cancelled' | 'error'

export function closeDanglingParts(
  parts: MessagePart[],
  now: number,
  reason: StreamEndReason = 'error',
): MessagePart[] {
  return parts.map((part) => {
    if (part.type === 'reasoning' && part.durationMs === undefined && part.startedAt) {
      return {
        ...part,
        durationMs: now - part.startedAt,
        ...(reason === 'cancelled' ? { cancelled: true as const } : {}),
      }
    }
    if (part.type === 'file' && part.status === 'generating') {
      if (reason === 'cancelled') return { ...part, status: 'cancelled', cancelled: true }
      // Same reasoning as the tool rule below: a placeholder that shimmers forever is a
      // bug the user has to guess at, not a state.
      return {
        ...part,
        status: 'error' as const,
        error: part.error ?? 'Stream ended before the file was generated',
      }
    }
    if (part.type === 'tool' && (part.state === 'input-streaming' || part.state === 'executing')) {
      if (reason === 'cancelled') {
        return { ...part, ...finaliseToolInput(part), state: 'cancelled', cancelled: true }
      }
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

function statusForFinishReason(finishReason: string | undefined): ChatMessage['status'] {
  if (finishReason === 'cancelled') return 'aborted'
  if (finishReason === 'error') return 'error'
  return 'complete'
}

function closeReasonForFinishReason(finishReason: string | undefined): StreamEndReason {
  if (finishReason === 'cancelled') return 'cancelled'
  if (finishReason === 'error') return 'error'
  return 'normal'
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
