# @agent-chat/core

Agent 聊天界面的**无 UI 内核**：类型、store、transport、hooks。不含任何组件、样式或 CSS —— 想接自己的设计系统，只装这一个包就够了。

配套的组件在 [`@agent-chat/ui`](../ui)，完整文档在[仓库根 README](../../README.md)。

```bash
pnpm add @agent-chat/core
```

Peer：React 18.2+ 或 19。

---

## 消息模型

一条 assistant 消息是 **parts 数组**，不是一个 content 字符串 —— 它天然是「思考 → 工具调用 → 文本 → 卡片」的混合序列，而顺序本身就是信息：工具调用**之后**的那段文字，必须出现在它之后。

```ts
type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; durationMs?: number }
  | { type: 'tool'; toolCallId: string; name: string; state: ToolState; input?: unknown; output?: unknown }
  | { type: 'a2ui'; surfaceId: string; spec: A2UINode; resolved?: boolean }
  | { type: 'file' | 'source' | 'error' | 'custom' /* … */ }
```

其余公开类型：`ChatMessage`、`Conversation`、`Agent`、`ChatModel`、`QuotedMessage`、`Reaction`、`TokenUsage`、`ChatEvent`。

## useChat

```ts
const chat = useChat({ transport })

chat.messages // ChatMessage[]
chat.status // 'idle' | 'submitted' | 'streaming' | 'error'
chat.isLoading // 请求在飞就是 true，不等第一个 token
chat.send(text, options)
chat.stop()
chat.regenerate()
chat.editAndResend(messageId, text)
chat.toggleReaction(messageId, key)
chat.resolveA2UISurface(messageId, surfaceId)
chat.store // zustand store，给需要在 React 之外读写的场景
```

**受控与非受控是同一个 hook。** 不传 `messages` 就用内置 store；传了 `messages` + `onMessagesChange`，消息数组归你管，store 退化成一个流式解析器。两种模式共用一套代码路径，不是两个 API。

## Transport

后端格式的差异全部收敛在这一层，归一到同一套 `ChatEvent`，所以换后端不动 UI：

| 工厂函数                   | 用途                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `createSSETransport`       | 后端直接吐本库的事件格式                                                   |
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

`createOpenAITransport` / `createAnthropicTransport` 面向的是**你自己的代理端点**：服务端持有 key、调用上游、把 SSE 原样转发给前端。这两个 adapter 只解析流格式，不该拿到任何凭证 —— 任何走到浏览器里的 key 都等于公开发布，它会出现在打包产物、DevTools 网络面板和用户缓存里，撤销之前一直可用。

```ts
createSSETransport({ url: '/api/chat' }) // ✅ 指向自己的服务端
```

## Hooks

| Hook                    | 用途                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| `useChat`               | 消息状态 + 流式收敛，上面那套                                         |
| `useSmoothText`         | 打字机效果：按帧匀速吐字，抹平网络的忽快忽慢                          |
| `useStickToBottom`      | 贴底滚动，用户一往上翻就松手                                          |
| `useConversationList`   | 会话按日期分组（今天 / 昨天 / 本周 / 更早）                           |
| `useAgentConversations` | 会话按 agent 分区，含全局搜索；纯函数 `groupConversationsByAgent` 同时导出 |
| `useAttachments`        | 附件：选择 / 拖入 / 粘贴，限额校验，可挂上传钩子                      |
| `useVoiceInput`         | 语音输入，见下                                                        |
| `useReactions`          | reaction 的受控 / 非受控切换                                          |
| `useCopyToClipboard`    | 复制 + 一次性的「已复制」状态                                         |
| `useAutoResizeTextarea` | 输入框跟着内容长高，到上限转滚动                                      |

### ⚠️ 浏览器原生语音识别不是本地识别

`useVoiceInput` 不传 `transcribe` 时走浏览器的 `SpeechRecognition`，而 **Chrome 会把音频送到 Google 的服务器**做识别，不是在本地跑模型。用户会对着麦克风念客户名、病历或内部代号的场景，请传 `transcribe`：改走 `MediaRecorder`，音频只会去你指定的那个服务，顺带全浏览器可用。

## License

MIT
