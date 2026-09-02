import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { usePromptQueue, type QueuedPrompt, type UsePromptQueueOptions } from './usePromptQueue'

/** A controllable stand-in for a turn: resolve it when the "stream" should finish. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(options: Partial<UsePromptQueueOptions> = {}) {
  // `busy` is pulled out and driven by `rerender` — leaving it in the spread would
  // re-apply the initial value on every render and pin the hook to it.
  const { busy: initialBusy = true, ...rest } = options
  const onSend = vi.fn<(item: QueuedPrompt) => void | Promise<void>>()
  const view = renderHook(
    (props: { busy: boolean }) => usePromptQueue({ onSend, ...rest, busy: props.busy }),
    { initialProps: { busy: initialBusy } },
  )
  return { ...view, onSend }
}

describe('usePromptQueue', () => {
  it('queues text while the agent is busy', () => {
    const { result } = setup({ busy: true })

    act(() => {
      result.current.enqueue('first')
      result.current.enqueue('second')
    })

    expect(result.current.items.map((item) => item.text)).toEqual(['first', 'second'])
    expect(result.current.size).toBe(2)
  })

  it('ignores an empty prompt with no parts', () => {
    const { result } = setup({ busy: true })

    act(() => {
      result.current.enqueue('   ')
    })

    expect(result.current.items).toEqual([])
  })

  it('keeps a prompt that has parts but no text', () => {
    const { result } = setup({ busy: true })

    act(() => {
      result.current.enqueue('', { parts: [{ type: 'file', url: 'x', mediaType: 'image/png' }] })
    })

    expect(result.current.items).toHaveLength(1)
  })

  it('removes and rewrites queued prompts', () => {
    const { result } = setup({ busy: true })

    act(() => {
      result.current.enqueue('first')
      result.current.enqueue('second')
    })
    const [first] = result.current.items

    act(() => result.current.update(first!.id, '  first, edited  '))
    expect(result.current.items[0]?.text).toBe('first, edited')

    act(() => result.current.remove(first!.id))
    expect(result.current.items.map((item) => item.text)).toEqual(['second'])
  })

  it('drops an item edited down to nothing', () => {
    const { result } = setup({ busy: true })
    act(() => result.current.enqueue('first'))

    act(() => result.current.update(result.current.items[0]!.id, '   '))
    expect(result.current.items).toEqual([])
  })

  it('sends one prompt at a time, in order, waiting for each to finish', async () => {
    const turns = [deferred(), deferred()]
    let index = 0
    const { result, rerender, onSend } = setup({ busy: true })
    onSend.mockImplementation(() => turns[index++]!.promise)

    act(() => {
      result.current.enqueue('first')
      result.current.enqueue('second')
    })

    // Still busy: nothing should leave the queue.
    expect(onSend).not.toHaveBeenCalled()

    rerender({ busy: false })
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    expect(onSend.mock.calls[0]![0].text).toBe('first')
    // The second must wait for the first turn to actually finish, not merely to start.
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(result.current.items.map((item) => item.text)).toEqual(['second'])

    await act(async () => {
      turns[0]!.resolve()
      await turns[0]!.promise
    })

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2))
    expect(onSend.mock.calls[1]![0].text).toBe('second')
    await waitFor(() => expect(result.current.items).toEqual([]))
  })

  it('keeps draining after a turn rejects', async () => {
    const failing = deferred()
    const { result, rerender, onSend } = setup({ busy: true })
    onSend.mockImplementationOnce(() => failing.promise).mockImplementationOnce(() => undefined)

    act(() => {
      result.current.enqueue('boom')
      result.current.enqueue('after')
    })
    rerender({ busy: false })

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1))
    await act(async () => {
      failing.reject(new Error('transport exploded'))
      await failing.promise.catch(() => {})
    })

    // A failed turn is the host's to surface; the queue must not wedge on it.
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2))
    expect(onSend.mock.calls[1]![0].text).toBe('after')
  })

  it('drains a synchronous onSend that never flips busy', async () => {
    const { result, rerender, onSend } = setup({ busy: true })
    onSend.mockImplementation(() => undefined)

    act(() => {
      result.current.enqueue('a')
      result.current.enqueue('b')
      result.current.enqueue('c')
    })
    rerender({ busy: false })

    // The internal tick, not a `busy` transition, is what keeps this moving.
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(3))
    expect(onSend.mock.calls.map((call) => call[0].text)).toEqual(['a', 'b', 'c'])
    expect(result.current.items).toEqual([])
  })

  it('never auto-sends when autoDrain is off', async () => {
    const { result, rerender, onSend } = setup({ busy: true, autoDrain: false })

    act(() => result.current.enqueue('held'))
    rerender({ busy: false })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onSend).not.toHaveBeenCalled()
    expect(result.current.items).toHaveLength(1)
  })

  it('holds the queue instead of discarding it, and resumes on demand', async () => {
    const { result, rerender, onSend } = setup({ busy: true })
    onSend.mockImplementation(() => undefined)

    act(() => {
      result.current.enqueue('a')
      result.current.enqueue('b')
    })

    // What pressing stop does: the turn ends, but nothing else may go out.
    act(() => result.current.hold())
    rerender({ busy: false })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onSend).not.toHaveBeenCalled()
    expect(result.current.held).toBe(true)
    // Held is not discarded — the user's words are still there.
    expect(result.current.items).toHaveLength(2)

    act(() => result.current.resume())
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2))
    expect(result.current.held).toBe(false)
  })

  it('clears the queue', () => {
    const { result } = setup({ busy: true })
    act(() => {
      result.current.enqueue('a')
      result.current.enqueue('b')
    })

    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
  })
})
