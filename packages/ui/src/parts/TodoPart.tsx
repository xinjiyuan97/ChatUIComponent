'use client'

import type { TodoPart as TodoPartData } from '@xinjiyuan97/chat-core'

import { TodoList } from '../todo/TodoList'

export type TodoPartProps = {
  part: TodoPartData
  className?: string
}

/**
 * The agent's plan as a message part.
 *
 * Read-only here by design: a plan that arrived over the wire is a report of what the
 * agent intends to do, and letting the reader tick a box would only desynchronise the
 * display from the agent's own state. Hosts that do want to hand editing back to the user
 * can render `TodoList` directly with an `onToggle`.
 */
export function TodoPart({ part, className }: TodoPartProps) {
  return <TodoList items={part.items} title={part.title} className={className} />
}
