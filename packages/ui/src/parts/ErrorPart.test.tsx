import { applyEvent } from '@xinjiyuan97/chat-core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorPart } from './ErrorPart'

describe('ErrorPart retry entry', () => {
  it('hides retry for an explicitly non-retryable part', () => {
    render(<ErrorPart part={{ type: 'error', message: 'x', retryable: false }} onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('x')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([true, undefined])('keeps retry working when retryable is %s', (retryable) => {
    const onRetry = vi.fn()
    render(<ErrorPart part={{ type: 'error', message: 'x', retryable }} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry after reducing a non-retryable server error', () => {
    const event = { type: 'error' as const, error: 'Unauthorized', retryable: false }
    const message = applyEvent({ id: 'assistant', role: 'assistant', parts: [] }, event)
    const part = message.parts[0]
    if (part?.type !== 'error') throw new Error('Expected error part')
    render(<ErrorPart part={part} onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Unauthorized')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
