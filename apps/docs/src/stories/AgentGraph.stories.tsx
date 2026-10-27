import { useState, type ComponentProps } from 'react'
import type { AgentGraphDefinition } from '@xinjiyuan97/chat-core'
import type { Meta, StoryObj } from '@storybook/react'
import {
  AgentGraph,
  AgentGraphFile,
  ChatThemeProvider,
  type AgentGraphNodeStatus,
} from '@xinjiyuan97/chat-ui'
import { durableGraph, textGraph, toolGraph } from '../graph-fixtures'
import graphExampleUrl from '../agent-graph-example.yaml?url'

const meta = {
  title: 'Agent/Graph',
  component: AgentGraph,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '静态 Agent 订阅图的无限画布。支持 v2 Trigger 与 v1 输入源、循环、外部事件、终态观察、横向／纵向布局及节点与连线详情。节点位置仅影响展示，不修改图定义或执行顺序。引入组件库主题样式后，额外引入 `@xinjiyuan97/chat-ui/graph.css`。',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  args: { definition: toolGraph, style: { height: 'min(760px, calc(100dvh - 48px))' } },
} satisfies Meta<typeof AgentGraph>
export default meta
type Story = StoryObj<typeof meta>

export const Tools: Story = { name: '工具循环' }
export const Text: Story = { name: '纯文本', args: { definition: textGraph } }
export const Durable: Story = { name: '外部等待', args: { definition: durableGraph } }
export const Vertical: Story = {
  name: '纵向布局',
  args: { definition: toolGraph, defaultDirection: 'TB' },
}
export const Compact: Story = {
  name: '紧凑嵌入',
  args: {
    definition: textGraph,
    showMinimap: false,
    showEventLabels: false,
    style: { height: 420, maxWidth: 720 },
  },
}
export const Dark: Story = {
  name: '深色',
  render: (args) => (
    <div className="dark">
      <ChatThemeProvider>
        <AgentGraph {...args} />
      </ChatThemeProvider>
    </div>
  ),
}
export const Running: Story = {
  name: '运行状态（手动模拟）',
  render: (args) => <RunPreview {...args} />,
}
function RunPreview(args: ComponentProps<typeof AgentGraph>) {
  const snapshots: Record<string, AgentGraphNodeStatus>[] = [
    { context: 'completed', llm: 'running' },
    { context: 'completed', llm: 'completed', gate: 'waiting', policy: 'waiting' },
    {
      context: 'completed',
      llm: 'completed',
      gate: 'waiting',
      policy: 'completed',
      tools: 'running',
    },
    {
      context: 'running',
      llm: 'completed',
      gate: 'completed',
      policy: 'completed',
      tools: 'completed',
    },
  ]
  const [step, setStep] = useState(0)
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-cc-sm text-cc-muted">
        <span>示例状态 · 不执行模型或工具</span>
        <button
          type="button"
          className="rounded-cc-sm border border-cc-border px-3 py-1 hover:bg-cc-subtle"
          onClick={() => setStep((value) => (value + 1) % snapshots.length)}
        >
          下一步 {step + 1}/{snapshots.length}
        </button>
      </div>
      <AgentGraph {...args} nodeStatuses={snapshots[step]} />
    </div>
  )
}
export const Failed: Story = {
  name: '模型失败',
  args: { nodeStatuses: { context: 'completed', llm: 'failed', $terminal: 'failed' } },
}
export const Empty: Story = {
  name: '空图',
  args: { definition: { ...toolGraph, operators: {}, subscriptions: [] } },
}
export const Invalid: Story = {
  name: '无效引用',
  args: {
    definition: {
      ...toolGraph,
      subscriptions: [
        {
          id: 'missing',
          from: 'start',
          subscriber: 'missing-operator',
          events: ['agent.start.v1'],
        },
      ],
    },
  },
}
export const LegacyV1: Story = {
  name: 'v1 图快照',
  args: {
    definition: {
      schema_version: 1,
      name: 'legacy-text-assistant',
      operators: textGraph.operators,
      subscriptions: textGraph.subscriptions.map((subscription) => ({
        ...subscription,
        from: subscription.from === 'start' ? '$input' : subscription.from,
      })),
      lifecycle: { start: { event: 'agent.start.v1' }, terminal: textGraph.lifecycle.terminal },
      limits: textGraph.limits,
    },
  },
}

export const EditableConfiguration: Story = {
  name: '配置弹窗 · 可编辑',
  render: (args) => <EditableGraph {...args} />,
}
function EditableGraph(args: ComponentProps<typeof AgentGraph>) {
  const [definition, setDefinition] = useState<AgentGraphDefinition>(args.definition)
  const [saved, setSaved] = useState('')
  return (
    <div>
      <div className="mb-3 text-cc-sm text-cc-muted" role="status">
        {saved || '点击节点上的「配置」编辑。此示例仅保存在当前页面内存中。'}
      </div>
      <AgentGraph
        {...args}
        definition={definition}
        onConfigSave={({ nodeId, kind, config }) => {
          setDefinition((previous) =>
            kind === 'operator'
              ? {
                  ...previous,
                  operators: {
                    ...previous.operators,
                    [nodeId]: { ...previous.operators[nodeId]!, config },
                  },
                }
              : previous.schema_version === 2
                ? {
                    ...previous,
                    triggers: {
                      ...previous.triggers,
                      [nodeId]: { ...previous.triggers[nodeId]!, config },
                    },
                  }
                : previous,
          )
          setSaved(`已保存 ${nodeId} 的配置（当前页面）`)
        }}
      />
    </div>
  )
}
export const ConfigurationSaveFailed: Story = {
  name: '配置弹窗 · 保存失败',
  args: {
    onConfigSave: async () => {
      throw new Error('宿主拒绝了这次配置更新，请检查参数后重试。')
    },
  },
}

export const ImportYaml: Story = {
  name: 'YAML 文件导入',
  render: () => <FileImportPreview />,
}
export const ImportYamlWithGraph: Story = {
  name: 'YAML 导入 · 替换当前图',
  render: () => <AgentGraphFile defaultDefinition={toolGraph} />,
}
export const ImportYamlDark: Story = {
  name: 'YAML 导入 · 深色',
  render: () => (
    <div className="dark">
      <ChatThemeProvider>
        <FileImportPreview />
      </ChatThemeProvider>
    </div>
  ),
}
function FileImportPreview() {
  const [definition, setDefinition] = useState<AgentGraphDefinition>()
  return (
    <div>
      <a
        href={graphExampleUrl}
        download="tool-assistant.yaml"
        className="text-cc-sm text-cc-accent underline underline-offset-4"
      >
        下载示例 YAML
      </a>
      <AgentGraphFile
        definition={definition}
        onImport={setDefinition}
        onConfigSave={({ nodeId, kind, config }) => {
          setDefinition((previous) =>
            !previous
              ? previous
              : kind === 'operator'
                ? {
                    ...previous,
                    operators: {
                      ...previous.operators,
                      [nodeId]: { ...previous.operators[nodeId]!, config },
                    },
                  }
                : previous.schema_version === 2
                  ? {
                      ...previous,
                      triggers: {
                        ...previous.triggers,
                        [nodeId]: { ...previous.triggers[nodeId]!, config },
                      },
                    }
                  : previous,
          )
        }}
      />
    </div>
  )
}
