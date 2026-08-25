import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { Reaction } from '@xinjiyuan97/core'
import {
  CopyButton,
  EditButton,
  FeedbackButtons,
  Message,
  MessageActions,
  ReactionBar,
  RegenerateButton,
  ShareButton,
} from '@xinjiyuan97/ui'

import { ASSISTANT_FULL, MARKDOWN_SHORT, NOW } from '../fixtures'

const meta = {
  title: 'Chat/Reactions',
  parameters: {
    docs: {
      description: {
        component:
          '次级操作默认不可见（`opacity-0`），hover **和键盘 focus** 时才显现 —— 只做 hover 会让键盘用户完全够不到这些按钮。全部走 `useReactions`，视觉层只是 headless 的一种皮。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Buttons: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <CopyButton text="要复制的内容" />
      <RegenerateButton onClick={() => {}} />
      <EditButton onClick={() => {}} />
      <ShareButton url="https://example.com/c/abc" title="一次关于 token 刷新的排查" />
    </div>
  ),
}

export const Feedback: Story = {
  render: () => {
    const Demo = () => {
      const [value, setValue] = useState<'like' | 'dislike' | null>(null)
      return (
        <div className="flex flex-col gap-3">
          <FeedbackButtons
            liked={value === 'like'}
            disliked={value === 'dislike'}
            onFeedback={(next) => setValue((current) => (current === next ? null : next))}
          />
          <p className="text-cc-xs text-cc-faint">当前：{value ?? '未评价'}（再点一次取消）</p>
        </div>
      )
    }
    return <Demo />
  },
}

export const Emoji: Story = {
  name: 'Reaction bar',
  render: () => {
    const Demo = () => {
      const [reactions, setReactions] = useState<Reaction[]>([
        { key: '🎯', count: 2 },
        { key: '🔥', count: 1, active: true },
      ])

      const toggle = (key: string) =>
        setReactions((list) => {
          const existing = list.find((r) => r.key === key)
          if (!existing) return [...list, { key, count: 1, active: true }]

          const count = (existing.count ?? 0) + (existing.active ? -1 : 1)
          if (count <= 0) return list.filter((r) => r.key !== key)
          return list.map((r) => (r.key === key ? { ...r, count, active: !r.active } : r))
        })

      return (
        <div className="flex flex-col gap-4">
          <ReactionBar reactions={reactions} onToggle={toggle} />
          <ReactionBar reactions={reactions} onToggle={toggle} readOnly />
        </div>
      )
    }
    return <Demo />
  },
}

export const OnAMessage: Story = {
  name: 'In context (hover the message)',
  render: () => (
    <Message
      message={{
        id: 'r1',
        role: 'assistant',
        status: 'complete',
        createdAt: NOW,
        parts: [{ type: 'text', text: MARKDOWN_SHORT }],
        reactions: [{ key: '👍', count: 3, active: true }],
      }}
      onRegenerate={() => {}}
      onFeedback={() => {}}
      onReactionChange={() => {}}
      showReactions
    />
  ),
}

export const AlwaysVisible: Story = {
  render: () => (
    <MessageActions
      message={ASSISTANT_FULL}
      onRegenerate={() => {}}
      onFeedback={() => {}}
      onReactionChange={() => {}}
      showReactions
      showShare
      alwaysVisible
    />
  ),
}
