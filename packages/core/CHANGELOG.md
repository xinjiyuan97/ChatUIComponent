# @xinjiyuan97/chat-core

## 0.3.0

### Minor Changes

- 668a8bb: File preview for the side panel: a second registry, eight renderers, a file tree, and a
  fallback page that says what is actually wrong.

  **The registry is a second layer, not more entries in the first one.** `SidePanel` indexes by
  `kind`; file preview is one such kind. Teaching that registry about `.xlsx` would make the
  right column — which is meant to hold a diff, a run log or a settings pane later — permanently
  a file viewer. So `previews` is its own registry, indexed by file type, hanging off the `file`
  kind: `SidePanel` → `filePreviewPanel` → `previews` → a renderer, or `UnsupportedPreview` when
  nothing matches. Hosts extend either layer independently.

  Matching is declarative — `extensions` and `mediaTypes`, with `image/*` wildcards — rather than
  a `match(file) => boolean` predicate. A predicate cannot be ordered, cannot explain why it won,
  and cannot be turned into the supported-formats table in the README. **Host registrations beat
  built-ins**, so overriding our Markdown renderer is one `definePreview` with `extensions: ['md']`
  and no deregistration step. The tree takes its file icons from the same registry, so a new
  format is not a second list to maintain.

  **Renderers.** PDF (`pdfjs-dist`) with paging, typed page jump, zoom, fit-width, and only the
  pages near the viewport rendered — a canvas that scrolls away has its backing store released,
  because forty retained page bitmaps is hundreds of megabytes. Images with pointer-anchored wheel
  zoom, drag pan and double-click reset. Markdown and HTML with a rendered/source switch. Text and
  code through the same Shiki highlighter the message fences use, so its ~90 languages arrive for
  free and stay in sync. Word (`docx-preview`) with prefixed containers so its stylesheet cannot
  leak into the host. Excel (`exceljs`) parsed only — the grid is ours, drawn in tokens, with sheet
  tabs, a frozen header row, `numFmt`-aware cell text and a row cap.

  **We do not parse `.pptx`.** A deck is absolutely-positioned shapes, theme inheritance, embedded
  fonts and SmartArt; no front-end renderer reaches acceptable fidelity, and text silently landing
  outside the shape it belongs to is worse than not rendering, because the reader cannot tell which
  kind of output they are looking at. The contract is explicit instead: hand us `file.converted`
  (a server-converted PDF or page images) and it renders; otherwise the fallback page says a
  server-side conversion is needed.

  **PDF needs `pdfWorkerSrc` from the host.** Only your bundler knows where the worker file lands.
  We do not guess and do not reach for a CDN: an offline deployment would fail silently, and a
  version skew between worker and API produces errors nobody can self-diagnose. Missing worker is
  the `needs-config` fallback with copy-pasteable Vite and Next snippets.

  **HTML renders in `<iframe srcdoc sandbox="">` with no `allow-scripts`** — no scripts,
  no `javascript:`, no form submission, no top-level navigation, an opaque origin. Hence no
  DOMPurify: a sanitiser is a denylist that has to keep pace with new bypasses, while the sandbox
  is an engine-level capability switch. The cost is that a scripted document renders as its static
  version, which is the right trade for a preview pane.

  **The fallback page names the cause.** Seven reasons — unsupported type, missing optional
  renderer, missing PDF worker, over the size cap, fetch failed, parse failed, missing converted
  artefact — each with its own sentence and its own buttons, because "cannot preview" throws away
  the only useful part: one is a `pnpm add`, one is a prop, one is "download it instead". None of
  them is drawn in danger red. Same call as `ImagePart`: red means the agent failed at something,
  and a library that does not render Photoshop files has not failed.

  **`FileTree` + `folderPanel`** put a folder in the panel and open a file on selection. One tab
  stop for the whole tree with roving `tabIndex`; navigation walks the _rendered_ rows, so the
  cursor cannot end up inside a subtree you just collapsed. Indentation is `padding-inline-start`
  on the row rather than nested-list margins, so a long name in a deep path still gets the full row
  width. Directories can load on expand.

  **New in core:** `useFileContent` (one state machine over `content` / `url` / `load`, with byte
  caps checked before _and_ after download, and in-flight requests aborted on file switch),
  `useFileTree` (flattened visible rows plus the WAI-ARIA tree key map) and `useImageZoom`
  (anchored zoom, pan, fit).

  **`SidePanel` now scrolls the active tab into view.** The strip scrolls horizontally with its
  scrollbar hidden, so the fourth artefact an agent opened landed past the right edge: the panel's
  contents changed and nothing in the strip moved, which reads as a click that did nothing. Rect
  arithmetic on the strip rather than `scrollIntoView`, which is free to scroll every scrollable
  ancestor — and the transcript beside the panel is one of them.

  One operational note, and it applies to `mermaid` as much as to the three new peers: the
  renderers use statically analysable `import('exceljs')`, so a bundler that cannot resolve the
  specifier fails the build rather than warning. If you do not install one, mark it external —
  one line, documented in the README. With that line the build passes, the import fails at
  runtime, and the fallback page appears with a clean console.

- 668a8bb: A three-column workspace shell with a tabbed, resizable right-hand panel.

  **`ChatWorkspace`** frames conversations, transcript and panel. It is deliberately thin —
  the side columns own their own widths — but it carries the three details every host
  otherwise rediscovers the hard way: `min-w-0` on the middle column, without which one long
  code block widens the transcript and pushes the panel off screen; `relative`, the
  positioning context the panel's narrow-screen overlay needs; and an unbroken `h-full
min-h-0` chain, without which the transcript scrolls the page instead of itself.

  **`SidePanel` knows nothing about what it shows.** Every item carries a `kind` and a `data`
  blob; a `panels` registry on `ChatThemeProvider` decides what draws that kind, exactly as
  `tools` already does for tool calls. Register renderers with `definePanel`, read them back
  with `usePanelDefinition`. `padded: false` lets an image or a PDF reach the panel's edges.
  An unregistered `kind` renders a neutral sentence rather than throwing — what lands in the
  panel is agent output, so a kind you have not seen is normal input, not a bug. This is what
  lets the same column hold a file preview today and a diff, a run log or a settings pane
  later without touching the component.

  **`useSidePanel`** (core) is the tab state. Two behaviours are the point of it: opening an
  id that is already open focuses and refreshes it **in place** rather than appending a
  duplicate or dragging the tab to the end, and closing the active tab activates its **right**
  neighbour, falling back to the left one — jumping back to the first tab is the most
  irritating thing an editor can do here. `max` evicts the oldest tab that is neither active
  nor the one arriving.

  **`useResizablePanel`** (core) is a general one-dimensional drag width, not bound to the
  right column. It uses pointer capture, so a fast drag out of the window or across an iframe
  does not silently stop tracking; it locks `document.body`'s cursor and selection during the
  drag, so dragging horizontally does not paint the transcript blue; the handle is a real
  `role="separator"` with arrow keys, Shift to accelerate, Home/End and double-click to reset,
  because a drag-only handle does not exist as far as a keyboard user is concerned; and
  `storageKey` persistence is read in an effect rather than in the initial state — these
  components are `'use client'` but Next.js still renders them on the server, and a stored
  width in the first render is a guaranteed hydration mismatch.

  Only the active tab is mounted, so a background tab cannot go on downloading a video or
  polling a log. The trade is that switching away and back remounts; a renderer that must
  survive it should hold its state above the panel or in the item's `data`.

  Below `lg` the panel floats over the transcript instead of squeezing it, and the drag handle
  disappears — a measure that has already given up the sidebar's width cannot also give up
  360px and still hold a line of prose. No scrim: reading the document and typing the next
  question are the same task.

- 46a2a02: Tool registry, generated-image lifecycle, silent reasoning, and inline-code wrapping.

  **`tools` registry on `ChatThemeProvider`.** Per-tool presentation without reimplementing
  the row: `label`, `icon`, `runningIcon`, `runningMotion`, `tone`, `compact`, `summary`,
  `renderBody`, or `render` for a full takeover. `defineTool()` pins the type at the
  declaration site. `toolRenderers` still works and is folded into the same registry; it is
  now deprecated in favour of `tools: { name: { render } }`.

  **Compact tool calls.** `toolVariant="compact"` on the provider, `compact` on a tool
  definition, or `variant="compact"` on `ToolCallPart` renders one log-style line with no
  card and no disclosure — the difference between a skimmable list and twenty cards in a
  tool-heavy turn.

  **Generated media.** `FilePart` gains `id`, `status`, `width`, `height`, `progress` and
  `error`; a `file` event carrying an `id` already in the message merges into that part
  instead of appending, so a placeholder becomes the finished file in place. The new
  `ImagePart` reserves the declared aspect ratio, holds a shimmer until the bitmap actually
  decodes, and fades it in — no reflow when the image lands. `ImageSkeleton` is exported for
  hosts that render generated images from their own tool renderer.

  **Reasoning with no text.** Providers that report only that thinking happened now render a
  one-line receipt instead of vanishing. `ReasoningPart` gains `redacted`, and
  `reasoning-start` / `reasoning-end` accept the flag from either end of the stream.

  **Inline code and long URLs wrap.** Long paths, identifiers and bare URLs no longer push
  the message column past its container, and a wrapped inline-code span keeps its background
  and corners on every line.

  Breaking (types only): `FilePart.url` and the `file` event's `url` are now optional, since
  a file being generated has no URL yet. Code reading `part.url` under `strictNullChecks`
  needs a guard.

- 46a2a02: Prompt queue, a clickable streaming status bar, and a heavier send arrow.

  **`usePromptQueue`** (core) holds messages written while the agent is still answering and
  releases them one at a time once it goes idle. Draining is driven by the promise `onSend`
  returns rather than by watching a busy flag — `store.send` only resolves after its whole
  stream finishes, which makes it an exact "previous turn is done" signal. Queued prompts
  capture their attachments and quote at queue time, so an item sent minutes later still
  carries the files it was written with.

  **`PromptInput` gains `queue`.** Passing it changes what the composer does mid-stream: the
  send button stays a send button and queues, and stopping moves to a `StreamingStatus` bar
  above the box whose whole row is the click target. Send and stop are two intentions and one
  slot cannot hold both. Omit `queue` and the old behaviour — send button becomes stop button
  — is untouched.

  **Stop holds the queue** rather than letting it fire the next message immediately.
  Interrupting a turn only to have the next queued item start half a second later is not an
  interruption; the queue is held, still visible and still editable, with a resume control
  next to it.

  **`PromptQueue`** lists the waiting prompts: click one to rewrite it in place, hover for the
  remove button.

  The send button's arrow goes from 16px/1.5 to 18px/2.25. The icon set's defaults are tuned
  for glyphs sitting beside text; alone in the middle of a filled 32px circle the same arrow
  read as a thin scratch.

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
