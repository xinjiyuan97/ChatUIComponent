import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  TaskActions,
  TaskArtifacts,
  TaskCardHeader,
  TaskDependencies,
  TaskOwner,
  TaskStatusIndicator,
} from './TaskBoard'

const item = {
  id: 'task-1',
  title: 'Build the release',
  status: 'in-progress' as const,
  owner: { agentId: 'builder', name: 'Builder', model: 'code-fast' },
  deps: ['research'],
  artifacts: [{ id: 'patch', label: 'release.patch' }],
}

describe('TaskCard subcomponents', () => {
  it('renders each extracted piece independently', () => {
    render(
      <>
        <TaskStatusIndicator item={item} />
        <TaskCardHeader item={item} />
        <TaskOwner item={item} />
        <TaskDependencies item={item} />
        <TaskArtifacts item={item} />
        <TaskActions item={item} />
      </>,
    )
    expect(screen.getByText('Build the release')).toBeInTheDocument()
    expect(screen.getAllByText('Builder')).toHaveLength(2)
    expect(screen.getAllByText('research')).toHaveLength(2)
    expect(screen.getAllByText('release.patch')).toHaveLength(2)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
