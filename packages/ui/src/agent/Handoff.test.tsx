import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HandoffContext, HandoffTrail } from './Handoff'

const part = {
  type: 'handoff' as const,
  handoffId: 'h1',
  from: { agentId: 'a', name: 'Alpha' },
  to: { agentId: 'b', name: 'Beta' },
  missing: [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
  ],
}

describe('handoff UI', () => {
  it('requires every missing item before acknowledging', () => {
    const onAcknowledge = vi.fn()
    render(<HandoffContext part={part} onAcknowledge={onAcknowledge} />)
    const button = screen.getByRole('button', { name: /确认并继续|acknowledge and continue/i })
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByLabelText('One'))
    expect(button).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Two'))
    expect(button).toBeEnabled()
  })

  it('highlights the current trail holder', () => {
    render(<HandoffTrail parts={[part]} currentAgentId="b" />)
    expect(screen.getAllByTestId('cc-agent-badge')).toHaveLength(2)
    expect(screen.getByText('Beta').closest('[data-cc-agent-node="b"]')).toHaveClass('ring-1')
  })
})
