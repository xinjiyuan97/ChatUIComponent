import type { Meta, StoryObj } from '@storybook/react'

import type { ChatMessage } from '@agent-chat/core'
import { ChatMessageList, Message } from '@agent-chat/ui'

import {
  ASSISTANT_CITED,
  ASSISTANT_ERROR,
  ASSISTANT_FULL,
  ASSISTANT_STREAMING,
  MARKDOWN_SHORT,
  NOW,
  userMessage,
} from '../fixtures'

const meta = {
  title: 'Chat/Message',
  component: Message,
  parameters: {
    docs: {
      description: {
        component:
          '一条消息由 parts 数组渲染。用户消息有气泡，AI 回复直接平铺在背景上 —— 这是本库的视觉基调，不要给 AI 回复加气泡。',
      },
    },
  },
  argTypes: {
    message: { control: false },
  },
  args: {
    showAvatar: true,
    showTimestamp: true,
    showReactions: true,
  },
} satisfies Meta<typeof Message>

export default meta
type Story = StoryObj<typeof meta>

export const User: Story = {
  args: { message: userMessage('线上偶发 401，本地复现不了，帮我看一下 auth 那块。') },
}

export const UserLong: Story = {
  args: {
    message: userMessage(
      '我们的 API 客户端在生产环境每天会有几十次 401，但同样的代码在本地和预发都跑不出来。日志里看不出规律，只知道都发生在页面刚打开、并发请求比较多的时候。我怀疑跟 token 刷新有关，但没有直接证据。你能读一下 src/auth.ts 帮我判断吗？',
      'u-long',
    ),
  },
}

export const Assistant: Story = {
  args: {
    message: {
      id: 'a-short',
      role: 'assistant',
      status: 'complete',
      createdAt: NOW,
      parts: [{ type: 'text', text: MARKDOWN_SHORT }],
    } satisfies ChatMessage,
  },
}

export const AssistantWithEverything: Story = {
  name: 'Assistant (reasoning + tools + markdown + sources)',
  args: { message: ASSISTANT_FULL },
}

/**
 * `[1]` and `[1,2]` in the prose become superscript chips wired to the sources list below.
 * Clicking one opens the list, scrolls to the row and highlights it — a footnote with
 * nothing at the other end is decoration.
 */
export const Citations: Story = {
  name: 'Inline citations',
  args: { message: ASSISTANT_CITED },
  parameters: {
    docs: {
      description: {
        story:
          '编号就是 `source` part 在 `parts` 里的位置，作用域限于这条消息 —— 屏幕上两条回答各有各的 `[1]`。越界的编号（示例里的 `[9]`）保持原样不改写，行内代码里的 `tokens[1]` 也不动，这是把误伤降到接近零的关键。',
      },
    },
  },
}

export const Streaming: Story = {
  args: { message: ASSISTANT_STREAMING, hideActions: true },
}

export const Failed: Story = {
  args: { message: ASSISTANT_ERROR },
}

export const Conversation: Story = {
  name: 'A short exchange',
  args: { message: ASSISTANT_FULL },
  render: (args) => (
    <ChatMessageList>
      <Message {...args} message={userMessage('线上偶发 401，帮我看一下 auth 那块。')} />
      <Message {...args} message={ASSISTANT_FULL} />
      <Message {...args} message={userMessage('先别提交，把测试补上再说。', 'u2')} />
      <Message {...args} message={ASSISTANT_STREAMING} hideActions />
    </ChatMessageList>
  ),
}
