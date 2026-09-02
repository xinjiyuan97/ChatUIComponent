# @xinjiyuan97/chat-a2ui

## 0.3.0

### Patch Changes

- Updated dependencies [46a2a02]
- Updated dependencies [46a2a02]
  - @xinjiyuan97/chat-core@0.3.0

## 0.2.0

### Minor Changes

- b6023c0: 首个版本。

  - `core`：parts 消息模型、归一化 `ChatEvent`、zustand store、`useChat`（受控 / 非受控双模式）、
    `useSmoothText` / `useStickToBottom` 等 hooks，以及 SSE / OpenAI / Anthropic / mock 四个 transport。
  - `a2ui`：JSON → UI 的协议、模板与条件求值、渲染器，以及不 eval、限深度节点数、过滤危险 props 的安全边界。
  - `ui`：design token（oklch，`.dark` 一行切换）、消息与 parts 渲染器、Markdown + Shiki、打字机、
    输入框（含 IME 组合态处理）、reaction、会话列表（>100 条自动虚拟滚动），以及 `@xinjiyuan97/chat-ui/a2ui-registry`
    默认组件集。

### Patch Changes

- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
- Updated dependencies [7de216e]
- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
  - @xinjiyuan97/chat-core@0.2.0
