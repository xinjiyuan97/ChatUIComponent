'use client'

import { useMemo } from 'react'

import { getTodoProgress, type TodoItem, type TodoProgress } from '../types'

/**
 * Memoised counts for a plan.
 *
 * The arithmetic lives in `getTodoProgress` so it can be unit-tested and reused outside
 * React; this is only the `useMemo` around it — the same split as
 * `groupConversationsByAgent` / `useAgentConversations`.
 */
export function useTodoProgress(items: TodoItem[]): TodoProgress {
  return useMemo(() => getTodoProgress(items), [items])
}
