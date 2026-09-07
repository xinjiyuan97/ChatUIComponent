import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { A2UIAction } from '@xinjiyuan97/chat-a2ui'
import type {
  ChatMessage,
  FileNode,
  FilePart,
  PreviewFile,
  UseFileTreeOptions,
} from '@xinjiyuan97/chat-core'
import { createMockTransport, useAttachments, useChat, useSidePanel } from '@xinjiyuan97/chat-core'
import {
  Button,
  ChatContainer,
  ChatEmptyState,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  ChatWorkspace,
  ConversationSidebar,
  FileTree,
  FolderIcon,
  IconButton,
  Message,
  PromptInput,
  SidePanel,
  SuggestionChips,
  TrashIcon,
  definePanel,
  filePreviewPanel,
  useChatTheme,
  type PanelRegistry,
} from '@xinjiyuan97/chat-ui'

import { CONVERSATIONS, FOLLOW_UP, FULL_TURN, MODELS, NOW } from '../fixtures'
import { TREE, lazyExpand } from '../preview-fixtures'
import { useMockVoice } from '../mock-voice'
import { mockRunCode } from '../mock-run'
/* Vite hands back a URL for the worker file, which is what `pdfWorkerSrc` wants. */
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

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

// ---------------------------------------------------------------------------
// The parts both stories run on
// ---------------------------------------------------------------------------

/**
 * Transport, store, attachments, voice, model — everything below the UI.
 *
 * Shared so the two stories differ only in the shell around them: whatever the framed
 * playground does, the three-column workspace does identically, and a regression in the
 * chat itself cannot show up in one and not the other.
 */
function useDemoChat(onAction?: (action: A2UIAction) => void) {
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
    onAction?.(action)

    // Lock the surface first: the card should stop accepting input the moment it is
    // answered, not when the reply eventually starts streaming.
    chat.resolveA2UISurface(message.id, action.surfaceId)

    if (action.action === 'cancel') return

    const strategy = String(action.formData?.['strategy'] ?? 'canary')
    void chat.send(`确认部署，策略 ${strategy}`)
  }

  return { chat, attachments, voice, model, setModel, handleAction }
}

type DemoChat = ReturnType<typeof useDemoChat>

/**
 * The middle column: transcript, then composer.
 *
 * The composer gets the same measure as the transcript, so the text column does not jump
 * width between reading and writing. No top border on it either — the composer already
 * draws its own outline, and a rule right above it stacked two horizontal lines a few
 * pixels apart; with the suggestion chips between them it read as a boxed-in strip rather
 * than as part of the same surface. Whitespace does the separating.
 */
function ChatColumn({
  demo,
  subtitle,
  placeholder,
  onFileSent,
}: {
  demo: DemoChat
  subtitle: string
  placeholder: string
  /** Lets the workspace mirror a sent attachment into the preview panel. */
  onFileSent?: (part: FilePart) => void
}) {
  const { chat, attachments, voice, model, setModel } = demo

  return (
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
          <ChatEmptyState title="今天想做点什么？" subtitle={subtitle} />
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
                    chat.messages.map((m) => (m.id === message.id ? { ...m, reactions } : m)),
                  )
                }
              />
            ))}
          </ChatMessageList>
        )}
      </ChatViewport>

      <div className="shrink-0 px-4 pb-3 pt-3 sm:px-6 sm:pb-4">
        <div className="mx-auto w-full max-w-cc-measure">
          <PromptInput
            onSubmit={(text, options) => {
              void chat.send(text, { parts: options.parts })
              for (const part of options.parts ?? []) {
                if (part.type === 'file') onFileSent?.(part)
              }
            }}
            onStop={chat.stop}
            streaming={chat.isLoading}
            attachments={attachments}
            voice={voice}
            showImageButton
            models={MODELS}
            model={model}
            onModelChange={setModel}
            placeholder={placeholder}
            showHint
          />
        </div>
      </div>
    </ChatContainer>
  )
}

// ---------------------------------------------------------------------------
// 1 — the conversation on its own
// ---------------------------------------------------------------------------

function Demo() {
  const [log, setLog] = useState<A2UIAction[]>([])
  const demo = useDemoChat((action) => setLog((entries) => [...entries, action]))
  const { chat } = demo

  return (
    <WithHandlers onAction={demo.handleAction}>
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

            <ChatColumn
              demo={demo}
              subtitle="这条演示会依次播放思考、三次工具调用（其中一次失败）、一段带 Mermaid 图和可运行代码块的长 Markdown，以及一张可交互的 A2UI 卡片。输入框支持模型选择、附件拖拽、粘贴截图和语音输入。"
              placeholder="问点什么…也可以拖张截图进来"
            />
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

// ---------------------------------------------------------------------------
// 2 — the same conversation inside the whole application
// ---------------------------------------------------------------------------

type TreeData = {
  nodes: FileNode[]
  onExpand?: UseFileTreeOptions['onExpand']
  /** Activating a row is the host's business, not the tree's. */
  onOpen: (node: FileNode) => void
}

/**
 * One built-in panel and one written here, which is the whole extension story.
 *
 * `file` is ours — it is the door to the *second* registry, the one indexed by file type.
 * `tree` is the host's, and the shell learns nothing from it: `SidePanel` looks up a `kind`,
 * draws a tab, and hands over a box. Anything that fits in a box goes here — a diff, a run
 * log, a settings pane — without the panel gaining a concept for it.
 */
const WORKSPACE_PANELS: PanelRegistry = {
  file: filePreviewPanel,
  tree: definePanel<TreeData>({
    icon: FolderIcon,
    padded: false,
    render: ({ item }) =>
      item.data ? (
        <FileTree
          nodes={item.data.nodes}
          onExpand={item.data.onExpand}
          onActivate={item.data.onOpen}
          defaultExpanded={['src', 'docs']}
          label="工作区文件"
          className="h-full"
        />
      ) : null,
  }),
}

function WorkspaceDemo() {
  const [activeId, setActiveId] = useState(CONVERSATIONS[0]?.id)
  const panel = useSidePanel()
  const demo = useDemoChat()

  /* `panel.open` rather than `panel`: the controller's identity changes with its own state,
   * so a callback that depended on the whole object would be new after every tab change. */
  const { open } = panel

  const openFile = useCallback(
    (id: string, file: PreviewFile) => {
      open({ id, kind: 'file', title: file.name, data: { file } })
    },
    [open],
  )

  const openTree = useCallback(() => {
    open({
      id: 'workspace',
      kind: 'tree',
      title: '工作区',
      data: {
        nodes: TREE,
        onExpand: lazyExpand,
        onOpen: (node: FileNode) => node.file && openFile(node.id, node.file),
      } satisfies TreeData,
    })
  }, [open, openFile])

  /*
   * Boots with the repo showing, the way an editor opens on its file list.
   *
   * The ref is not ceremony. Opening a tab is a state change, and re-opening an id that is
   * already there still produces a new state object — so an effect that can re-run after a
   * panel update will open, re-render, open again, and peg the tab. Once means once.
   */
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    openTree()
  }, [openTree])

  const title = CONVERSATIONS.find((entry) => entry.id === activeId)?.title ?? '新对话'

  return (
    <ChatThemeProvider
      panels={WORKSPACE_PANELS}
      pdfWorkerSrc={pdfWorkerSrc}
      onA2UIAction={demo.handleAction}
      onRunCode={mockRunCode}
      className="h-dvh"
    >
      <ChatWorkspace
        sidebar={
          <ConversationSidebar
            conversations={CONVERSATIONS.slice(0, 10)}
            activeId={activeId}
            onSelect={setActiveId}
            onNewChat={() => setActiveId(undefined)}
            now={NOW}
          />
        }
        panel={
          <SidePanel
            panel={panel}
            storageKey="cc:e2e-panel-width"
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
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cc-border px-4 py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-cc-sm font-medium text-cc-fg">{title}</span>
            <span className="truncate text-cc-xs text-cc-faint">
              回复里读的 <code className="font-cc-mono">src/auth.ts</code> 就在右边那棵树里
            </span>
          </div>
          {/* Closing every tab collapses the panel, so there has to be a way back in. */}
          <Button
            size="sm"
            variant="outline"
            iconLeft={<FolderIcon size={13} />}
            onClick={openTree}
          >
            工作区
          </Button>
        </header>

        <ChatColumn
          demo={demo}
          subtitle="左边是会话列表，右边是同一个 SidePanel —— 在树里点开任意文件都会变成一个预览标签。发消息时带上的附件也会自动开一个标签。"
          placeholder="问点什么…拖进来的文件会在右边打开"
          onFileSent={(part) =>
            part.url &&
            openFile(`attachment:${part.name ?? part.url}`, {
              name: part.name ?? '附件',
              mediaType: part.mediaType,
              size: part.size,
              url: part.url,
            })
          }
        />
      </ChatWorkspace>
    </ChatThemeProvider>
  )
}

const meta = {
  title: 'Chat/End to End',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '两条端到端：一条只有对话，一条把对话放进完整的应用外壳里。两条跑的是同一个 `useDemoChat` —— transport、store、附件、语音、模型选择都是同一份，区别只在外面那层壳。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
  name: '对话 — 流式全流程',
  render: () => <Demo />,
  parameters: {
    docs: {
      description: {
        story:
          '一条完整的流式对话：思考 → 三次工具调用（含一次失败）→ 长 Markdown（含 Mermaid 时序图和带运行按钮的代码块）→ A2UI 确认卡片 → 用户操作回传 → 后续回复。输入框接了模型选择、`useAttachments`（选择 / 拖拽 / 粘贴）和语音输入；代码块的运行按钮来自 provider 上的 `onRunCode`，执行由宿主实现，组件本身不跑任何代码。这条跑顺，说明 store、transport、parts 渲染、Markdown、A2UI、多模态输入全部联通。',
      },
    },
  },
}

export const Workspace: Story = {
  name: '完整工作台 — 会话 / 对话 / 预览',
  render: () => <WorkspaceDemo />,
  parameters: {
    docs: {
      description: {
        story:
          "同一条对话，装进三栏外壳里：左边 `ConversationSidebar`，中间转录区与输入框，右边 `SidePanel`。整个库的东西在这一条里全部同时在跑 —— 流式、工具调用、Mermaid、可运行代码块、A2UI 卡片、附件、语音，加上右栏的文件预览。\n\n**接线一共是两处**：provider 上一个 `panels`，和一次 `panel.open`。\n\n```tsx\n<ChatThemeProvider panels={{ file: filePreviewPanel, tree: myTreePanel }} pdfWorkerSrc={workerUrl}>\npanel.open({ id: node.id, kind: 'file', title: node.name, data: { file } })\n```\n\n注册表里两条来路不同：`file` 是内置的，它是通往**第二层**（按文件类型索引）的门；`tree` 是这条 story 自己写的五行 —— 一个 `definePanel` 包住 `FileTree`。**`SidePanel` 两个都不认识**，它只查 `kind`、画个标签、把盒子交出去。右栏以后要放 diff、运行日志、设置面板，写法和 `tree` 这条一模一样，面板本身一行都不用改。\n\n几条值得动手试的：\n\n- 树里点 `src/auth.ts` —— 就是上面回复里 `read_file` 读的那个文件，同一份内容。再点 `docs/` 下的 pdf / docx / xlsx，标签一个个叠上去。\n- 再点一次同一个文件：**就地聚焦，不会多一个标签、也不会把标签挪到末尾**。关掉当前标签会选右邻 —— 退回第一个标签是最招人烦的做法。\n- `src/generated` 是懒加载的，展开时才去取。\n- 往输入框里拖个文件再发出去，右边自动开一个预览标签（宿主行为，`onSubmit` 拿到 parts 后自己决定）。\n- 拖右栏左边缘改宽度，双击复位；窄到 480px 以下时预览工具栏会自己收起状态文字，保住按钮。\n- 全部关掉，面板收起，用标题栏那个「工作区」按钮再开回来。\n\n树在这里是**一个标签**，点开文件会切到新标签、树暂时让位。想让树一直留在视野里就改用内置的 `folderPanel`（Preview 那条 story），它在一个标签内部左树右预览。这里选标签，是因为标签逻辑本身值得被看见。",
      },
    },
  },
}
