import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { TodoItem } from '@agent-chat/core'
import { TodoList } from '@agent-chat/ui'

const meta = {
  title: 'Chat/Todo',
  parameters: {
    docs: {
      description: {
        component:
          'agent 的计划和推进情况。事件按 `todoId` **原地替换**，所以一次跑十几轮改计划，transcript 里始终只有一个块，不会被清单刷屏。\n\n默认只读 —— 计划是 agent 的，渲染一排点不动的假勾选框比不渲染更糟；传了 `onToggle` 行才变成真的 checkbox。进度条用和勾选图标同色的绿，不动强调色预算。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const RUNNING: TodoItem[] = [
  { id: '1', title: '通读 auth.ts 里的 token 刷新路径', status: 'completed' },
  { id: '2', title: '写一个并发刷新的复现用例', status: 'completed' },
  {
    id: '3',
    title: '给 getToken 加共享的 in-flight promise',
    activeTitle: '正在改 getToken 的并发处理',
    status: 'in-progress',
    note: 'packages/core/src/auth.ts',
  },
  { id: '4', title: '补一条并发刷新的回归测试', status: 'pending' },
  { id: '5', title: '跑一遍 e2e', status: 'pending' },
]

const DONE: TodoItem[] = RUNNING.map((item) => ({ ...item, status: 'completed' }))

const WITH_CANCELLED: TodoItem[] = [
  { id: '1', title: '把日志上报换成批量发送', status: 'completed' },
  { id: '2', title: '加一层本地缓存', status: 'completed' },
  {
    id: '3',
    title: '接 OpenTelemetry',
    status: 'cancelled',
    note: '本次改动范围之外，另开一条',
  },
  { id: '4', title: '删掉旧的 reporter', status: 'cancelled' },
]

export const InProgress: Story = {
  name: '推进中（默认展开）',
  render: () => <TodoList items={RUNNING} />,
}

export const AllDone: Story = {
  name: '全部完成（默认收起）',
  parameters: {
    docs: {
      description: {
        story:
          '和推理块同一条规则、同一个理由：清单在推进时值得看，做完就是噪音。用户手动切过一次之后就永远听用户的。',
      },
    },
  },
  render: () => <TodoList items={DONE} />,
}

export const Cancelled: Story = {
  name: '含已取消项',
  parameters: {
    docs: {
      description: {
        story:
          '取消项**不计入分母** —— 砍掉最后两步的计划是*做完了*，进度条永远停在 2/4 会被读成卡住了。但它们仍然带删除线留在列表里：被放弃的部分也是记录的一部分。',
      },
    },
  },
  render: () => <TodoList items={WITH_CANCELLED} />,
}

export const Checkable: Story = {
  name: '可勾选（传了 onToggle）',
  parameters: {
    docs: {
      description: {
        story:
          '只有宿主想把编辑权交回用户时才用。已取消的行不可点：取消是 agent 放弃这一步的决定，从勾选框里撤销它会让列表和 agent 正在执行的计划对不上。',
      },
    },
  },
  render: () => {
    const Demo = () => {
      const [items, setItems] = useState(RUNNING)
      return (
        <TodoList
          items={items}
          onToggle={(item, next) =>
            setItems((current) =>
              current.map((row) => (row.id === item.id ? { ...row, status: next } : row)),
            )
          }
        />
      )
    }
    return <Demo />
  },
}

export const CustomTitle: Story = {
  name: '自定义标题',
  render: () => <TodoList title="排查 401 的计划" items={RUNNING} />,
}

export const Empty: Story = {
  name: '空列表',
  parameters: {
    docs: {
      description: {
        story: '模型先建了个空计划再往里填的中间态。给一行说明，而不是一个空的可折叠壳子。',
      },
    },
  },
  render: () => <TodoList items={[]} />,
}
