import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { ChatMessage } from '@xinjiyuan97/chat-core'
import { useSidePanel } from '@xinjiyuan97/chat-core'
import {
  ChatContainer,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  ChatWorkspace,
  ConversationSidebar,
  DiagramIcon,
  IconButton,
  ImageIcon,
  Markdown,
  Message,
  PromptInput,
  SidePanel,
  TrashIcon,
  definePanel,
  type PanelRegistry,
} from '@xinjiyuan97/chat-ui'

import { CONVERSATIONS, MARKDOWN_SAMPLE, NOW } from '../fixtures'

const meta = {
  title: 'Chat/Workspace',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '`ChatWorkspace` 是三栏外壳：左边会话列表，中间转录区与输入框，右边 `SidePanel`。\n\n**右栏不知道自己在显示什么。** 每个面板项只带 `kind` + `data`，由 `ChatThemeProvider` 的 `panels` 注册表决定谁来画 —— 和 `tools` 给 tool call 做的事完全同构。所以同一根柱子今天放文档预览，以后放 diff、运行日志、设置面板，都不用改 `SidePanel` 一行。这个 story 故意注册了两个形态完全不同的渲染器来证明这一点：一个是有内边距的 Markdown，一个是 `padded: false` 的整块图片。\n\n标签行为按编辑器的规矩来：**同一个 id 再次 `open` 是就地聚焦并刷新**，不会多一个标签、也不会把标签挪到末尾；**关掉当前标签会选右邻**，没有右邻才回退到左邻 —— 退回第一个标签是最招人烦的做法。\n\n宽度可拖拽（左边缘那条），双击复位，`storageKey` 会把宽度记到 `localStorage`。手柄是真正的 `role="separator"`，方向键、Home/End 都能用。窄屏（lg 以下）面板改为浮层，不挤压正文。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

type DocPayload = { body: string }
type ShotPayload = { url: string; caption: string }

/**
 * Two deliberately unalike renderers.
 *
 * The point of the pair is that the shell treats them identically: it looks up `kind`,
 * draws the tab with whatever icon came back, and hands over the box.
 */
const PANELS: PanelRegistry = {
  doc: definePanel<DocPayload>({
    icon: DiagramIcon,
    render: ({ item }) => <Markdown>{item.data?.body ?? ''}</Markdown>,
  }),
  shot: definePanel<ShotPayload>({
    icon: ImageIcon,
    // Reaches the panel's edges: padding around a screenshot is wasted width.
    padded: false,
    render: ({ item }) => (
      <figure className="flex h-full flex-col">
        <img src={item.data?.url} alt={item.data?.caption ?? ''} className="w-full" />
        <figcaption className="border-t border-cc-border px-3 py-2 text-cc-xs text-cc-muted">
          {item.data?.caption}
        </figcaption>
      </figure>
    ),
  }),
}

const SHOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
       <rect width="640" height="400" fill="#1f2937"/>
       <circle cx="320" cy="180" r="90" fill="#38bdf8" opacity="0.8"/>
       <rect x="120" y="300" width="400" height="14" rx="7" fill="#475569"/>
     </svg>`,
  )

function message(id: string, role: ChatMessage['role'], text: string): ChatMessage {
  return { id, role, status: 'complete', createdAt: NOW, parts: [{ type: 'text', text }] }
}

const TRANSCRIPT: ChatMessage[] = [
  message('u1', 'user', '把认证中间件的实现整理成文档，再给我一张架构图。'),
  message(
    'a1',
    'assistant',
    '整理好了。用下面的按钮打开右侧面板 —— 文档和截图是两种不同的 `kind`，走的是同一套壳。',
  ),
]

function Workspace() {
  const [activeId, setActiveId] = useState(CONVERSATIONS[0]?.id)
  const panel = useSidePanel()

  const openers = useMemo(
    () => [
      {
        label: '打开文档',
        run: () =>
          panel.open({
            id: 'doc:auth',
            kind: 'doc',
            title: '认证中间件.md',
            data: { body: MARKDOWN_SAMPLE } satisfies DocPayload,
          }),
      },
      {
        label: '打开截图',
        run: () =>
          panel.open({
            id: 'shot:arch',
            kind: 'shot',
            title: '架构图.png',
            data: { url: SHOT, caption: '取数路径，重构后' } satisfies ShotPayload,
          }),
      },
      {
        label: '打开第三个',
        run: () =>
          panel.open({
            id: 'doc:notes',
            kind: 'doc',
            title: '会议纪要-2026-03-14.md',
            data: { body: '## 会议纪要\n\n- 先把预览的壳做出来\n- 具体格式之后单独对齐' },
          }),
      },
      {
        // Nothing is registered for this kind. It has to degrade to a sentence, not to a
        // blank panel and not to a thrown error — what lands in the panel is agent output.
        label: '打开未注册的 kind',
        run: () => panel.open({ id: 'weird', kind: 'spreadsheet', title: '报表.xlsx' }),
      },
    ],
    [panel],
  )

  return (
    <ChatThemeProvider panels={PANELS} className="h-dvh">
      <ChatWorkspace
        sidebar={
          <ConversationSidebar
            conversations={CONVERSATIONS.slice(0, 8)}
            activeId={activeId}
            activeIndicator="none"
            onSelect={setActiveId}
            onNewChat={() => setActiveId(undefined)}
            now={NOW}
          />
        }
        panel={
          <SidePanel
            panel={panel}
            storageKey="cc:story-panel-width"
            actions={
              panel.items.length > 1 && (
                <IconButton
                  label="全部关闭"
                  size="sm"
                  onClick={panel.closeAll}
                  icon={<TrashIcon size={13} />}
                />
              )
            }
          />
        }
      >
        <ChatContainer className="h-full">
          <ChatViewport>
            <ChatMessageList>
              {TRANSCRIPT.map((entry) => (
                <Message key={entry.id} message={entry} hideActions />
              ))}
            </ChatMessageList>

            <div className="mt-4 flex flex-wrap gap-2">
              {openers.map((opener) => (
                <button
                  key={opener.label}
                  type="button"
                  onClick={opener.run}
                  className="rounded-cc-full border border-cc-border bg-cc-surface px-3 py-1.5 text-cc-sm text-cc-muted transition-colors duration-150 hover:border-cc-border-strong hover:text-cc-fg"
                >
                  {opener.label}
                </button>
              ))}
            </div>
          </ChatViewport>

          <div className="shrink-0 px-4 pb-4 sm:px-6">
            <div className="mx-auto w-full max-w-cc-measure">
              <PromptInput onSubmit={() => {}} placeholder="这个 story 不接模型…" />
            </div>
          </div>
        </ChatContainer>
      </ChatWorkspace>
    </ChatThemeProvider>
  )
}

export const ThreeColumn: Story = {
  name: '三栏 — 会话 / 转录 / 面板',
  render: () => <Workspace />,
}
