import type { PermissionPart as PermissionPartData } from '@xinjiyuan97/chat-core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PermissionPart } from './PermissionPart'

describe('PermissionPart decision wiring', () => {
  it('forwards the selected decision through the direct callback', () => {
    const onDecide = vi.fn()
    const part: PermissionPartData = {
      type: 'permission',
      request: { id: 'permission-1', toolName: 'bash' },
    }

    render(
      <PermissionPart
        part={part}
        message={{ id: 'assistant-1', role: 'assistant', parts: [part] }}
        onDecide={onDecide}
      />,
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /允许这一次/ }))

    expect(onDecide).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'permission-1',
        decision: 'allow-once',
      }),
      expect.objectContaining({ id: 'assistant-1' }),
    )
  })
})
