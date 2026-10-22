import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AgentAvatar, AgentBadge, AgentPresence, AgentStatusDot } from './AgentIdentity'
import { Message } from '../message/Message'

describe('agent identity', () => {
  it('keeps the avatar primitive separate from status composition', () => {
    render(
      <>
        <AgentBadge name="Builder" model="code-fast" />
        <AgentAvatar name="Builder" />
        <AgentPresence name="Builder" status="speaking" />
        <AgentStatusDot status="idle" />
      </>,
    )
    expect(screen.getByText('Builder')).toBeInTheDocument()
    expect(screen.getByText('code-fast')).toBeInTheDocument()
    expect(screen.getByLabelText(/发言中|speaking/)).toBeInTheDocument()
    expect(screen.getByLabelText(/空闲|idle/)).toBeInTheDocument()
    expect(screen.getAllByText('B')[0]?.parentElement).not.toHaveAttribute('data-cc-agent-status')
  })

  it('does not add identity markup to a legacy message without agentId', () => {
    const { container } = render(
      <Message
        message={{ id: 'legacy', role: 'assistant', parts: [{ type: 'text', text: 'legacy' }] }}
        agents={[{ id: 'builder', name: 'Builder' }]}
        agentStatus="speaking"
      />,
    )
    expect(container.querySelector('[data-cc-message-agent]')).toBeNull()
    expect(container.querySelector('[data-cc-agent-badge]')).toBeNull()
    expect(container.querySelector('[data-cc-agent-status]')).toBeNull()
  })
})
