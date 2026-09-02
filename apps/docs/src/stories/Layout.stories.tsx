import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { ChatMessage } from '@xinjiyuan97/chat-core'
import {
  ChatContainer,
  ChatDock,
  ChatEmptyState,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  Message,
  PromptInput,
  SuggestionChips,
} from '@xinjiyuan97/chat-ui'

const meta = {
  title: 'Chat/Layout',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '`ChatDock` 把转录区和输入框排在一起，并多出一个「空会话居中」的形态：首屏把问候语、输入框和建议词整组放在垂直中线上，发出第一条消息后输入框滑到底部、空间交还给转录区。\n\n动画是三行 grid 的 `grid-template-rows` 从 `1fr` 过渡到 `0fr`（尾部撑高行收掉），和 `Collapsible` 用的是同一套技术、同样的理由：不用魔法数字就能过渡到真实布局。换成 FLIP 就得在 layout effect 里对一棵**每次按键都重渲染**的子树读 `getBoundingClientRect`，代价和出错面都大得多。\n\n这是可选组件 —— 想让输入框永远钉在底部的宿主，继续用 `ChatContainer` + `ChatViewport` 直接装配即可。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const SUGGESTIONS = [
  '线上偶发 401，帮我看一下',
  '解释这段代码在并发下的行为',
  '把 Storybook 升到 8',
]

function reply(text: string): ChatMessage {
  return {
    id: `a-${text.slice(0, 6)}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    status: 'complete',
    createdAt: Date.now(),
    parts: [
      {
        type: 'text',
        text: `收到：「${text}」。这个 story 不接模型，只是为了看布局在有内容之后的样子 —— 多发几条就能看到转录区正常滚动、输入框稳稳待在底部。`,
      },
    ],
  }
}

/** The whole assembly, so the two states differ only by what `centered` is fed. */
function Dock({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial)

  const send = (text: string) => {
    if (!text.trim()) return
    setMessages((list) => [
      ...list,
      {
        id: `u-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        status: 'complete',
        createdAt: Date.now(),
        parts: [{ type: 'text', text }],
      },
      reply(text),
    ])
  }

  return (
    /* A real element rather than the preview's `asFragment` decorator, so this story sits
       inside `[data-cc-root]` like a real app does. That wrapper is what scopes the
       reduced-motion override in `tokens.css`; without it the transition below would keep
       animating for a user who asked the OS for less motion. */
    <ChatThemeProvider className="h-[560px]">
      <ChatContainer className="h-full">
        <ChatDock
          centered={messages.length === 0}
          contentClassName="mx-auto w-full max-w-cc-measure px-4 pb-4 sm:px-6"
          transcript={
            <ChatViewport>
              {messages.length > 0 && (
                <ChatMessageList>
                  {messages.map((message) => (
                    <Message key={message.id} message={message} hideActions />
                  ))}
                </ChatMessageList>
              )}
            </ChatViewport>
          }
          intro={
            <div className="pb-5">
              {/* `py-0` overrides the component's own `py-20` — `cn` runs tailwind-merge, so
                a consumer class wins rather than piling up alongside. */}
              <ChatEmptyState
                className="py-0"
                title="今天想做点什么？"
                subtitle="随便发一条，看看输入框怎么滑到底部。"
              />
              <SuggestionChips suggestions={SUGGESTIONS} onSelect={send} className="mt-5" />
            </div>
          }
        >
          <PromptInput onSubmit={send} placeholder="问点什么…" showHint />
        </ChatDock>
      </ChatContainer>
    </ChatThemeProvider>
  )
}

export const Centered: Story = {
  name: '新会话 — 居中',
  parameters: {
    docs: {
      description: {
        story:
          '点建议词或直接发一条，就能看到完整的过渡：输入框下滑、问候语与建议词同步收起，两个动作共用同一个 300ms。开启系统的「减弱动态效果」后过渡会瞬间完成 —— `tokens.css` 末尾的全局覆盖已经处理了，组件本身不用为此写任何分支。',
      },
    },
  },
  render: () => <Dock initial={[]} />,
}

export const Docked: Story = {
  name: '有历史 — 停靠底部',
  render: () => <Dock initial={[reply('起始状态')]} />,
}
