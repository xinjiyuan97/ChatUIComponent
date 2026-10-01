import type { A2UIPart as A2UIPartData, ChatMessage } from '@xinjiyuan97/chat-core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { A2UIPart } from './A2UIPart'
import { ChatThemeProvider } from '../provider/ChatThemeProvider'
import type { A2UIComponentProps } from '@xinjiyuan97/chat-a2ui'

function Action({ props, ctx }: A2UIComponentProps) {
  return (
    <button type="button" onClick={() => ctx.emit(props['onClick'])}>
      {String(props['label'] ?? 'action')}
    </button>
  )
}

describe('A2UIPart action wiring', () => {
  it('forwards the surface action through the direct callback', () => {
    const onAction = vi.fn()
    const part: A2UIPartData = {
      type: 'a2ui',
      surfaceId: 'surface-1',
      spec: { type: 'Action', props: { label: 'Confirm', onClick: { action: 'confirm' } } },
    }
    const message: ChatMessage = { id: 'assistant-1', role: 'assistant', parts: [part] }

    render(
      <ChatThemeProvider a2uiRegistry={{ Action }}>
        <A2UIPart part={part} message={message} onAction={onAction} />
      </ChatThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ surfaceId: 'surface-1', action: 'confirm' }),
      message,
    )
  })
})
