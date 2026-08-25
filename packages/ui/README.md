# @xinjiyuan97/ui

给 agent 项目复用的 React 聊天组件：流式输出、思考过程、function call、Markdown、代码块、reaction、会话列表，以及一个让 agent 直接吐 UI 的 A2UI 口子。

视觉走清爽极简（Claude / Linear 风）：AI 回复不套气泡、折叠块只用一条细线、强调色一次只出现在一个地方。

完整文档在[仓库根 README](../../README.md)，可交互的组件目录在 Storybook（`pnpm storybook`）。

```bash
pnpm add @xinjiyuan97/ui @xinjiyuan97/core @xinjiyuan97/a2ui
```

Peer：React 18.2+ 或 19。产物带 `"use client"`，Next.js App Router 直接引即可。

## 样式

已经在用 Tailwind v4：

```css
@import 'tailwindcss';
@import '@xinjiyuan97/ui/tokens.css';

/* 让 Tailwind 扫到组件里的类名，避免重复生成一份 */
@source '../node_modules/@xinjiyuan97/ui/dist';
```

没用 Tailwind：

```ts
import '@xinjiyuan97/ui/style.css'
```

暗色主题就是 `<html class="dark">` 一个类，没有别的开关。所有颜色是 oklch 的 CSS 变量，改 token 就能整体换皮。

---

## 最小示例

```tsx
'use client'

import { createSSETransport, useChat } from '@xinjiyuan97/core'
import {
  ChatContainer,
  ChatMessageList,
  ChatThemeProvider,
  ChatViewport,
  Message,
  PromptInput,
} from '@xinjiyuan97/ui'

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
- **A2UI**：`a2uiRegistry={{ ...defaultA2UIRegistry, Chart: MyChart }}`，默认组件集从 `@xinjiyuan97/ui/a2ui-registry` 引入。
- **代码运行**：`onRunCode` 不传就没有运行按钮。**本库不执行任何代码** —— 没有 `eval`、没有 Worker、没有隐式 fetch，跑在哪里由你决定。
- **Mermaid**：` ```mermaid ` 围栏渲染成图，`mermaid` 是可选 peer 依赖（`pnpm add mermaid`）；没装或语法有误就退化成代码块，不会把内容丢掉。

## License

MIT
