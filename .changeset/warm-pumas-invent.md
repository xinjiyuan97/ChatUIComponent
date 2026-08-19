---
'@agent-chat/core': minor
'@agent-chat/ui': minor
---

模型选择、Mermaid 图表、可运行代码块

- 新增 `ChatModel` 类型和 `ModelSelect` 组件；`PromptInput` 新增 `models` / `model` / `defaultModel` / `onModelChange`。不传 `models` 就没有选择器。组件**不做 id → endpoint 的映射**，选中的 id 原样回给宿主 —— 所以同一个选择器可以并排列远端模型、本地模型和「快 / 慢」预设。
- ` ```mermaid ` 围栏渲染成图表。`mermaid` 是**可选的 peer 依赖**（`pnpm add mermaid`），没装、渲染失败或语法有误时退化成普通代码块，不会丢内容。走 `securityLevel: 'strict'` + `htmlLabels: false`，并对源码长度与边数设上限 —— Mermaid 的布局是同步的，一张跑飞的图会卡死整个标签页。明暗切换会重新渲染（颜色烤在 SVG 里，没法像 Shiki 那样走 CSS 变量）。用 `<ChatThemeProvider mermaid={false}>` 可以整个关掉。
- 代码块新增可选的运行按钮：`ChatThemeProvider` 上的 `onRunCode` 一次性给所有代码块开启，单个 `CodeBlock` 可以用 `onRun` 覆盖或 `runnable={false}` 关掉，结果面板区分成功 / 失败 / 空输出，也支持受控的 `result` / `running`。

  **本库不执行任何代码** —— 没有 `eval`，没有 Worker。`onRunCode` 默认不存在，也就默认没有运行按钮：聊天记录里的代码是模型输出，在哪里跑（沙箱 iframe、后端容器、或者不跑）是宿主的决定。
