# Contributing

## 跑起来

```bash
pnpm install
pnpm storybook      # 主验收台
pnpm test
pnpm typecheck
pnpm lint
```

提交前四个都要绿。改了公共 API 就加一个 changeset：`pnpm changeset`。

## 发布 npm 包

仓库使用 Changesets 和 GitHub Actions 发布 `@xinjiyuan97/chat-core`、`@xinjiyuan97/chat-a2ui`、
`@xinjiyuan97/chat-ui`。首次启用需要在 GitHub 仓库完成两项设置：

1. 在 **Settings → Secrets and variables → Actions** 新建 repository secret：
   `NPM_TOKEN`。值为拥有 `@agent-chat` npm scope 发布权限的 npm access token。
2. 在 **Settings → Actions → General → Workflow permissions** 勾选
   **Allow GitHub Actions to create and approve pull requests**。

之后的发布流程：

1. 功能 PR 中运行 `pnpm changeset`，把生成的 `.changeset/*.md` 一起提交。
2. PR 合并到 `main` 后，Release workflow 自动创建或更新 `chore: version packages` PR。
3. 合并版本 PR；Release workflow 会构建并把三个 public package 发布到 npm。

三个包采用固定版本，Changesets 会让它们保持同一个版本号。不要手动只修改其中一个包的
`version`。

---

## 视觉铁律

这一节是给「三个月后加新组件的自己」写的。这套 UI 好看不是因为某个组件设计得巧，而是因为**克制得一致**；一个组件破例，整体就会开始显脏。

1. **AI 回复不套气泡。** 直接平铺在背景上。只有用户消息有 `bg-cc-subtle` 的气泡。满屏气泡会让长回答变得极难读 —— 这是本库最重要的一条。
2. **折叠块只用 1px 细线 + 极淡底。** 思考过程、工具调用都是次要信息，不用阴影，不用重色，不用大圆角。它们的存在感必须低于正文。
3. **阴影几乎不可见。** `--shadow-cc-card` 只有一层 4% 的黑。分层靠留白和字重，不靠边框和阴影堆叠。暗色下阴影基本无效，改由边框承担。
4. **次级操作 hover 才显现 —— 键盘 focus 也要显现。** reaction 条默认 `opacity-0`，`group-hover` 和 `focus-within` 都要能唤出来。只做 hover 等于把这些按钮从键盘用户那里拿走了。
5. **所有动效 ≤200ms，统一 `ease-cc`。** 并且必须在 `prefers-reduced-motion: reduce` 下降级掉。聊天界面每秒都在变，动效稍长就变成噪音。
6. **强调色一次只出现在一个地方。** 主按钮，或者当前会话高亮，不要两个同时用。强调色满屏撒，就等于没有强调。

## 代码约定

- **只用 token，不写字面量颜色。** 新配色先加进 `packages/ui/src/styles/tokens.css`。oklch 的写法是保持 C/H、只挪 L 来派生暗色 —— 这样不会出现色相漂移。
- **headless 在 core，皮在 ui。** 状态机、时序、边界情况都放 `@xinjiyuan97/chat-core` 的 hook 里；`packages/ui` 里的组件应该薄到可以整个换掉。判断标准：如果一段逻辑在别人的设计系统里也需要，它就不该待在 ui。
- `verbatimModuleSyntax` + `jsx: react-jsx` 意味着 **`React` 这个命名空间不在作用域里**。`React.ReactNode` 会直接编译失败，要写 `import { type ReactNode } from 'react'`。
- 组件要能在 Next.js App Router 下用：产物顶部有 `"use client"`，所以 **tsup 里不要开 `treeshake`** —— Rollup 那一趟会把 banner 里的指令当成「模块级指令」丢掉。

## 加 A2UI 组件

往 registry 里加一个组件，等于把那个能力交给模型输出。加之前先确认：

- 它**不能**导航、发请求或执行代码。默认组件集里一个都没有，这是刻意的。
- 所有 props 都过 `props.ts` 里的强制转换（`str` / `num` / `bool` / `oneOf` / `options`）。模型吐出来的形状是不稳定的 —— `["a"]`、`[{value,label}]`、`[{a:"Label"}]` 三种写法都会出现，直接拒绝的结果是卡片静默渲染成空的，而 agent 完全看不出发生了什么。
- 任何 URL 都当成已经被 sanitizer 处理过：被拒绝的 href 会变成 `undefined`，这时组件要退化成不可点的文本，而不是渲染一个坏链接。
- 新组件要在 `apps/docs/src/stories/A2UI.stories.tsx` 里补一个 story，包括它的畸形输入表现。

## 测试

- 每个组件至少三个 story：默认态、流式进行中、错误态。
- transport 的单测必须覆盖**跨 chunk 的半行**和**被切开的多字节 UTF-8** —— 真实网络下这两种都会发生，而且都只在中文场景炸。
- A2UI 的安全约束（深度 / 节点数上限、非法 props、`javascript:` 链接、字符串处理器）改动时，`packages/a2ui/src/*.test.ts` 里对应的用例必须一起看，别只改实现。

## 手测清单

自动化测不到，发版前过一遍：

- [ ] 中文输入法拼字时按 Enter 是选词，不是发送
- [ ] 上滑离开底部后，新内容不把视口硬拽回去
- [ ] 3000 字带 10 个代码块的长回复，滚动不掉帧
- [ ] `prefers-reduced-motion` 下没有动画
- [ ] Tab 能走完所有交互点，焦点环清晰可见
- [ ] 明暗主题各扫一遍 Storybook
- [ ] 附件：点选、拖入、粘贴截图三条路都能加；超限文件在列表里标红而不是被静默丢掉；上传中发送按钮是禁的
- [ ] 附件的 blob 预览 URL 在移除和卸载时都被 revoke（DevTools → Memory，或 `chrome://blob-internals`）
- [ ] 语音：Chromium 上原生识别边说边出字；停止后录音指示灯熄灭（麦克风轨道真的被 stop 了）；
      Safari / Firefox 上不传 `transcribe` 时麦克风按钮整个不渲染，而不是渲染成灰的
- [ ] agent 分组（`Conversations / Sidebar → 540 conversations across 6 agents`）：折叠中间某个 agent 后，
      它下面的行要正确上移 —— 虚拟化偏移量算错最先在这里暴露；再甩一下滚动条确认不露白
- [ ] 同一个 story 里 Tab 进列表后按上下键：光标必须跳过被折叠 agent 的子行，不能凭空消失
- [ ] `→ Agent search`：改搜索词，结果跨 agent、副标题标注正确，清空后回到分组结构
- [ ] agent 徽章只有**当前会话所属的那一个**是 accent 色（一排彩色徽章会直接废掉「强调色一次只出现在一个地方」）
- [ ] 模型选择（`Chat / Composer → Model picker`）：上下键循环、Home / End 到头尾、Esc 关闭后焦点回到触发器；
      **打开时光标落在当前选中项而不是第一项**；disabled 的那一项跳不进去也点不动
- [ ] Mermaid（`Chat / Markdown → Mermaid diagrams`）：切一次明暗主题，图**要重新渲染**（颜色是烤进 SVG 的，
      不像 Shiki 那样跟着 CSS 变量走）；右上角能切到源码再切回来
- [ ] `→ Mermaid — invalid syntax`：退化成普通代码块 + 一行解析器报错，而不是空白或整块消失
- [ ] 把 `mermaid` 从 `packages/ui` 卸掉再看一眼 `Mermaid diagrams`：应该静默退化成代码块，控制台不报错
      （这是没装可选 peer 的用户看到的画面）
- [ ] 流式回放（`→ Streaming`）里写到一半的 mermaid 围栏**不闪红字** —— 半张图解析不过是必然的，不是错误
- [ ] 同一段流式回放**播完之后**那张图必须是完整的最终版本：最后一个 delta 落在上一次排版还没跑完的时候，
      渲染队列要能把它补上（`useMermaidSvg` / `useHighlightedHtml` 里没有 effect 级 `cancelled` 就是为了这个）
- [ ] 运行按钮（`→ Runnable code`）：成功 / 失败 / 空输出三种结果面板都看一遍；失败是 danger 色、成功是中性灰；
      清除按钮只在非受控时出现；`runnable={false}` 的那一块没有按钮
- [ ] 运行按钮是**常驻**的，不跟着 hover 出现（复制和换行才在 hover / focus 才显现的那一簇里）——
      一个只在鼠标悬停时才存在的执行入口，键盘用户根本发现不了
- [ ] 引用块（`Chat / Markdown → Blockquotes & callouts`）：五个等级的图标是五种**形状**，不是同一个圆圈换颜色；
      普通引用保持中性色，不能跟着一起着色
- [ ] 把 fixture 里的 `[!NOTE]` 改成 `[!DANGER]`：应该退回普通引用且文字完整，而不是正文里留一串裸方括号
- [ ] `[!NOTE]` 后面**同一行**还写了字时，那句话不能被吃掉（模型很常这么写）
- [ ] 角标（`Chat / Message → Inline citations`）：点 `[1]` 要展开来源列表、滚到那一行并高亮；
      再点一次列表标题收起时高亮要跟着消失
- [ ] 同一个 story 里 `tokens[1]`（行内代码）和 `[9]`（越界编号）必须**保持原样**，一个字符都不改写
- [ ] 屏幕上同时有两条带来源的回答时，各自的 `[1]` 指向各自的列表，不会串
- [ ] 引用回复（`Chat / Composer → Quote reply`）：选中一段再点引号按钮，条子里是**选中的那段**；
      什么都不选点一下，引用的是整条消息
- [ ] 选中另一条消息的文字再点这一条的引号按钮：不能把别人的选区引过来（`data-cc-message-id` 的包含判断）
- [ ] 引用出现后光标要自动落回输入框；Esc 取消引用，但**中文输入法拼字时按 Esc 不能触发**（那是关候选窗）
- [ ] 发送后条子自动消失，不会挂到下一条消息上
- [ ] 权限审批（`Chat / Permission → 待审批 — 高风险`）：Tab 进卡片后上下键循环、Home / End 到头尾；
      按 `2` 直接提交，按 `3` 只把光标移到「拒绝」并展开理由框，**不提交**
- [ ] 同一张卡按 `Esc`：等价于按 `3`（选中拒绝 + 展开理由框），不是关掉卡片 ——
      一个能被关掉却没答案的审批，agent 会永远等在那儿
- [ ] **中文输入法拼字时按 Esc 不能触发拒绝**（那是关候选窗）；在理由框里拼字时按 Enter 是选词，不是提交
- [ ] 焦点：卡片挂载时**不抢焦点**（transcript 里的内联卡片，自动 focus 会把页面拽走）；
      光标只在键盘操作时跟着走，鼠标划过菜单不能把焦点抢过去
- [ ] 只用方向键**划过**「拒绝」那行时，焦点要留在菜单上 —— 掉进理由框的话上下键就出不来了
- [ ] 审批完卡片塌成一行只读记录留在原地，不是消失；`→ 记录 — 已拒绝` 里的理由要显示出来
- [ ] `→ 选项被策略禁用`：上下键跳过禁用项，不会停在上面
- [ ] 高风险是**整卡着色**，不是只有一个红图标；同屏没有第二处强调色（选中行是 `bg-cc-subtle`）
- [ ] 任务清单（`Chat / Todo`）：推进中默认展开、全部完成默认收起；手动切过之后不再自动跳
- [ ] `→ 含已取消项`：取消项带删除线留在列表里，但进度条读作「全部完成」（取消项不进分母）
- [ ] 收起状态下头部显示的是**当前正在做的那条**（`activeTitle`），不是标题重复一遍
- [ ] `→ 推进中` 里没有任何可点的按钮（不传 `onToggle` 就不该渲染假勾选框）；
      `→ 可勾选` 里 Tab 能走到每一行，已取消的行点不动
- [ ] 进度条和勾选图标同色（都是 success 绿），没有借用强调色
- [ ] `examples/next-app` 跑起来，浏览器控制台没有 hydration mismatch 警告 —— CI 只能确认页面能在服务端渲染出来，
      两端 DOM 对不对得上必须真的开一次浏览器才知道
