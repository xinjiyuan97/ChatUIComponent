import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { usePermissionMenu, type UsePermissionMenuOptions } from './usePermissionMenu'
import type { PermissionOption, PermissionRequest } from '../types'

const REQUEST: PermissionRequest = { id: 'p1', toolName: 'bash', detail: 'rm -rf node_modules' }

function setup(options: Partial<UsePermissionMenuOptions> = {}) {
  const onDecide = vi.fn()
  const view = renderHook(() => usePermissionMenu({ request: REQUEST, onDecide, ...options }))
  return { ...view, onDecide }
}

/** The three fields the hook actually reads off a keyboard event. */
function key(key: string, isComposing = false): KeyboardEvent {
  return {
    key,
    preventDefault: () => {},
    nativeEvent: { isComposing },
  } as unknown as KeyboardEvent
}

describe('usePermissionMenu', () => {
  it('defaults to the built-in allow / allow-always / deny options', () => {
    const { result } = setup()

    expect(result.current.options.map((option) => option.decision)).toEqual([
      'allow-once',
      'allow-always',
      'deny',
    ])
    expect(result.current.activeIndex).toBe(0)
    expect(result.current.settled).toBe(false)
  })

  it('wraps the cursor around with the arrow keys', () => {
    const { result } = setup()

    act(() => result.current.onKeyDown(key('ArrowUp')))
    expect(result.current.activeIndex).toBe(2)

    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.activeIndex).toBe(0)
  })

  it('walks past a disabled option instead of landing on it', () => {
    const options: PermissionOption[] = [
      { value: 'a', decision: 'allow-once' },
      { value: 'b', decision: 'allow-always', disabled: true },
      { value: 'c', decision: 'deny' },
    ]
    const { result } = setup({ options })

    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.activeIndex).toBe(2)
  })

  it('commits immediately on a number key', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('2')))

    expect(onDecide).toHaveBeenCalledTimes(1)
    expect(onDecide.mock.calls[0]?.[0]).toMatchObject({
      requestId: 'p1',
      decision: 'allow-always',
    })
    expect(result.current.settled).toBe(true)
  })

  it('ignores a number key past the end of the list', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('9')))

    expect(onDecide).not.toHaveBeenCalled()
    expect(result.current.activeIndex).toBe(0)
  })

  it('only moves the cursor for an option that asks for a reason', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('3')))

    // Pressing `3` opens the reason box; the denial is not sent until Enter.
    expect(onDecide).not.toHaveBeenCalled()
    expect(result.current.activeIndex).toBe(2)
    expect(result.current.promptingForReason).toBe(true)
    expect(result.current.promptSeq).toBe(1)
  })

  it('does not bump promptSeq when the deny row is merely arrowed onto', () => {
    const { result } = setup()

    act(() => result.current.onKeyDown(key('ArrowUp')))

    // Otherwise the caret drops into the textarea and swallows the next arrow key.
    expect(result.current.promptingForReason).toBe(true)
    expect(result.current.promptSeq).toBe(0)
  })

  it('sends an empty denial when no reason is typed', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('3')))
    act(() => result.current.submit())

    // "No" with no explanation is still a valid answer.
    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'deny', reason: undefined }),
    )
  })

  it('blocks submission while a required reason is empty', () => {
    const options: PermissionOption[] = [
      { value: 'no', decision: 'deny', promptForReason: true, requiresReason: true },
    ]
    const { result, onDecide } = setup({ options })

    act(() => result.current.choose(0))
    expect(result.current.needsReason).toBe(true)
    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.submit())
    expect(onDecide).not.toHaveBeenCalled()

    act(() => result.current.setReason('  改用 git clean 吧  '))
    expect(result.current.canSubmit).toBe(true)

    act(() => result.current.submit())
    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'deny', reason: '改用 git clean 吧' }),
    )
  })

  it('denies on Escape', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('Escape')))

    expect(result.current.activeIndex).toBe(2)
    expect(result.current.promptSeq).toBe(1)
    expect(onDecide).not.toHaveBeenCalled()
  })

  it('ignores Escape while an IME is composing', () => {
    const { result } = setup()

    // Escape mid-word closes the candidate window; answering the prompt for the user
    // there would be a security decision made by a keystroke they aimed elsewhere.
    act(() => result.current.onKeyDown(key('Escape', true)))

    expect(result.current.activeIndex).toBe(0)
    expect(result.current.promptSeq).toBe(0)
  })

  it('leaves Escape alone when denyOnEscape is off', () => {
    const { result } = setup({ denyOnEscape: false })

    act(() => result.current.onKeyDown(key('Escape')))

    expect(result.current.activeIndex).toBe(0)
    expect(result.current.promptSeq).toBe(0)
  })

  it('stops accepting input once it is settled', () => {
    const { result, onDecide } = setup()

    act(() => result.current.onKeyDown(key('1')))
    act(() => result.current.onKeyDown(key('2')))
    act(() => result.current.submit())

    expect(onDecide).toHaveBeenCalledTimes(1)
  })

  it('never fires twice in the render window before a controlled resolution arrives', () => {
    // Controlled mode: `settled` stays false until the host re-renders, so the guard has
    // to be the ref rather than the state.
    const { result, onDecide } = setup({ resolution: undefined })

    act(() => {
      result.current.submit()
      result.current.submit()
    })

    expect(onDecide).toHaveBeenCalledTimes(1)
  })

  it('treats a supplied resolution as settled and refuses to decide again', () => {
    const { result, onDecide } = setup({
      resolution: { requestId: 'p1', option: 'allow-once', decision: 'allow-once' },
    })

    expect(result.current.settled).toBe(true)
    expect(result.current.canSubmit).toBe(false)

    act(() => result.current.onKeyDown(key('3')))
    expect(onDecide).not.toHaveBeenCalled()
  })

  it('prefers request options over the built-ins, and an override over both', () => {
    const fromRequest: PermissionOption[] = [{ value: 'r', decision: 'allow-once' }]
    const override: PermissionOption[] = [{ value: 'o', decision: 'deny' }]

    const { result } = setup({ request: { ...REQUEST, options: fromRequest } })
    expect(result.current.options).toBe(fromRequest)

    const { result: overridden } = setup({
      request: { ...REQUEST, options: fromRequest },
      options: override,
    })
    expect(overridden.current.options).toBe(override)
  })

  it('starts the cursor on the first option that is not disabled', () => {
    const options: PermissionOption[] = [
      { value: 'a', decision: 'allow-once', disabled: true },
      { value: 'b', decision: 'deny' },
    ]
    const { result } = setup({ options })

    expect(result.current.activeIndex).toBe(1)
  })

  it('does not steal focus for a pointer-driven cursor move', () => {
    const { result } = setup()

    act(() => result.current.onKeyDown(key('ArrowDown')))
    expect(result.current.focusActive).toBe(true)

    act(() => result.current.setActiveIndex(0))
    expect(result.current.focusActive).toBe(false)
  })
})
