# Agent Chat Components

给 agent 项目复用的 React 聊天组件库。覆盖流式输出、思考过程、function call、Markdown、reaction、会话列表，以及一个让 agent 直接吐 UI 的 **A2UI** 扩展口子。

视觉走清爽极简（Claude / Linear 风）：AI 回复不套气泡、折叠块只用一条细线、强调色一次只出现在一个地方。

```
packages/core   @xinjiyuan97/chat-core   零 UI：类型 / store / transport / hooks
packages/a2ui   @xinjiyuan97/chat-a2ui   A2UI 协议类型 + 渲染器
packages/ui     @xinjiyuan97/chat-ui     组件 + design token + 默认 A2UI 组件集
apps/docs                          Storybook（文档站 + 调试台）
```

依赖方向严格单向：`a2ui → core`，`ui → core + a2ui`。core 不依赖任何 UI，可以单独拿去接自己的设计系统。

---

## 安装

```bash
pnpm add @xinjiyuan97/chat-ui @xinjiyuan97/chat-core @xinjiyuan97/chat-a2ui
```

Peer：React 18.2+ 或 19。产物带 `"use client"`，Next.js App Router 直接引即可。

### 样式

已经在用 Tailwind v4：

```css
/* app.css */
@import 'tailwindcss';
@import '@xinjiyuan97/chat-ui/tokens.css';

/* 让 Tailwind 扫到组件里的类名，避免重复生成一份 */
@source '../node_modules/@xinjiyuan97/chat-ui/dist';
```

没用 Tailwind：

```ts
import '@xinjiyuan97/chat-ui/style.css'
```

暗色主题就是 `<html class="dark">` 一个类，没有别的开关。

---

## 最小示例

```tsx
'use client'

import { createSSETransport, useChat } from '@xinjiyuan97/chat-core'
import {
  ChatContainer,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  Message,
  PromptInput,
} from '@xinjiyuan97/chat-ui'

const transport = createSSETransport({ url: '/api/chat' })

export function Chat() {
  const chat = useChat({ transport })

  return (
    <ChatThemeProvider locale="zh-CN">
      <ChatContainer className="h-dvh">
        <ChatViewport>
          <ChatMessageList busy={chat.isLoading}>
            {chat.messages.map((message) => (
              <Message key={message.id} message={message} onRegenerate={() => chat.regenerate()} />
            ))}
          </ChatMessageList>
        </ChatViewport>

        <PromptInput
          onSubmit={(text) => chat.send(text)}
          onStop={chat.stop}
          streaming={chat.isLoading}
        />
      </ChatContainer>
    </ChatThemeProvider>
  )
}
```

---

## 消息模型

一条 assistant 消息是 **parts 数组**，不是一个 content 字符串 —— 因为它天然是「思考 → 工具调用 → 文本 → 卡片」的混合序列：

```ts
type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; durationMs?: number }
  | {
      type: 'tool'
      toolCallId: string
      name: string
      state: ToolState
      input?: unknown
      output?: unknown
      error?: string
    }
  | { type: 'a2ui'; surfaceId: string; spec: A2UINode; resolved?: boolean }
  | { type: 'permission'; request: PermissionRequest; resolution?: PermissionResolution }
  | { type: 'todo'; todoId: string; items: TodoItem[]; title?: string }
  | { type: 'file' | 'source' | 'error' | 'custom' /* … */ }
```

`MessageContent` 按 `part.type` 分派；传 `renderPart` 可以逐 part 接管，返回 `undefined` 则回退到默认渲染。

---

## 权限审批与任务清单

agent 循环里绕不开的两块交互。都是一等 part —— transport 里 emit 事件就渲染，不用在视图层接线。

### 权限审批

```ts
// agent 要跑命令、写文件、发外部请求之前，先停下来问人
emit({
  type: 'permission-request',
  request: {
    id: 'req-1',
    toolName: 'bash',
    toolCallId: 't1', // 关回它所属的 ToolPart
    detail: 'rm -rf node_modules', // 被审批的东西本身，等宽块原样显示
    risk: 'high', // 'low' | 'medium' | 'high'，只影响整卡着色
  },
})
```

```tsx
<ChatThemeProvider
  onPermissionDecision={(resolution) => {
    // resolution.decision: 'allow-once' | 'allow-always' | 'deny'
    // 'allow-always' 要不要记住、拒绝之后 agent 怎么恢复，都是宿主的决定 —— 库不替你做
    void resumeAgent(resolution)
  }}
>
```

**内联在消息流里，不是弹窗。** 弹窗会盖住导致这次请求的推理和工具调用，而那正是判断该不该批准所需的上下文；而且弹窗答完就消失，transcript 里留不下痕迹。这张卡审批完原地塌成一行只读记录。

键盘按终端菜单的习惯：`↑` `↓` 循环、数字键 `1`–`9` 直接提交、`Enter` 提交当前项、`Esc` 等于「拒绝」。「拒绝」选中后展开理由框而不立即提交 —— 「别这么做，换个方式」是回给模型信息量最大的答案；理由留空也能提交，没有解释的「不」仍然是有效回答。

服务端策略自动放行、或者用户在另一个端上批了，走 `permission-resolved` 事件把结果补进来。本地点击不经过 reducer，直接走上面的回调。

状态机在 `usePermissionMenu` 里，不用这套皮的话 hook 单独拿走：

```ts
const menu = usePermissionMenu({ request, onDecide })
// → { options, activeIndex, activeOption, reason, setReason, canSubmit,
//     choose, submit, onKeyDown, settled, … }
```

### 任务清单

```ts
emit({
  type: 'todo',
  todoId: 'plan', // 重发同一个 id 是原地替换，不是追加
  items: [
    { id: '1', title: '通读 auth.ts 的刷新路径', status: 'completed' },
    {
      id: '2',
      title: '加共享 in-flight promise',
      status: 'in-progress',
      activeTitle: '正在改 getToken',
    },
    { id: '3', title: '补回归测试', status: 'pending' },
  ],
})
```

`todoId` 是长任务能读得下去的关键：agent 一轮跑下来会改十几次计划，每次追加会把对话冲掉。

推进中默认展开、全部完成后默认收起（和推理块同一条规则），用户手动切过就永远听用户的。**取消项不计入分母** —— 砍掉最后两步的计划是*做完了*，进度条永远停在 5/7 会被读成卡住了；它们仍然带删除线留在列表里。

默认只读：计划是 agent 的，渲染一排点不动的假勾选框比不渲染更糟。要把编辑权交回用户，直接用 `TodoList` 并传 `onToggle`：

```tsx
<TodoList items={items} onToggle={(item, next) => update(item.id, next)} />
```

---

## 多模态输入：附件与语音

两个 headless hook，`PromptInput` 只是把它们画出来。不用这套 UI 的话，hook 单独拿走即可。

```tsx
import { useAttachments, useVoiceInput } from '@xinjiyuan97/chat-core'

const attachments = useAttachments({
  accept: 'image/*,application/pdf,.md',
  maxSize: 5 * 1024 * 1024, // 默认 10MB
  maxFiles: 6, // 默认 10
  // 不传 onUpload：文件被读成 data URL，直接进 message.parts，不需要任何后端
  onUpload: async (file, { signal }) => uploadToYourStorage(file, signal), // 传了就先传后发
  onError: (code, file) => toast(`${file.name}: ${code}`), // 'too-large' | 'wrong-type' | 'too-many'
})

const voice = useVoiceInput({ lang: 'zh-CN' })

<PromptInput
  attachments={attachments}
  voice={voice}
  showImageButton
  onSubmit={(text, { parts }) => void chat.send(text, { parts })}
/>
```

附件三种入口都通：点回形针、把文件拖到输入框上、直接 `Ctrl/⌘+V` 粘贴截图。超限或类型不符的文件会在列表里标红，而不是被静默丢弃 —— 用户至少要知道那张图没发出去。上传未完成时发送按钮是禁用的，否则模型会收到一个还没就绪的链接。

`onUpload` 是否要传，取决于文件大小：data URL 把整个 payload 塞进请求体，截图和日志没问题，40MB 的视频就不行了。

### ⚠️ 浏览器原生语音识别不是本地识别

`useVoiceInput` 有两种模式，由是否传 `transcribe` 决定：

| 传了 `transcribe`？ | 模式       | 行为                                                                    |
| ------------------- | ---------- | ----------------------------------------------------------------------- |
| 否（默认）          | `native`   | 浏览器的 `SpeechRecognition`，边说边出字，**但只有 Chromium 系支持**    |
| 是                  | `recorder` | `MediaRecorder` 录音，停止后把 Blob 交给你的 `transcribe`，全浏览器可用 |

关键一点：**Chrome 的 `SpeechRecognition` 会把音频送到 Google 的服务器做识别**，不是在本地跑模型。这对多数产品无所谓，但如果你的用户会对着麦克风念客户名、病历或者内部代号，那就不行 —— 这种场景请传 `transcribe`，音频只会去你自己指定的那个服务：

```ts
const voice = useVoiceInput({
  maxDurationMs: 60_000,
  transcribe: async (audio, { signal }) => {
    const body = new FormData()
    body.append('audio', audio)
    const res = await fetch('/api/transcribe', { method: 'POST', body, signal })
    return (await res.json()).text
  },
})
```

两种模式下 `voice.supported` 都是**先 `false`、挂载后才检测**：服务端渲染时两个 API 都不存在，直接在 render 里判断会产生客户端立刻推翻的 HTML。麦克风按钮在不支持的浏览器里**整个不渲染**——一个永远置灰的图标看起来像坏了，而它不在则读作「这个浏览器没这功能」。

### 模型选择

传 `models` 就多一个选择器，不传就没有：

```tsx
import type { ChatModel } from '@xinjiyuan97/chat-core'

const models: ChatModel[] = [
  { id: 'fast', name: '快速模型', description: '日常问答', badge: '默认' },
  { id: 'deep', name: '深度推理', description: '复杂重构，明显更慢', badge: 'Pro' },
  { id: 'vision', name: '视觉模型', description: '当前工作区未开通', disabled: true },
]

<PromptInput models={models} model={model} onModelChange={setModel} />
```

受控（`model` + `onModelChange`）和非受控（`defaultModel`）都行。组件**不做 id → endpoint 的映射**，选中的 id 原样回给你，怎么用是 transport 那一层的事 —— 所以同一个选择器可以并排列 OpenAI 模型、本地 Ollama 和「快 / 慢」两个预设。

`ModelSelect` 也单独导出，可以放进消息头或者你自己的工具栏（默认向上展开，传 `placement="bottom"` 改方向）。

---

## 代码块：复制、运行、Mermaid

复制和自动换行是内置的，hover 或键盘 focus 时出现在代码块右上角。

### 运行按钮

默认没有。给 provider 传 `onRunCode`，回复里每个代码块就都多一个运行按钮和一个结果面板：

```tsx
<ChatThemeProvider
  onRunCode={async (code, language) => {
    const res = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ code, language }) })
    const { ok, stdout, ms } = await res.json()
    return { status: ok ? 'ok' : 'error', output: stdout, durationMs: ms }
  }}
>
```

也可以只给某一个 `CodeBlock` 传 `onRun`，或者用 `runnable={false}` 把某一块的按钮关掉。想自己管状态就传受控的 `result` / `running`。

> **本库不执行任何代码。** 没有 `eval`，没有 Worker，没有隐式 fetch。`onRunCode` 是一个口子，跑在哪里（沙箱 iframe、后端容器、或者干脆不跑）由你决定 —— 聊天记录里的代码是模型输出，这个决定不该由渲染器替你做。

### Mermaid

` ```mermaid ` 围栏会渲染成图表。`mermaid` 是**可选的 peer 依赖**，装了才有：

```bash
pnpm add mermaid
```

没装、渲染失败、或者模型写错了语法，围栏就退化成普通代码块（错误时还会带上解析器给的那行报错）。模型画了图就是说了话，因为少一个渲染器而把内容整个丢掉是更糟的选择。图表右上角可以随时切回源码。

几条约束：

- 走 `securityLevel: 'strict'` + `htmlLabels: false` —— 图表内容是模型输出，标签留在 SVG 文本里，不进 HTML。
- 源码长度（20k 字符）和边数（300）都有上限。Mermaid 的布局是**同步**的，一张跑飞的图不是渲染得难看，是整个标签页卡死。
- 明暗切换会重新渲染。Mermaid 把颜色烤进 SVG，没法像 Shiki 那样一次输出两套 CSS 变量。
- 不想要就 `<ChatThemeProvider mermaid={false}>`，这样连渲染器都不会被 import。
- **不装的话，记得在打包器里把它标成 external**，否则构建会挂在解析不到 `mermaid` 上 —— 见[可选依赖与打包器](#右侧面板与文件预览)那节，预览的三个可选 peer 是同一回事。

---

## 引用：引用块、角标、引用回复

三件不同的事，名字都叫「引用」。

### 引用块与提示框

普通的 `>` 引用是旁白：中性色、细条、可以跳过。第一行是 `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` 时变成提示框，这是 GitHub 的语法，也正是模型被训练出来会写的那一种。

```markdown
> [!WARNING]
> 上线前先确认灰度里没有还在用旧 SDK 的客户端。
```

不认识的标记（比如模型编出来的 `[!DANGER]`）退回普通引用，文字原样保留 —— 总比在正文里留一串裸的方括号强。五个等级的图标形状各不相同（圆、灯泡、气泡、三角、八角），不是同一个圆圈换颜色：色觉障碍下颜色分不出来，轮廓分得出来。

### 行内角标

消息里有 `source` part 时，正文里的 `[1]`、`[1,2]` 会变成上标角标，点一下就展开下方的来源列表、滚到对应那行并高亮。

```ts
parts: [
  { type: 'text', text: '轮换后的 refresh token 不能重复使用 [1]。' },
  { type: 'source', url: 'https://…', title: 'RFC 6749 §6' },
]
```

编号就是 `source` part 在 `parts` 里的位置，**作用域限于这条消息** —— 屏幕上两条回答各有各的 `[1]`。改写只发生在段落、列表项和表格单元格里：行内代码里的 `tokens[1]` 是数组下标，链接文字里的方括号属于链接。越界的编号（只有两条来源却写了 `[9]`）保持原样，误伤基本被这一条挡完了。

### 引用回复

选中回复里的一段，带到输入框上方，像 Slack / Telegram 那样：

```tsx
const [quote, setQuote] = useState<QuotedMessage | null>(null)

<Message message={message} quoteAuthor="助手" onQuote={setQuote} />

<PromptInput
  quote={quote}
  onQuoteRemove={() => setQuote(null)}
  onSubmit={(text, options) => void chat.send(text, { body: { quote: options.quote } })}
/>
```

按钮优先取**选中的文字**，没选中才退回整条消息 —— 值得回复的通常是其中两句话。引用不会被拼进输入框的文字里，而是原样放在 `onSubmit` 的 `options.quote` 上：它最终变成一个 `>` 块、一条独立消息，还是请求里的一个字段，是宿主的决定。条子上的 × 和输入框里的 Esc 都能取消，发送后自动清空。

引用文本按**纯文本**渲染，不解析 Markdown —— 它是模型输出，被引用的 `#` 或图片不该在输入框里变成真的元素。

---

## 会话列表：按 agent 分组

一个 agent 下面挂多个会话是常态。给侧边栏传 `agents`，列表就切成可折叠的分区：

```tsx
import type { Agent } from '@xinjiyuan97/chat-core'

const agents: Agent[] = [
  { id: 'coder', name: '代码助手', description: '读仓库、改代码、跑测试', avatar: '⌘' },
  { id: 'analyst', name: '数据分析' },
]

<ConversationSidebar
  agents={agents}
  conversations={conversations} // 每条带一个可选的 agentId
  activeId={activeId}
  onSelect={setActiveId}
  onNewChatInAgent={(agentId) => createConversation({ agentId })}
  defaultCollapsedAgentIds={['analyst']} // 也可以受控：collapsedAgentIds + onAgentToggle
/>
```

`Conversation.agentId` 是可选的，`agents` 也是可选的 —— 不用 agent 的项目一行都不用改。传了 `agents` 就默认 `groupBy="agent"`，不用再显式写一遍。

几条行为上的约定：

- **`agentId` 指向不存在的 agent，会话归到末尾的「未分配」区，而不是被静默丢弃。** agent 被删掉不该让它的历史对话跟着人间蒸发。
- **没有会话的 agent 照样显示标题**，否则「在这个 agent 下新建对话」没有落点。
- **搜索是全局的**：结果跨所有 agent 展平，每行副标题标注归属。命中藏在折叠区里搜不到，比多一行副标题糟糕得多。
- 置顶是**分区内**的概念，不再有一个全局的置顶组。
- 折叠成 56px 时图标栏放 agent 徽章而不是会话首字。

### 组件不管 agent 的增删改

`Agent` 只有 `id` / `name` / `description` / `avatar`：侧边栏需要一个标签和一个图形，就这些。提示词、模型选择、工具配置属于宿主的设置页 —— 塞进这个类型，一个展示用的数据结构就变成了配置格式，而侧边栏并不是编辑配置的好地方。

组件只做展示、折叠、选择，以及「在这个 agent 下新建会话」这一个回调。创建 / 重命名 / 删除 agent 请自己做界面。

---

## Transport

所有后端格式都归一到同一套 `ChatEvent`，所以换后端不动 UI：

| 工厂函数                   | 用途                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| `createSSETransport`       | 后端直接吐本库的事件格式                                                    |
| `createOpenAITransport`    | 后端转发 OpenAI `chat.completions` 流（含 DeepSeek 的 `reasoning_content`） |
| `createAnthropicTransport` | 后端转发 Anthropic Messages 流（含 `thinking_delta`）                       |
| `createMockTransport`      | 按脚本定时吐事件，Storybook 和单测都用它                                    |

自定义只需实现一个接口：

```ts
interface ChatTransport {
  send(req: SendRequest, ctx: { signal: AbortSignal }): AsyncIterable<ChatEvent>
}
```

### ⚠️ 不要把 API key 放进浏览器

`createOpenAITransport` / `createAnthropicTransport` 面向的是**你自己的代理端点** —— 由你的服务端持有 key、调用上游、把 SSE 原样转发给前端。

这两个 adapter 只负责解析流格式，它们**不会**、也不应该拿到任何凭证。任何走到浏览器里的 key 都等于公开发布：它会出现在打包产物、DevTools 的网络面板和用户的浏览器缓存里，撤销之前一直可用。

```ts
// ✅ 指向自己的服务端
createOpenAITransport({ url: '/api/chat' })

// ❌ 直连上游，key 必然落到客户端
createOpenAITransport({
  url: 'https://api.openai.com/v1/chat/completions',
  headers: { Authorization: `Bearer ${key}` },
})
```

---

## A2UI —— 让 agent 直接吐 UI

Agent 输出一段 JSON spec，渲染成可交互组件，用户操作再作为 action 回传：

```tsx
import { defaultA2UIRegistry } from '@xinjiyuan97/chat-ui/a2ui-registry'

<ChatThemeProvider
  a2uiRegistry={{ ...defaultA2UIRegistry, Chart: MyChart }}
  onA2UIAction={(action, message) => {
    chat.resolveA2UISurface(message.id, action.surfaceId)
    chat.send(`确认：${action.action}`, { body: action.formData })
  }}
>
```

表单状态存在 renderer 内部，`onAction` 时把整个 surface 的 `formData` 一起回传 —— agent 不必逐字段同步。

### spec 是模型输出，按不可信输入处理

这块的约束是硬性的，扩展 registry 时请一并遵守：

- **绝不 eval。** `{{path}}` 只做安全的路径查找（拒绝原型链和继承属性），`when` 只支持 `path` / `!path` / `path == 'literal'` 三种形式，看不懂的一律判 false —— 少渲染一个节点，好过渲染出 agent 没打算要的东西。
- 节点数（默认 500）和深度（默认 20）都有上限，超了降级成提示而不是把页面拖死。
- props 会被过滤：`dangerouslySetInnerHTML`、`on*` 字符串处理器、`javascript:` 和 `data:text/html` 链接在到达组件之前就被剥掉。
- 未注册的 `type` 走 fallback，组件抛错被 ErrorBoundary 拦在 surface 内 —— 一张坏卡片不该带走整条消息。
- 默认组件集里**没有任何能导航、发请求或执行代码的东西**。往 registry 里加组件，等于把那个能力交给模型输出，加之前先想清楚。

---

## 右侧面板与文件预览

`ChatWorkspace` 是三栏外壳，右边那栏是 `SidePanel`。**右栏不知道自己在显示什么** —— 每个面板项只带一个不透明的 `kind` 和一坨 `data`，由注册表决定谁来画。文件预览只是其中一个 kind，所以同一根柱子以后放 diff、放运行日志、放设置面板，`SidePanel` 一行都不用改。

因此注册表是**两层**的：

```
SidePanel(kind 注册表) → kind: 'file' → FilePreview → previews(文件类型注册表) → 渲染器
                                                                    ↘ 没匹配上 → UnsupportedPreview
```

接起来一共两行：

```tsx
import { ChatWorkspace, SidePanel, filePreviewPanel, folderPanel } from '@xinjiyuan97/chat-ui'
import { useSidePanel } from '@xinjiyuan97/chat-core'

const panel = useSidePanel()

<ChatThemeProvider panels={{ file: filePreviewPanel, folder: folderPanel }}>
  <ChatWorkspace side={<ConversationSidebar … />} panel={<SidePanel panel={panel} />}>
    …
  </ChatWorkspace>
</ChatThemeProvider>

// 打开一个文件
panel.open({ id: path, kind: 'file', title: name, data: { file: { name, url } } })
// 打开一整个文件夹，左树右预览
panel.open({ id: repo, kind: 'folder', title: repo, data: { nodes } })
```

一个 `PreviewFile` 有三种给内容的方式，给哪种用哪种：`content`（已经在内存里）、`url`（远程地址）、`load()`（要用的时候才去取 —— 大文件不该在开标签的瞬间就下载）。

### 开箱支持的格式

| 类型 | 后缀 | 靠什么 | 说明 |
| --- | --- | --- | --- |
| PDF | `.pdf` | `pdfjs-dist`（可选 peer） | 翻页、跳页、缩放、适应宽度；只渲染视口附近的页 |
| 图片 | `.png` `.jpg` `.gif` `.webp` `.avif` `.svg` … | 无 | 滚轮缩放（锚在指针处）、拖拽平移、双击复位 |
| Markdown | `.md` `.markdown` `.mdx` | 无 | 渲染 / 原文切换 |
| HTML | `.html` `.htm` | 无 | 无脚本 sandbox iframe，见下 |
| 文本与代码 | `.txt` `.log` `.json` `.yaml` 及约 90 种源码后缀 | 无 | 复用消息里那套 Shiki 高亮 |
| Word | `.docx` | `docx-preview`（可选 peer） | 带前缀隔离，样式不外漏 |
| Excel | `.xlsx` `.xlsm` | `exceljs`（可选 peer） | 只用它解析，表格是我们自己用 token 画的 |
| 幻灯片 | `.pptx` `.ppt` | —— | **不解析**，只显示宿主转好的产物，见下 |

三个可选 peer 装了才有：

```bash
pnpm add pdfjs-dist docx-preview exceljs   # 按需，三个都是独立的
```

**没装不是错误**，是兜底页里的一句「预览这种文件需要安装 X」加一条 `pnpm add`。运行时一个都没装也照常工作 —— 渲染器的 `import()` 失败被吞掉，落到兜底页。

但**打包器需要你告诉它这些依赖是可选的**。渲染器里是 `import('exceljs')` 这种静态可分析的裸标识符，Rollup / webpack 解析不到就直接把构建判失败（Vite 的报错原文是 `Rollup failed to resolve import "exceljs"`）。一行配置的事，同一份名单也适用于 `mermaid`：

```ts
// vite.config.ts —— 只列你没装的那几个
export default defineConfig({
  build: { rollupOptions: { external: ['pdfjs-dist', 'docx-preview', 'exceljs', 'mermaid'] } },
})
```

```js
// next.config.js / webpack
config.externals.push('pdfjs-dist', 'docx-preview', 'exceljs', 'mermaid')
```

配好之后构建通过，运行时那个 `import()` 解析不到裸标识符、被 `.catch` 接住，页面上就是兜底页，控制台干净。**装了的那几个不要列进去**，列了就永远走兜底页。

### PDF 需要宿主给 worker

pdf.js 的解析跑在 Web Worker 里，worker 文件的地址只有宿主的构建工具知道。我们**不去猜、也不打 CDN**：内网离线部署会静默失败，版本对不上时 pdf.js 报的错基本没法自查。所以要求传一个 `pdfWorkerSrc`，不传就是兜底页里的「PDF 预览需要先配置 worker」加下面这段片段。

```tsx
// Vite
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Next.js（把 worker 复制到 public/ 之后）
const pdfWorkerSrc = '/pdf.worker.min.mjs'

<ChatThemeProvider pdfWorkerSrc={pdfWorkerSrc}>
```

### .pptx 只吃转换产物

一份 deck 是绝对定位的形状、主题继承、内嵌字体、SmartArt 和动画。目前没有保真度可接受的纯前端 pptx 渲染器 —— 文字会跑到它本该所属的形状之外，而读者没有任何办法判断自己看到的是不是错的。**安静地错比不显示更糟**，所以我们不做这件事。

宿主在服务端用 LibreOffice 之类转好之后，挂在 `converted` 上：

```ts
const file: PreviewFile = {
  name: '发布评审.pptx',
  converted: { kind: 'pdf', file: { name: '发布评审.pdf', url: '/converted/review.pdf' } },
  // 或者逐页图片：{ kind: 'images', pages: [{ name: '1.png', url: … }, …] }
}
```

不给就落到兜底页，明说需要服务端转换。

### ⚠️ HTML 预览是无脚本的 sandbox iframe

`.html` 的渲染走 `<iframe srcdoc sandbox="">` —— **空 sandbox，`allow-scripts` 是刻意不给的**。文件是 agent 输出，直接内联到宿主 DOM 里意味着：一个 `<script>` 就带着宿主的 cookie 和 origin 跑起来了，一条 `position: fixed` 就盖在聊天界面上了，这两件事都不是转义字符串能解决的。

sandbox 之后，脚本不跑、`javascript:` 不解析、表单不提交、frame 不能导航顶层窗口，而且拿到不透明源、碰不到宿主的 storage 和 DOM。这些全部由浏览器强制。

**所以这里没有 DOMPurify。** sanitizer 是一份要追着新绕过手法跑的黑名单，sandbox 是引擎级的能力开关。代价是带脚本的文档（图表、交互报表）会渲染成静态版本 —— 对一个预览面板来说这个取舍是对的。

### 注册自己的预览类型

一个 `previews` prop 就够了：

```tsx
import { ChatThemeProvider, definePreview, TableIcon } from '@xinjiyuan97/chat-ui'

const previews = {
  // 新增一种内置完全不认识的格式
  ndjson: definePreview({
    extensions: ['ndjson', 'jsonl'],
    mediaTypes: ['application/x-ndjson'],
    icon: TableIcon,
    render: ({ file, close }) => <MyLogTable file={file} onClose={close} />,
  }),

  // 覆盖内置的 markdown 渲染器 —— 没有反注册这一步
  markdown: definePreview({ extensions: ['md', 'markdown'], render: MyMarkdown }),
}

<ChatThemeProvider previews={previews} panels={{ file: filePreviewPanel }}>
```

匹配顺序就是全部的规则：**宿主的精确 mediaType → 宿主的后缀 → 宿主的 mediaType 通配（`image/*`）→ 内置的同样三轮 → 都没有则兜底页**。宿主的条目天然排在内置前面，所以「换掉我们的某个渲染器」和「加一种新格式」是同一件事。

匹配是声明式的 `extensions` / `mediaTypes`，不是 `match(file) => boolean`：一个不透明的谓词无法排序、无法解释「凭什么是它接管了」，也没法变成上面那张支持格式表。文件树的图标也从这张注册表里取，新注册的格式在树里自动就是它自己的图标，没有第二份列表要维护。

想整个换掉内置那批，`BUILTIN_PREVIEWS` 是导出的，可以挑一个出来复用（`BUILTIN_PREVIEWS.markdown.render`），也可以完全不要。

### 兜底页

不支持的类型不是「无法预览」四个字。七种原因各有各的说法和各自的按钮，因为少一个可选依赖是一条 `pnpm add` 能解决的，缺 worker 是一个 prop，文件太大是改成下载 —— 塞进同一句话就把唯一有用的部分丢掉了：

`unsupported-type` · `renderer-missing` · `needs-config` · `too-large` · `fetch-failed` · `render-failed` · `converted-artifact-missing`

**一处危险红都没有。** 红色留给 agent 真的失败了的时候；渲染不了 `.psd` 是一个不渲染 Photoshop 文件的库的正常状态，把它画成红的只会教用户不信任这个颜色。渲染器抛错也被 error boundary 拦在面板里 —— 一个坏 xlsx 不该带走整个聊天页面。

### 文件树

`FileTree` 是 `useFileTree` 的皮，`FolderPreview` 把它和预览拼成左树右预览（面板窄于 480px 时自动变成「树 → 点开进详情 → 返回」的两级）。省略 `children` 表示「还没加载」，配合 `onExpand` 做懒加载；给空数组才表示「确实是空目录」。

**整棵树只有一个 tab 停靠点**（roving tabindex）—— 四百个文件挨个 tab 过去不叫导航。进树以后 ↑↓ 移动、→ 展开或进入第一个子节点、← 折叠或回到父节点、Home/End 跳两端、Enter 打开。键盘导航只走已渲染的行，光标不会掉进折叠起来的子树里。

---

## 开发

```bash
pnpm install
pnpm storybook      # 主验收台，localhost:6006
pnpm test           # vitest
pnpm typecheck      # 每个包各跑一次 tsc --noEmit
pnpm lint
pnpm build          # tsup + tailwind
```

组件的视觉约定写在 [CONTRIBUTING.md](./CONTRIBUTING.md) 里，加组件前先看一眼，不然很容易跑偏。

### 集成冒烟

`examples/next-app` 是一个 Next.js App Router 页面，**从 node_modules 里吃构建产物**（不是源码别名），
用来兜住三件 Storybook 看不见的事：`"use client"` 有没有活着进 dist、SSR 会不会 hydration mismatch、
Tailwind 的 `@source` 能不能扫穿 pnpm 的软链。

```bash
pnpm build                                    # 先出 dist，example 依赖它
pnpm --filter @agent-chat/example-next-app dev # localhost:3100
```

`app/api/chat/route.ts` 是一个自吐脚本流的 SSE 端点，顺带演示代理端点该长什么样 —— 真实部署里
凭证留在这一层，前端只认识 `/api/chat`。

### 发布

Changesets 管版本，三个包锁在同一个版本号上（`fixed`）。

```bash
pnpm changeset       # 描述这次改动
pnpm release         # build + changeset publish
```

CI（`.github/workflows/ci.yml`）跑 typecheck / lint / test / build，外加一条断言：dist 里每个产物
的首行必须还是 `"use client"`。这个 banner 丢过一次（tsup 的 `treeshake` 会静默吃掉它），除了这条
断言没有别的地方会发现。

## License

MIT
