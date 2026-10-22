import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TaskTrajectory, type TaskTrajectoryStep } from './TaskTrajectory'

const item = { id: 'task-1', title: 'Build the release', status: 'completed' as const }
const steps: TaskTrajectoryStep[] = [
  { id: 'one', kind: 'created', title: 'Created' },
  { id: 'two', kind: 'handoff', title: 'Handed to Builder', agentId: 'builder' },
  { id: 'three', kind: 'completed', title: 'Completed' },
]

describe('TaskTrajectory', () => {
  it('keeps input order and highlights the current step', () => {
    render(<TaskTrajectory item={item} steps={steps} currentStepId="two" />)
    const renderedSteps = screen.getAllByRole('listitem')
    expect(renderedSteps.map((step) => step.getAttribute('data-cc-task-trajectory-step'))).toEqual([
      'one',
      'two',
      'three',
    ])
    expect(renderedSteps[1]).toHaveAttribute('aria-current', 'step')
    expect(renderedSteps[0]).not.toHaveAttribute('aria-current')
  })

  it('does not render interactive controls without callbacks', () => {
    render(
      <TaskTrajectory
        item={item}
        steps={[
          { id: 'blocked', kind: 'blocked', title: 'Needs approval', detail: 'Approval gate' },
        ]}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Approval gate')).toBeInTheDocument()
  })
})
