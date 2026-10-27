# @xinjiyuan97/chat-ui

给 agent 项目复用的 React 聊天组件：流式输出、思考过程、function call、Markdown、代码块、reaction、会话列表，以及一个让 agent 直接吐 UI 的 A2UI 口子。

视觉走清爽极简（Claude / Linear 风）：AI 回复不套气泡、折叠块只用一条细线、强调色一次只出现在一个地方。

完整文档在[仓库根 README](../../README.md)，可交互的组件目录在 Storybook（`pnpm storybook`）。

```bash
pnpm add @xinjiyuan97/chat-ui @xinjiyuan97/chat-core @xinjiyuan97/chat-a2ui
```

Peer：React 18.2+ 或 19。产物带 `"use client"`，Next.js App Router 直接引即可。

## 样式

已经在用 Tailwind v4：

```css
@import 'tailwindcss';
@import '@xinjiyuan97/chat-ui/tokens.css';

/* 让 Tailwind 扫到组件里的类名，避免重复生成一份 */
@source '../node_modules/@xinjiyuan97/chat-ui/dist';
```

没用 Tailwind：

```ts
import '@xinjiyuan97/chat-ui/style.css'
```

暗色主题就是 `<html class="dark">` 一个类，没有别的开关。所有颜色是 oklch 的 CSS 变量，改 token 就能整体换皮。

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

## 组件一览

| 分组     | 组件                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| 布局     | `ChatThemeProvider` `ChatContainer` `ChatViewport` `ChatMessageList` `ChatEmptyState` `ScrollToBottomButton` |
| 消息     | `Message` `MessageContent` `MessageActions` `MessageAvatar` `MessageTimestamp`                               |
| Part     | `TextPart` `ReasoningPart` `ToolCallPart` `A2UIPart` `FilePart` `SourcesPart` `ErrorPart` `JsonViewer`       |
| 输入     | `PromptInput` `AttachmentList` `SuggestionChips` `QuotePreview` `ModelSelect` `VoiceButton`                  |
| Markdown | `Markdown` `CodeBlock` `Mermaid` `Blockquote` `Citation`                                                     |
| 流式     | `TypingText` `StreamingCursor` `ThinkingDots` `LoadingShimmer`                                               |
| 反馈     | `CopyButton` `RegenerateButton` `EditButton` `QuoteButton` `ShareButton` `FeedbackButtons` `ReactionBar`     |
| 会话     | `ConversationSidebar` `ConversationList` `ConversationItem` `AgentBadge` `AgentSectionHeader`                |

`ChatThemeProvider` 上挂的是全局开关：`locale`（内置 `zh-CN` / `en-US`，也可传自定义 `ChatLocale`）、`density`、`toolRenderers`、`a2uiRegistry`、`onRunCode`、`mermaid`、`typewriter`、`codeThemes`。

## 几个扩展点

- **function call**：`toolRenderers={{ read_file: DiffView }}` 按工具名接管渲染，没注册的走通用 JSON 面板。
- **任意 part**：`<Message renderPart={...} />`，返回 `undefined` 回退到默认渲染。
- **A2UI**：`a2uiRegistry={{ ...defaultA2UIRegistry, Chart: MyChart }}`，默认组件集从 `@xinjiyuan97/chat-ui/a2ui-registry` 引入。
- **代码运行**：`onRunCode` 不传就没有运行按钮。**本库不执行任何代码** —— 没有 `eval`、没有 Worker、没有隐式 fetch，跑在哪里由你决定。
- **Mermaid**：` ```mermaid ` 围栏渲染成图，`mermaid` 是可选 peer 依赖（`pnpm add mermaid`）；没装或语法有误就退化成代码块，不会把内容丢掉。

## License

MIT

## AgentGraph：静态 Agent 无限画布

`AgentGraph` 使用 React Flow 提供画布平移、滚轮／触控缩放、节点拖动、小地图和适应视图，
使用 Dagre 自动排列含循环的订阅图。支持 Mina v2 的具名 Trigger，也能查看 v1 的 `$input` 图快照。
查看 v1 不表示后端支持旧图恢复或迁移。

```tsx
import type { AgentGraphDefinition } from '@xinjiyuan97/chat-core'
import { AgentGraph } from '@xinjiyuan97/chat-ui'
import '@xinjiyuan97/chat-ui/style.css' // Tailwind 项目使用上文 tokens.css 方式
import '@xinjiyuan97/chat-ui/graph.css' // 两种样式接入方式都需要

export function GraphPanel({ definition }: { definition: AgentGraphDefinition }) {
  return (
    <AgentGraph
      definition={definition}
      style={{ height: 640 }}
      nodeStatuses={{ llm: 'running', gate: 'waiting' }}
      onSelectionChange={(selection) => console.log(selection)}
      onPositionsChange={(positions) => console.log(positions)}
    />
  )
}
```

`definition` 保留图文件的字段结构；可由宿主解析，或使用下文的 YAML 解析函数与文件导入组件。点击节点查看配置和输入／输出
事件，点击连线查看订阅 ID、来源、目标及完整事件列表。虚线连接的「运行终态」是生命周期观察点，
不计入算子数量，也不会虚构 `$engine` 的业务订阅。

| 属性                              | 用途                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `definition`                      | 必需，`AgentGraphDefinitionV1` 或 `AgentGraphDefinitionV2`                        |
| `defaultDirection`                | 初始布局方向：`LR`（默认）或 `TB`；工具栏可切换                                   |
| `defaultPositions`                | 初始节点坐标，以节点 ID 为键；未提供的节点自动布局                                |
| `onPositionsChange`               | 拖动结束或重新布局时返回全部坐标，供宿主保存                                      |
| `onSelectionChange`               | 返回 `{kind: 'node', node}`、`{kind: 'connection', connection}` 或 `null`         |
| `nodeStatuses`                    | 宿主提供的 `idle/running/waiting/completed/failed/cancelled` 状态，按实例 ID 索引 |
| `showInspector`                   | 是否显示内置详情面板，默认 `true`                                                 |
| `showMinimap` / `showEventLabels` | 小地图／事件标签的初始可见状态，默认 `true`，工具栏可切换                         |
| `labels`                          | 覆盖文案，默认跟随 `ChatThemeProvider` 的中文／英文设置                           |
| `className` / `style`             | 布局和高度；默认高度 600px，最低 320px                                            |

画布仅可视化，不执行图、发起审批或连接运行服务。拖动不会修改 `definition`，运行状态更新也不会
重置画布位置。定义结构变化会重置选择和视口，配置更新保留视口。Delete 不会删除节点；Esc 关闭当前弹窗或详情。
连线完整保留订阅的事件协议，平行订阅和回环不会丢失。自定义算子显示其原始类型与配置。

`@xinjiyuan97/chat-core` 还导出纯函数 `buildAgentGraph`，可供其他渲染器复用。它检查显示所需的
引用、重复订阅和名称冲突，返回 `nodes`、`connections`、`issues`；它不替代 Mina 的 Schema、
资源绑定、结构可达性或执行预算校验。

Storybook 的 **Agent / Graph** 包含工具循环、纯文本、外部等待、纵向、紧凑嵌入、深色、
手动推进的运行状态、失败、空图、无效引用和 v1 快照示例。

### 节点配置弹窗

点击算子或 Trigger 节点上的「配置」，或详情侧栏的「配置」标题，打开独立弹窗。
不传 `onConfigSave` 时只读查看；传入后提供 JSON 编辑和保存操作：

```tsx
const [definition, setDefinition] = useState<AgentGraphDefinition>(initialDefinition)

<AgentGraph
  definition={definition}
  onConfigSave={async ({ nodeId, kind, config }) => {
    // 宿主校验节点 Schema、持久化修改，并返回最新的完整图定义。
    const updated = await saveNodeConfig({ nodeId, kind, config })
    setDefinition(updated)
  }}
/>
```

`onConfigSave` 接收 `AgentGraphConfigChange`：`{nodeId, kind: 'operator' | 'trigger', config}`，
返回 `void` 或 `Promise<void>`。组件仅校验 JSON 语法和顶层对象；算子配置 Schema、权限与后端
持久化由宿主处理。宿主应在成功后更新 `definition`；组件不会自行修改图或正在执行的 Run。

保存期间禁用重复提交和关闭操作；回调抛出错误时保留草稿并显示错误，可修改后重试。
取消、Esc 或点击遮罩放弃草稿。弹窗使用原生模态对话框，支持键盘焦点约束和关闭后的焦点返回，
并继承当前主题。Storybook 的「配置弹窗 · 可编辑」示例仅把修改保存到当前页面内存。

### 导入 YAML 文件

`AgentGraphFile` 在画布上方增加文件选择按钮，也支持拖入 `.yaml`、`.yml` 或 `.json` 文件。
它使用与 `AgentGraph` 相同的主题和 `graph.css`：

```tsx
import { AgentGraphFile } from '@xinjiyuan97/chat-ui'
import '@xinjiyuan97/chat-ui/style.css'
import '@xinjiyuan97/chat-ui/graph.css'

;<AgentGraphFile
  style={{ height: 720 }}
  onImport={(definition, file) => console.log(file.name, definition)}
/>
```

默认在组件内保存成功导入的定义。可传 `defaultDefinition` 显示初始图；传 `definition` 时进入
受控模式，需要宿主在 `onImport` 中更新它。其余 Graph 属性（含 `onConfigSave`）直接透传。
需要编辑已导入节点时，由宿主保存 `definition`，并在 `onConfigSave` 后更新它。

解析失败或读取失败保留当前图，显示 YAML 行／列或字段路径。支持取消文件选择、重新选择同一个文件，
连续读取时只采用最新一次结果。文件在本地解析，组件不上传文件，也不执行图。

底层也可单独使用：

```ts
import { parseAgentGraphYaml, readAgentGraphFile } from '@xinjiyuan97/chat-core'

const result = parseAgentGraphYaml(yamlText)
// 或：const result = await readAgentGraphFile(file)
if (result.ok) {
  // <AgentGraph definition={result.definition} />
} else {
  console.log(result.issues) // { path, message, line?, column? }[]
}
```

解析器支持单文档 YAML／JSON、图格式 v1／v2、注释和多行文本。拒绝重复键、未知字段、自定义标签、
非字符串映射键、非 JSON 值、循环／过量别名及无效节点引用。文件上限 1 MiB，结构深度上限 64；
`validateAgentGraphDefinition(unknown)` 可用于已解析对象的同一套结构检查。这些检查不替代宿主的
算子 Schema、资源绑定和执行校验。导入后的配置编辑不会自动写回原始文件。

Storybook 的「YAML 文件导入」提供可下载的真实工具图样例，可导入后直接编辑节点配置。
