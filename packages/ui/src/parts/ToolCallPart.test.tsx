import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ToolCallPart } from './ToolCallPart'

describe('ToolCallPart client execution', () => {
  it('labels a client tool while it waits for the host', () => {
    render(
      <ToolCallPart
        message={{ id: 'assistant', role: 'assistant', parts: [] }}
        part={{
          type: 'tool',
          toolCallId: 'client-1',
          name: 'read-file',
          state: 'awaiting-client',
          execution: 'client',
          input: { path: 'a.txt' },
        }}
      />,
    )

    expect(screen.getByText('等待宿主执行')).toBeInTheDocument()
    expect(screen.queryByText('执行中')).not.toBeInTheDocument()
  })
})
