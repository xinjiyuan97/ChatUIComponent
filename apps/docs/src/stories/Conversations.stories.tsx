import { useMemo, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { Conversation } from '@xinjiyuan97/chat-core'
import {
  ConversationList,
  ConversationListSkeleton,
  ConversationSidebar,
} from '@xinjiyuan97/chat-ui'

import {
  AGENTS,
  AGENT_CONVERSATIONS,
  CONVERSATIONS,
  MANY_AGENTS,
  MANY_AGENT_CONVERSATIONS,
  MANY_CONVERSATIONS,
  NOW,
} from '../fixtures'

const meta = {
  title: 'Conversations/Sidebar',
  component: ConversationSidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '按日期自动分组、搜索高亮、双击重命名、删除二次确认、上下键导航、超过 100 条切虚拟滚动、可折叠成图标栏。虚拟滚动按行类型算高度（分组标题 30px、条目 36px），用前缀和 + 二分定位可视窗口 —— 不假设行高一致，窗口也能跨分组边界。\n\n传了 `agents` 就自动切成 **agent 分组**：每个 agent 一个可折叠分区，会话嵌在下面，未归属的落到末尾的「未分配」。折叠只是不往行数组里推子行，虚拟化不需要任何特例；键盘光标也跟着走，不会掉进折叠区。',
      },
    },
  },
  // Every story below drives its own state through `render`; this only satisfies the
  // required prop on the meta's type.
  args: { conversations: CONVERSATIONS },
} satisfies Meta<typeof ConversationSidebar>

export default meta
type Story = StoryObj<typeof meta>

/** A sidebar wired to local state, so rename/delete/pin actually do something. */
function Workbench({
  initial,
  note,
  ...rest
}: {
  initial: Conversation[]
  note?: string
} & Partial<ComponentProps<typeof ConversationSidebar>>) {
  const [conversations, setConversations] = useState(initial)
  const [activeId, setActiveId] = useState(initial[0]?.id)

  const update = (id: string, patch: Partial<Conversation>) =>
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <div className="flex h-[760px] bg-cc-canvas">
      <ConversationSidebar
        {...rest}
        conversations={conversations}
        activeId={activeId}
        now={NOW}
        onSelect={setActiveId}
        onNewChat={() => {
          const id = `new-${Date.now()}`
          setConversations((list) => [
            { id, title: '新对话', updatedAt: NOW, createdAt: NOW },
            ...list,
          ])
          setActiveId(id)
        }}
        onNewChatInAgent={
          rest.agents
            ? (agentId) => {
                const id = `new-${agentId}-${conversations.length}`
                setConversations((list) => [
                  { id, title: '新对话', updatedAt: NOW, createdAt: NOW, agentId },
                  ...list,
                ])
                setActiveId(id)
              }
            : undefined
        }
        onRename={(id, title) => update(id, { title })}
        onTogglePin={(id) =>
          setConversations((list) =>
            list.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
          )
        }
        onDelete={(id) => {
          setConversations((list) => list.filter((c) => c.id !== id))
          setActiveId((current) => (current === id ? undefined : current))
        }}
        footer={
          <div className="flex items-center gap-2 px-1 py-0.5 text-cc-xs text-cc-muted">
            <span className="flex size-6 items-center justify-center rounded-cc-full bg-cc-accent-subtle text-cc-accent">
              J
            </span>
            <span className="truncate">jiyuanxin</span>
          </div>
        }
      />

      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-cc-sm text-cc-muted">
          {conversations.find((c) => c.id === activeId)?.title ?? '未选中会话'}
        </p>
        <p className="max-w-md text-cc-xs text-cc-faint">
          {note ??
            '双击标题可以行内重命名；hover 行尾的 ⋯ 有置顶 / 重命名 / 删除；列表获得焦点后上下键可以移动光标。'}
        </p>
      </main>
    </div>
  )
}

export const Default: Story = {
  render: () => <Workbench initial={CONVERSATIONS} />,
}

export const Collapsed: Story = {
  render: () => (
    <Workbench
      initial={CONVERSATIONS}
      defaultCollapsed
      note="折叠态只留图标栏；分组标题和搜索都会隐藏，标题走 title 提示。"
    />
  ),
}

export const Loading: Story = {
  render: () => <Workbench initial={[]} loading note="骨架屏。行数固定，避免加载时高度跳动。" />,
}

export const Empty: Story = {
  render: () => <Workbench initial={[]} note="空列表。搜索无结果时是另一套文案。" />,
}

/** M5's acceptance case: 500 rows, search, rename — all of it must stay responsive. */
export const FiveHundred: Story = {
  name: '500 conversations (virtualised)',
  render: () => (
    <Workbench
      initial={MANY_CONVERSATIONS}
      note="500 条，超过 100 条的阈值，已切到虚拟滚动。搜索时列表会重新扁平化，滚动位置和键盘光标都跟着走。"
    />
  ),
}

export const AgentGroups: Story = {
  name: 'Agent groups',
  render: () => (
    <Workbench
      initial={AGENT_CONVERSATIONS}
      agents={AGENTS}
      note="4 个 agent，「文档翻译」下面一条会话都没有 —— 空分区照样保留标题，否则「在这个 agent 下新建」没有落点。hover 标题行右侧出 + 号；末尾的「未分配」收留没有 agentId 的会话。"
    />
  ),
}

export const AgentsAtScale: Story = {
  name: '540 conversations across 6 agents',
  render: () => (
    <Workbench
      initial={MANY_AGENT_CONVERSATIONS}
      agents={MANY_AGENTS}
      defaultCollapsedAgentIds={['writer']}
      note="虚拟滚动 + 折叠的交叉验收：折中间某个 agent，看它下面的行有没有正确上移；再甩一下滚动条确认不露白。Tab 进列表后上下键必须跳过被折叠的子行。"
    />
  ),
}

export const AgentSearch: Story = {
  name: 'Agent search (flattened)',
  render: () => {
    const Demo = () => {
      const [query, setQuery] = useState('刷新')
      return (
        <Workbench
          initial={AGENT_CONVERSATIONS}
          agents={AGENTS}
          query={query}
          onQueryChange={setQuery}
          note="搜索时分组结构整个让位：结果跨 agent 展平，每行副标题标注它属于谁。命中藏在折叠区里却搜不到，比多一行副标题糟糕得多。清空搜索框即可回到分组结构。"
        />
      )
    }
    return <Demo />
  },
}

export const AgentsCollapsed: Story = {
  name: 'Collapsed to the agent rail',
  render: () => (
    <Workbench
      initial={AGENT_CONVERSATIONS}
      agents={AGENTS}
      defaultCollapsed
      note="折叠成 56px 时图标栏放的是 agent 徽章，不是会话首字 —— 有了 agent 之后，值得一直看见的是「有哪些助手、我现在在哪个下面」。点徽章展开侧栏。"
    />
  ),
}

export const ListOnly: Story = {
  name: 'List without the sidebar chrome',
  render: () => {
    const Demo = () => {
      const [query, setQuery] = useState('token')
      const conversations = useMemo(() => CONVERSATIONS, [])

      return (
        <div className="flex h-[600px] w-72 flex-col gap-2 border-r border-cc-border p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索…"
            className="rounded-cc-sm border border-cc-border bg-cc-surface px-2.5 py-1.5 text-cc-sm outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/30"
          />
          <ConversationList
            conversations={conversations}
            query={query}
            activeId="c0"
            now={NOW}
            onSelect={() => {}}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const Skeleton: Story = {
  render: () => (
    <div className="w-72 p-2">
      <ConversationListSkeleton rows={8} />
    </div>
  ),
}
