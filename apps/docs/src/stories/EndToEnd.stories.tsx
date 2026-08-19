import { useMemo, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { A2UIAction } from '@agent-chat/a2ui'
import type { ChatMessage } from '@agent-chat/core'
import { createMockTransport, useAttachments, useChat } from '@agent-chat/core'
import {
  ChatContainer,
  ChatEmptyState,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  Message,
  PromptInput,
  SuggestionChips,
  useChatTheme,
} from '@agent-chat/ui'

import { FOLLOW_UP, FULL_TURN, MODELS } from '../fixtures'
import { useMockVoice } from '../mock-voice'
import { mockRunCode } from '../mock-run'

/**
 * Re-provides the theme with the story's handlers attached. The surrounding values come
 * from the global provider so the toolbar's locale and density still apply inside.
 */
function WithHandlers({
  onAction,
  children,
}: {
  onAction: (action: A2UIAction, message: ChatMessage) => void
  children: ReactNode
}) {
  const theme = useChatTheme()
  return (
    <ChatThemeProvider
      asFragment
      locale={theme.locale}
      density={theme.density}
      a2uiRegistry={theme.a2uiRegistry}
      onA2UIAction={onAction}
      /* Giving every code block a run button is one prop — and it is the host that
       * decides what "run" means. Here it is a fake evaluator; a real app would post to
       * a sandbox. The library never executes anything itself. */
      onRunCode={mockRunCode}
    >
      {children}
    </ChatThemeProvider>
  )
}

const SUGGESTIONS = ['线上偶发 401，帮我看一下', '解释一下这段代码', '给这个模块补测试']

function Demo() {
  const [log, setLog] = useState<A2UIAction[]>([])
  const [model, setModel] = useState(MODELS[0]?.id)

  /* The script depends on the request, so the surface's round trip gets a different
   * reply than the opening question. */
  const transport = useMemo(
    () => createMockTransport((request) => (request.messages.length >= 3 ? FOLLOW_UP : FULL_TURN)),
    [],
  )

  const chat = useChat({ transport })

  /* No `onUpload`: files are inlined as data URLs, so the demo needs no storage backend.
   * A real app passes `onUpload` and gets a URL in the part instead. */
  const attachments = useAttachments({
    accept: 'image/*,application/pdf,text/plain,text/csv,.md,.log,.json',
    maxSize: 5 * 1024 * 1024,
    maxFiles: 6,
  })
  // The real `useVoiceInput` needs a microphone permission; the fake types instead.
  const voice = useMockVoice({ mode: 'native' })

  const handleAction = (action: A2UIAction, message: ChatMessage) => {
    setLog((entries) => [...entries, action])

    // Lock the surface first: the card should stop accepting input the moment it is
    // answered, not when the reply eventually starts streaming.
    chat.resolveA2UISurface(message.id, action.surfaceId)

    if (action.action === 'cancel') return

    const strategy = String(action.formData?.['strategy'] ?? 'canary')
    void chat.send(`确认部署，策略 ${strategy}`)
  }

  return (
    <WithHandlers onAction={handleAction}>
      <div className="min-h-dvh bg-cc-sunken p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-[1240px] gap-4 sm:h-[calc(100dvh-3rem)] lg:h-[calc(100dvh-4rem)] lg:gap-6">
          {/* The chat is a framed surface floating on the canvas rather than bleeding to
              the viewport edge — the transcript needs a visible boundary to read as a
              window, and `overflow-hidden` is what keeps the scroll area inside the
              rounded corners. */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-cc-lg border border-cc-border bg-cc-canvas shadow-cc-card">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cc-border px-5 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-cc-sm font-medium text-cc-fg">部署助手</span>
                <span className="truncate text-cc-xs text-cc-faint">
                  mock transport · 思考 / 工具调用 / Markdown / A2UI
                </span>
              </div>
              <span
                className={
                  chat.isLoading
                    ? 'flex shrink-0 items-center gap-1.5 text-cc-xs text-cc-accent'
                    : 'flex shrink-0 items-center gap-1.5 text-cc-xs text-cc-faint'
                }
              >
                <span
                  className={
                    chat.isLoading
                      ? 'size-1.5 rounded-cc-full bg-cc-accent animate-cc-dot'
                      : 'size-1.5 rounded-cc-full bg-cc-success'
                  }
                />
                {chat.isLoading ? '生成中' : '就绪'}
              </span>
            </header>

            <ChatContainer className="min-h-0 flex-1">
              <ChatViewport
                footer={
                  chat.messages.length === 0 ? (
                    <div className="mx-auto w-full max-w-cc-measure px-4 sm:px-6">
                      <SuggestionChips
                        suggestions={SUGGESTIONS}
                        onSelect={(text) => void chat.send(text)}
                      />
                    </div>
                  ) : undefined
                }
              >
                {chat.messages.length === 0 ? (
                  <ChatEmptyState
                    title="今天想做点什么？"
                    subtitle="这条演示会依次播放思考、三次工具调用（其中一次失败）、一段带 Mermaid 图和可运行代码块的长 Markdown，以及一张可交互的 A2UI 卡片。输入框支持模型选择、附件拖拽、粘贴截图和语音输入。"
                  />
                ) : (
                  <ChatMessageList busy={chat.isLoading}>
                    {chat.messages.map((message) => (
                      <Message
                        key={message.id}
                        message={message}
                        hideActions={message.status === 'streaming'}
                        onRegenerate={() => void chat.regenerate()}
                        onRetry={() => void chat.regenerate()}
                        onReactionChange={(reactions) =>
                          chat.setMessages(
                            chat.messages.map((m) =>
                              m.id === message.id ? { ...m, reactions } : m,
                            ),
                          )
                        }
                      />
                    ))}
                  </ChatMessageList>
                )}
              </ChatViewport>

              {/* The composer gets the same measure as the transcript, so the text column
                  does not jump width between reading and writing.

                  No top border: the composer already draws its own outline, and a rule
                  right above it stacked two horizontal lines a few pixels apart — with the
                  suggestion chips sitting between them it read as a boxed-in strip rather
                  than as part of the same surface. Whitespace does the separating. */}
              <div className="shrink-0 px-4 pb-3 pt-3 sm:px-6 sm:pb-4">
                <div className="mx-auto w-full max-w-cc-measure">
                  <PromptInput
                    onSubmit={(text, options) => void chat.send(text, { parts: options.parts })}
                    onStop={chat.stop}
                    streaming={chat.isLoading}
                    attachments={attachments}
                    voice={voice}
                    showImageButton
                    models={MODELS}
                    model={model}
                    onModelChange={setModel}
                    placeholder="问点什么…也可以拖张截图进来"
                    showHint
                  />
                </div>
              </div>
            </ChatContainer>
          </main>

          <aside className="hidden w-[300px] shrink-0 flex-col overflow-hidden rounded-cc-lg border border-cc-border bg-cc-canvas shadow-cc-card lg:flex">
            <header className="shrink-0 border-b border-cc-border px-4 py-3">
              <p className="text-cc-sm font-medium text-cc-fg">A2UI 回传</p>
              <p className="mt-0.5 text-cc-xs text-cc-faint">
                卡片上的操作会以这个 payload 回到 agent
              </p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {log.length === 0 ? (
                <p className="px-1 text-cc-xs leading-[1.7] text-cc-faint">
                  等确认卡片出现后点「部署」或「取消」，这里会显示 action、surfaceId 和整个 surface
                  的 formData。
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {log.map((action, index) => (
                    <pre
                      key={index}
                      className="overflow-x-auto rounded-cc-md border border-cc-border bg-cc-sunken p-2.5 font-cc-mono text-cc-xs leading-[1.6] text-cc-fg"
                    >
                      {JSON.stringify(action, null, 2)}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </WithHandlers>
  )
}

const meta = {
  title: 'Chat/End to End',
  component: Demo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '一条完整的流式对话：思考 → 三次工具调用（含一次失败）→ 长 Markdown（含 Mermaid 时序图和带运行按钮的代码块）→ A2UI 确认卡片 → 用户操作回传 → 后续回复。输入框接了模型选择、`useAttachments`（选择 / 拖拽 / 粘贴）和语音输入；代码块的运行按钮来自 provider 上的 `onRunCode`，执行由宿主实现，组件本身不跑任何代码。这条跑顺，说明 store、transport、parts 渲染、Markdown、A2UI、多模态输入全部联通。',
      },
    },
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}
