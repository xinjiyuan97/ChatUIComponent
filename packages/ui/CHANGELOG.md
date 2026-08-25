# @xinjiyuan97/chat-ui

## 0.2.0

### Minor Changes

- b6023c0: 会话列表支持 agent 分组：一个 agent 下面挂多个会话

  **core**：新增 `Agent` 类型和 `Conversation.agentId`，以及 `useAgentConversations` /
  `groupConversationsByAgent`（逻辑在纯函数里，hook 只是 `useMemo` 包一层）。分区顺序跟随传入的
  `agents` 数组，空 agent 保留标题，`agentId` 指向不存在的 agent 时归入「未分配」而不是被丢弃。

  **ui**：`ConversationList` / `ConversationSidebar` 接受 `agents`，并默认切到 `groupBy="agent"`；
  新增 `collapsedAgentIds` / `defaultCollapsedAgentIds` / `onAgentToggle` 受控双模式和
  `onNewChatInAgent`；新增 `AgentBadge` / `AgentSectionHeader`。搜索时跨 agent 展平，每行标注归属。
  agent 模式下容器语义从 `listbox` 换成 `tree`，日期模式不变。

  两个字段都是可选的，不用 agent 的项目无需改动。

- b6023c0: 首个版本。

  - `core`：parts 消息模型、归一化 `ChatEvent`、zustand store、`useChat`（受控 / 非受控双模式）、
    `useSmoothText` / `useStickToBottom` 等 hooks，以及 SSE / OpenAI / Anthropic / mock 四个 transport。
  - `a2ui`：JSON → UI 的协议、模板与条件求值、渲染器，以及不 eval、限深度节点数、过滤危险 props 的安全边界。
  - `ui`：design token（oklch，`.dark` 一行切换）、消息与 parts 渲染器、Markdown + Shiki、打字机、
    输入框（含 IME 组合态处理）、reaction、会话列表（>100 条自动虚拟滚动），以及 `@xinjiyuan97/chat-ui/a2ui-registry`
    默认组件集。

- 7de216e: 新增权限审批菜单与任务清单两个 part

  agent 循环里绕不开的两块交互，之前只能用 `custom` part 自己糊：一块是执行有副作用的动作前的
  人工审批，一块是长任务里的计划推进。现在都是和 `tool` / `a2ui` 同级的一等公民 —— transport
  里 emit 事件就渲染，视图层不用接线。

  **core**：新增 `PermissionPart` / `TodoPart` 及配套类型、`isPermissionPart` / `isTodoPart`
  守卫、纯函数 `getTodoProgress`；新增 `permission-request` / `permission-resolved` / `todo`
  三个事件和对应的 reducer case；新增 `usePermissionMenu`（审批菜单的全部状态机，受控/非受控双模式）
  和 `useTodoProgress`。

  `permission-request` 按 `request.id`、`todo` 按 `todoId` **原地替换**：重发同一个审批请求不能
  在 transcript 里叠出两张卡，agent 一轮改十几次计划也只该留下一个块。`closeDanglingParts`
  不动待审批的 part —— 流结束时挂着一个等人回答的菜单是正常终态，自动改成拒绝是替宿主做了策略决定。

  **ui**：新增 `PermissionMenu` / `TodoList` 和薄封装 `PermissionPart` / `TodoPart`，
  `MessageContent` 自动分派；`ChatThemeProvider` 新增 `onPermissionDecision`；locale 补齐中英文案。

  审批卡内联在消息流里而不是弹窗（弹窗会盖住导致这次请求的上下文，答完还不留痕），审批完原地塌成
  一行只读记录。键盘按终端菜单的习惯：上下键循环、数字键直接提交、`Esc` 等于拒绝，且中文输入法
  拼字时不响应。任务清单默认只读，传 `onToggle` 才可勾选；取消项不计入进度分母。

  纯新增，无破坏性改动。

- b6023c0: 引用：引用块 / 提示框、行内角标、引用回复

  - Markdown 的 `>` 引用重新设计，并支持 GitHub 的 `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]` 提示框。不认识的标记退回普通引用且文字原样保留；五个等级的图标形状各不相同，不依赖颜色区分。
  - 消息里有 `source` part 时，正文中的 `[1]`、`[1,2]` 变成上标角标，点击展开来源列表并高亮对应行。编号作用域限于单条消息；行内代码和越界编号不改写。
  - 新增 `QuotedMessage`、`QuoteButton`、`QuotePreview`：选中回复里的一段带到输入框上方，`PromptInput` 的 `quote` / `onQuoteRemove` 控制，引用随 `onSubmit` 的 `options.quote` 原样回传。

  引用文本按纯文本渲染，不解析 Markdown —— 它是模型输出，被引用的 `#` 或图片不该在输入框里变成真的元素。

- b6023c0: 多模态输入：附件上传与语音输入

  - 新增 `useAttachments`：选择 / 拖拽 / 粘贴三种入口，大小与类型校验，object URL 生命周期管理，逐文件的上传取消。不传 `onUpload` 时文件被读成 data URL 直接进 `message.parts`，传了则先上传再把返回的 URL 放进 parts。
  - 新增 `useVoiceInput`：默认走浏览器原生 `SpeechRecognition`（边说边出字），传 `transcribe(blob)` 则切到 `MediaRecorder` 录音 + 自定义转写服务。能力检测在 effect 里做，SSR 首屏不会出现两端不一致的 DOM。
  - `PromptInput` 接入以上两个 controller，并新增 `attachments` / `voice` / `showImageButton` 三个 prop；`AttachmentList` 支持图片缩略图和上传中 / 失败状态。

  **破坏性变更**：`PromptInput` 的 `onSubmit` 签名由 `(value: string) => void` 改为 `(value: string, options: { parts: FilePart[] }) => void`。原有单参数的调用仍然可用（多出的参数被忽略），但要拿到附件必须读第二个参数：

  ```tsx
  onSubmit={(text, { parts }) => chat.send(text, { parts })}
  ```

- b6023c0: 模型选择、Mermaid 图表、可运行代码块

  - 新增 `ChatModel` 类型和 `ModelSelect` 组件；`PromptInput` 新增 `models` / `model` / `defaultModel` / `onModelChange`。不传 `models` 就没有选择器。组件**不做 id → endpoint 的映射**，选中的 id 原样回给宿主 —— 所以同一个选择器可以并排列远端模型、本地模型和「快 / 慢」预设。
  - ` ```mermaid ` 围栏渲染成图表。`mermaid` 是**可选的 peer 依赖**（`pnpm add mermaid`），没装、渲染失败或语法有误时退化成普通代码块，不会丢内容。走 `securityLevel: 'strict'` + `htmlLabels: false`，并对源码长度与边数设上限 —— Mermaid 的布局是同步的，一张跑飞的图会卡死整个标签页。明暗切换会重新渲染（颜色烤在 SVG 里，没法像 Shiki 那样走 CSS 变量）。用 `<ChatThemeProvider mermaid={false}>` 可以整个关掉。
  - 代码块新增可选的运行按钮：`ChatThemeProvider` 上的 `onRunCode` 一次性给所有代码块开启，单个 `CodeBlock` 可以用 `onRun` 覆盖或 `runnable={false}` 关掉，结果面板区分成功 / 失败 / 空输出，也支持受控的 `result` / `running`。

    **本库不执行任何代码** —— 没有 `eval`，没有 Worker。`onRunCode` 默认不存在，也就默认没有运行按钮：聊天记录里的代码是模型输出，在哪里跑（沙箱 iframe、后端容器、或者不跑）是宿主的决定。

### Patch Changes

- b6023c0: 修复流式代码块与 Mermaid 图的「最后一帧」丢失

  `useHighlightedHtml` 和 `useMermaidSvg` 的排队逻辑里，effect 级的 `cancelled` 标志会在下一次
  delta 到来时把**正在运行**的那次调用标记为已取消，而新的 delta 只是把自己塞进队列就返回了 ——
  于是队列永远没人来取。表现为：一段流式回复结束后，最后一次改动既没有被高亮，也没有被重新排版，
  代码块停在纯文本、Mermaid 停在上一版（很可能还是那版解析失败的半张图）。

  现在陈旧判断放在真正需要它的地方（`setState` 之前），并且比较的是请求内容而不是「队列非空」；
  排队项同时带上 `language` / `theme`，所以流式过程中围栏语言补全、或者排版途中切换明暗主题，
  都不会被丢掉。

- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
- Updated dependencies [7de216e]
- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
- Updated dependencies [b6023c0]
  - @xinjiyuan97/chat-core@0.2.0
  - @xinjiyuan97/chat-a2ui@0.2.0
