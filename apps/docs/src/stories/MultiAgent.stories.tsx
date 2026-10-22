import type { Meta, StoryObj } from '@storybook/react'
import { expect, userEvent, within } from '@storybook/test'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  createChatStore,
  createMockTransport,
  type ChatEvent,
  type ChatMessage,
  type TodoItem,
  type HandoffPart,
} from '@xinjiyuan97/chat-core'
import {
  ChatThemeProvider,
  HandoffContext,
  HandoffTrail,
  Message,
  TaskBoard,
  TaskCard,
  TaskArtifacts,
  TaskDependencies,
  TaskOwner,
  TaskStatusIndicator,
  TaskGraph,
  TaskTrajectory,
  AgentAvatar,
  AgentPresence,
  AgentStatusDot,
} from '@xinjiyuan97/chat-ui'

const meta = { title: 'Multi-Agent/Phase A', parameters: { layout: 'padded' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const agents = [
  { id: 'planner', name: 'Planner', metadata: { model: 'reasoning-pro' } },
  { id: 'builder', name: 'Builder', metadata: { model: 'code-fast' } },
]

const identityMessages: ChatMessage[] = [
  {
    id: 'planner-message',
    role: 'assistant',
    agentId: 'planner',
    parts: [{ type: 'text', text: 'I mapped the work.' }],
  },
  {
    id: 'builder-message',
    role: 'assistant',
    agentId: 'builder',
    parts: [{ type: 'text', text: 'I am implementing the task.' }],
  },
  {
    id: 'legacy-message',
    role: 'assistant',
    parts: [{ type: 'text', text: 'This legacy message has no agent identity.' }],
  },
]

function MockDriven({ children, script = [] }: { children: ReactNode; script?: ChatEvent[] }) {
  const [store] = useState(() =>
    createChatStore({
      transport: createMockTransport(() => script.map((event) => ({ event })), { speed: 0 }),
    }),
  )
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  useEffect(() => {
    if (script.length > 0) void store.getState().send('storybook fixture')
  }, [store])
  return (
    <ChatThemeProvider locale="en-US">
      <div data-cc-mock-status={state.status}>{children}</div>
    </ChatThemeProvider>
  )
}

export const Identity: Story = {
  name: 'Identity: two agents and legacy fallback',
  render: () => (
    <MockDriven
      script={[
        { type: 'message-start', agentId: 'planner' },
        { type: 'text-delta', delta: 'fixture', agentId: 'planner' },
        { type: 'message-end', finishReason: 'stop' },
      ]}
    >
      <div className="space-y-5">
        {identityMessages.map((message) => (
          <Message key={message.id} message={message} agents={agents} agentStatus="speaking" />
        ))}
      </div>
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByTestId('cc-agent-badge')).toHaveLength(2)
    await expect(canvas.getByText('reasoning-pro')).toBeVisible()
    await expect(canvas.getByText('code-fast')).toBeVisible()
    await expect(
      canvas
        .getByText('This legacy message has no agent identity.')
        .closest('[data-cc-message-agent]'),
    ).toBeNull()
  },
}

export const AgentPiecesComposed: Story = {
  name: 'Agent pieces: composed',
  render: () => (
    <MockDriven>
      <div className="flex items-center gap-5">
        <AgentAvatar name="Base" />
        <AgentPresence name="Composed" status="speaking" />
        <div className="flex gap-2">
          {(['idle', 'thinking', 'speaking', 'waiting', 'blocked', 'done', 'error'] as const).map(
            (status) => (
              <AgentStatusDot key={status} status={status} />
            ),
          )}
        </div>
      </div>
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('B', { selector: '[aria-hidden="true"]' })).not.toHaveAttribute(
      'data-cc-agent-status',
    )
    const composedAvatar = canvas
      .getByText('C', { selector: '[aria-hidden="true"]' })
      .closest('[data-cc-agent-avatar]') as HTMLElement | null
    if (!composedAvatar) throw new Error('Composed agent avatar was not rendered')
    await expect(within(composedAvatar).getByLabelText('speaking')).toBeVisible()
  },
}

const taskItems: TodoItem[] = [
  {
    id: 'research',
    title: 'Research API constraints',
    status: 'completed',
    description:
      'Map the authentication, streaming, and retry constraints before implementation begins.',
    labels: ['research', 'ready'],
    owner: { agentId: 'planner', name: 'Planner', model: 'reasoning-pro' },
  },
  {
    id: 'implementation',
    title: 'Implement the gateway',
    status: 'in-progress',
    description:
      'Build the gateway path with streaming support and preserve request metadata across retries.',
    labels: ['implementation', 'high-priority'],
    owner: { agentId: 'builder', name: 'Builder', model: 'code-fast' },
    deps: ['research'],
    attempt: 2,
    artifacts: [{ id: 'patch', label: 'gateway.patch', kind: 'diff' }],
  },
  {
    id: 'review',
    title: 'Human review',
    status: 'blocked',
    description:
      'Confirm the production release window and deployment approval before shipping the gateway.',
    labels: ['blocked', 'needs-review'],
    owner: { agentId: 'builder', name: 'Builder' },
    note: 'Waiting for approval.',
  },
  {
    id: 'failed',
    title: 'Old approach',
    status: 'failed',
    description:
      'The first transport approach was abandoned after its retry semantics failed review.',
    labels: ['failed'],
  },
]

export const TaskBoardStates: Story = {
  name: 'Task board: status and owner grouping',
  render: () => (
    <MockDriven
      script={[
        { type: 'message-start', agentId: 'planner' },
        { type: 'message-end', finishReason: 'stop' },
      ]}
    >
      <TaskBoard items={taskItems} layout="stack" />
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Human review')).toBeVisible()
    await expect(canvas.getByText('gateway.patch')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Owner' }))
    const implementationCard = canvasElement.querySelector<HTMLElement>(
      '[data-cc-task-id="implementation"]',
    )
    if (!implementationCard) throw new Error('Implementation task card was not rendered')
    await expect(within(implementationCard).getByText('Builder')).toBeVisible()
    await expect(canvas.queryByRole('button', { name: 'Reassign' })).toBeNull()
  },
}

export const TaskBoardColumns: Story = {
  name: 'Task board: columns',
  render: () => (
    <MockDriven>
      <TaskBoard items={taskItems} layout="columns" onDescriptionExpandedChange={() => undefined} />
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const completedColumn = canvasElement.querySelector<HTMLElement>(
      '[data-cc-task-group="completed"]',
    )
    if (!completedColumn) throw new Error('Completed task column was not rendered')
    await expect(within(completedColumn).getAllByTestId('cc-agent-badge')).toHaveLength(1)
    await expect(canvas.getByText('Human review')).toBeVisible()
    await expect(
      within(completedColumn).getByRole('button', { name: 'Expand description' }),
    ).toBeVisible()
    const blockedColumn = canvasElement.querySelector<HTMLElement>('[data-cc-task-group="blocked"]')
    if (!blockedColumn) throw new Error('Blocked task column was not rendered')
    await expect(within(blockedColumn).getByRole('heading', { name: /Blocked/ })).toBeVisible()
  },
}

const trajectoryItem: TodoItem = {
  id: 'gateway-release',
  title: 'Ship gateway release',
  status: 'completed',
  owner: { agentId: 'builder', name: 'Builder', model: 'code-fast' },
}

const trajectorySteps = [
  { id: 'created', at: '2026-10-02T09:00:00Z', kind: 'created' as const, title: 'Task created' },
  {
    id: 'assigned',
    at: '2026-10-02T09:01:00Z',
    kind: 'assigned' as const,
    title: 'Planner assigned the task to Builder',
    agentId: 'planner',
  },
  {
    id: 'handoff',
    at: '2026-10-02T09:08:00Z',
    kind: 'handoff' as const,
    title: 'Implementation handed to Builder',
    detail: 'The API map and release checklist were carried across.',
    agentId: 'planner',
  },
  {
    id: 'blocked',
    at: '2026-10-02T09:20:00Z',
    kind: 'blocked' as const,
    title: 'High-risk deployment tool awaiting approval',
    detail: 'The deploy tool requested approval before touching production.',
    agentId: 'builder',
  },
  {
    id: 'retry',
    at: '2026-10-02T09:31:00Z',
    kind: 'retry' as const,
    title: 'Retry after approval',
    agentId: 'builder',
  },
  {
    id: 'completed',
    at: '2026-10-02T09:40:00Z',
    kind: 'completed' as const,
    title: 'Release completed',
    detail: 'Gateway is live and the smoke test passed.',
    agentId: 'builder',
  },
]

export const TaskTrajectoryStory: Story = {
  name: 'Task trajectory: handoff, blocked tool, retry, complete',
  render: () => (
    <MockDriven>
      <TaskTrajectory item={trajectoryItem} steps={trajectorySteps} agents={agents} />
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trajectory = canvasElement.querySelector<HTMLElement>('[data-cc-task-trajectory]')
    if (!trajectory) throw new Error('Task trajectory was not rendered')
    await expect(within(trajectory).getAllByRole('listitem')).toHaveLength(6)
    await expect(
      within(trajectory).getByText('High-risk deployment tool awaiting approval'),
    ).toBeVisible()
    const completedStep = trajectory.querySelector<HTMLElement>(
      '[data-cc-task-trajectory-step="completed"]',
    )
    if (!completedStep) throw new Error('Completed trajectory step was not rendered')
    await expect(completedStep).toHaveAttribute('aria-current', 'step')
    await expect(canvas.queryByRole('button', { name: 'Retry this step' })).toBeNull()
  },
}

export const TaskCardComposition: Story = {
  name: 'Task card: independently composed pieces',
  render: () => (
    <MockDriven>
      <TaskCard item={{ ...trajectoryItem, owner: undefined }}>
        <TaskStatusIndicator item={trajectoryItem} />
        <TaskOwner item={trajectoryItem} />
        <TaskDependencies item={{ ...trajectoryItem, deps: ['design'] }} />
        <TaskArtifacts
          item={{ ...trajectoryItem, artifacts: [{ id: 'release', label: 'release.tar' }] }}
        />
      </TaskCard>
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-cc-task-id="gateway-release"]')
    if (!card) throw new Error('Task card was not rendered')
    await expect(within(card).getByText('Builder')).toBeVisible()
    await expect(within(card).getByText('release.tar')).toBeVisible()
  },
}

const graphItems: TodoItem[] = [
  {
    id: 'graph-start',
    title: 'Collect requirements',
    status: 'completed',
    owner: { agentId: 'planner' },
  },
  {
    id: 'graph-api',
    title: 'Map API constraints',
    status: 'completed',
    deps: ['graph-start'],
    owner: { agentId: 'planner' },
  },
  {
    id: 'graph-ui',
    title: 'Design the UI path',
    status: 'in-progress',
    deps: ['graph-start'],
    owner: { agentId: 'builder' },
  },
  {
    id: 'graph-data',
    title: 'Prepare fixture data',
    status: 'blocked',
    deps: ['graph-start'],
    owner: { agentId: 'builder' },
  },
  {
    id: 'graph-merge',
    title: 'Merge implementation plan',
    status: 'pending',
    deps: ['graph-api', 'graph-ui'],
  },
  { id: 'graph-review', title: 'Review the merged plan', status: 'failed', deps: ['graph-merge'] },
  { id: 'graph-release', title: 'Release checklist', status: 'pending', deps: ['graph-review'] },
  {
    id: 'graph-long',
    title: 'Long-range audit edge',
    status: 'pending',
    deps: ['graph-start', 'graph-release'],
  },
  {
    id: 'graph-orphan',
    title: 'Orphan reference is ignored',
    status: 'pending',
    deps: ['missing-task-id'],
  },
]

export const TaskGraphStory: Story = {
  name: 'Task graph: DAG lanes, long edge, and failure states',
  render: () => (
    <MockDriven>
      <TaskGraph items={graphItems} agents={agents} />
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const graph = canvasElement.querySelector<HTMLElement>('[data-cc-task-graph]')
    if (!graph) throw new Error('Task graph was not rendered')
    const scoped = within(graph)
    await expect(scoped.getAllByTestId('cc-agent-badge')).toHaveLength(4)
    await expect(graph.querySelectorAll('[data-cc-task-graph-node]')).toHaveLength(9)
    await expect(scoped.getByText('blocked')).toBeVisible()
    await expect(scoped.getByText('failed')).toBeVisible()
    await expect(graph.querySelector('[data-cc-task-graph-edge-kind="long"]')).not.toBeNull()
    await expect(graph.querySelector('[data-cc-task-graph-node="graph-orphan"]')).not.toBeNull()
    await expect(scoped.queryByRole('button')).toBeNull()
  },
}

const handoffs: HandoffPart[] = [
  {
    type: 'handoff',
    handoffId: 'h1',
    from: { agentId: 'planner', name: 'Planner' },
    to: { agentId: 'builder', name: 'Builder' },
    reason: 'Plan is ready',
    rule: 'R-114',
    carried: [{ label: 'API map' }],
    missing: [
      { id: 'm1', label: 'Credentials', detail: 'Needs human confirmation.' },
      { id: 'm2', label: 'Release window' },
    ],
  },
  {
    type: 'handoff',
    handoffId: 'h2',
    from: { agentId: 'builder', name: 'Builder' },
    to: { agentId: 'planner', name: 'Planner' },
    reason: 'Implementation needs review',
    carried: [{ label: 'Patch' }],
  },
]

function HandoffDemo() {
  const [acknowledged, setAcknowledged] = useState(false)
  const part: HandoffPart = { ...handoffs[0]!, acknowledged }
  return (
    <MockDriven
      script={[
        { type: 'message-start', agentId: 'builder' },
        { type: 'message-end', finishReason: 'stop' },
      ]}
    >
      <div className="space-y-4">
        <HandoffTrail parts={handoffs} currentAgentId="builder" />
        <HandoffContext part={part} onAcknowledge={() => setAcknowledged(true)} />
      </div>
    </MockDriven>
  )
}

export const Handoff: Story = {
  name: 'Handoff: trail and missing context gate',
  render: () => <HandoffDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const builderNode = canvas.getByTestId('cc-agent-node-builder')
    await expect(builderNode.parentElement).toHaveTextContent('Plan is ready')
    await expect(builderNode).toHaveClass('ring-1')
    const button = canvas.getByRole('button', { name: 'Acknowledge and continue' })
    await expect(button).toBeDisabled()
    await userEvent.click(canvas.getByLabelText('Credentials'))
    await userEvent.click(canvas.getByLabelText('Release window'))
    await expect(button).toBeEnabled()
  },
}

export const HelpGate: Story = {
  name: 'Help gate: blocked permission request',
  render: () => (
    <MockDriven
      script={[
        { type: 'message-start', agentId: 'builder' },
        {
          type: 'permission-request',
          request: { id: 'fixture', toolName: 'deploy', blockedOn: { agentId: 'builder' } },
        },
        { type: 'message-end', finishReason: 'awaiting-permission' },
      ]}
    >
      <Message
        message={{
          id: 'blocked',
          role: 'assistant',
          parts: [
            {
              type: 'permission',
              request: {
                id: 'approval',
                toolName: 'deploy',
                title: 'Deploy release',
                blockedOn: {
                  agentId: 'builder',
                  taskId: 'implementation',
                  reason: 'The release window is ambiguous.',
                },
              },
            },
          ],
        }}
      />
    </MockDriven>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('builder is waiting for your decision')).toBeVisible()
    await expect(canvas.getByText('Blocked task: implementation')).toBeVisible()
    await expect(canvas.getByText('Reason: The release window is ambiguous.')).toBeVisible()
  },
}
