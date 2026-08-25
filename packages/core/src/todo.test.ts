import { describe, expect, it } from 'vitest'

import { getTodoProgress, type TodoItem } from './types'

function items(...statuses: TodoItem['status'][]): TodoItem[] {
  return statuses.map((status, index) => ({ id: `${index}`, title: `第 ${index} 步`, status }))
}

describe('getTodoProgress', () => {
  it('counts each status', () => {
    const progress = getTodoProgress(items('completed', 'in-progress', 'pending', 'cancelled'))

    expect(progress).toMatchObject({
      completed: 1,
      inProgress: 1,
      pending: 1,
      cancelled: 1,
    })
  })

  it('leaves cancelled items out of the denominator', () => {
    const progress = getTodoProgress(items('completed', 'completed', 'cancelled'))

    // A plan whose last step was dropped is finished; a bar stuck at 2/3 forever reads
    // as a stalled task.
    expect(progress.total).toBe(2)
    expect(progress.ratio).toBe(1)
    expect(progress.done).toBe(true)
  })

  it('prefers the running item as the current one', () => {
    const progress = getTodoProgress(items('completed', 'pending', 'in-progress'))
    expect(progress.current?.status).toBe('in-progress')
  })

  it('falls back to the first pending item when nothing is running', () => {
    const progress = getTodoProgress(items('completed', 'pending', 'pending'))
    expect(progress.current?.id).toBe('1')
  })

  it('has no current item once everything is done', () => {
    const progress = getTodoProgress(items('completed', 'completed'))
    expect(progress.current).toBeUndefined()
  })

  it('does not divide by zero on an empty list', () => {
    const progress = getTodoProgress([])

    expect(progress.ratio).toBe(0)
    // Not "done": an empty plan has not been completed, it just has not started.
    expect(progress.done).toBe(false)
  })

  it('is not done when every item was cancelled', () => {
    const progress = getTodoProgress(items('cancelled', 'cancelled'))

    expect(progress.total).toBe(0)
    expect(progress.done).toBe(false)
  })
})
