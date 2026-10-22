# 多 agent 组件 —— 需求（Phase A）

> 本文件是**需求的唯一来源**。实现时反复读它，不要凭记忆发明字段名。
>
> **可视化参考**：`docs/multi-agent/paradigms.html`（用浏览器打开，三个 tab 切换三种编排范式）。
> 它是**设计意图的参考，不是要照抄的代码** —— 样式一律以本仓库的 `cc-` token 与既有组件为准。

## 0. 目标与边界

给 `@xinjiyuan97/chat-core` / `chat-ui` 加上**表达多 agent 协作**的组件，并让它们在 Storybook 里**能看、能点**。

三种编排范式的代价差异很大，本阶段**只做不需要动 turn 模型的那部分**：

| 范式                     | 承载                                        | 本阶段                                        |
| ------------------------ | ------------------------------------------- | --------------------------------------------- |
| **派发式（supervisor）** | 任务板是宿主级组件，任务是 **part**         | ✅ 做                                         |
| **路由式（swarm）**      | 交接轨迹是 **part**，同一时刻只有一个持有者 | ✅ 做                                         |
| **辩论式（群聊）**       | 需要「一个 turn 多条 assistant 消息」       | ❌ 本阶段**不做**（下个阶段，要改 turn 模型） |

**地基**：三者的共同前提是「归属」—— 谁说的、谁在跑。本阶段先做它。

## 1. 必须沿用的既有约定

1. `packages/core/src/types.ts:386` 已有 `Agent = { id, name, description?, avatar?, metadata? }`，注释写明 _Deliberately thin… Prompts, tool configuration and model selection are the host's business_。**沿用它，不要扩成配置格式。**
2. 样式：**Tailwind + `cc-` 语义 token + `cn()`**。不要写死颜色、不要堆 shade 数字。
3. 面向用户的文案**必须进 `ChatLocale`**（`packages/ui/src/provider/locale.ts`），**zhCN 与 enUS 两个对象都要加**。
4. 新组件 `export * from` 到 `packages/ui/src/index.ts`（桶式导出）。
5. part 的渲染分发在 `packages/ui/src/message/MessageContent.tsx` 的 `switch (part.type)` 里。
6. `packages/ui/src/message/Message.tsx` 已有 `MessageAvatar({ src, name })`（渲染首字）与 `MessageTimestamp` —— 头像能力已有，**别重写**。
7. **本库的一条硬原则**（`TodoListProps` 注释里写着）：_"a row the user can click but that changes nothing is worse than a row they cannot"_。→ **任何交互控件只在宿主提供了对应回调时才渲染**；没有回调就不渲染，**不要渲染禁用态**。

## 2. 模块清单

### A. core —— 归属（向后兼容增量）

1. `ChatEventContext`（`packages/core/src/events.ts`，已有的 `eventId/turnId/runId/blockId` 那一处）新增 **可选** `agentId?: string` 与 `parentRunId?: string`。
2. `ChatMessage` 新增 `agentId?: string`。**不要动 `role`** —— `role` 是「哪一类」，`agentId` 是「谁」，两者正交。
3. reducer：把事件的 `agentId` 落到它产生的消息上；**事件不带 `agentId` 时不得写入该字段**（老后端/老数据零变化）。
4. 新增**纯函数** `packages/core/src/agent/resolveAgent.ts`：按 `agentId` 在宿主给的 agent 列表里查找；找不到或没有 `agentId` → 返回**中性缺省**结果，**绝不抛错**。库不自己发现 agent，列表由宿主传入（对齐 `ChatModel` 的既有做法）。

### B. core —— 任务板的数据（扩展 `TodoItem`，不新增 part 类型）

`TodoItem`（`types.ts:293`）新增，**全部可选**：

```ts
owner?: { agentId: string; name?: string; model?: string }   // 谁在做
deps?: string[]                                              // 依赖的 item id
attempt?: number                                             // 第几次尝试（重派后 >1）
artifacts?: Array<{ id: string; label: string; kind?: string }>  // 产物
```

`TodoPart` 不变（`todoId` 同 id 原地替换的语义保持不变）。

### C. core —— 求助 / 闸门（扩展 `PermissionRequest`）

`PermissionRequest` 新增可选 `blockedOn?: { agentId?: string; taskId?: string; reason?: string }`
—— 表达「agent 卡住了、在等人类决定」。**不要新增 part 类型**，复用 `permission`。

### D. core —— 交接（新增 part `handoff`）

`ChatMessage.parts` 增加一种 part：

```ts
export type HandoffPart = {
  type: 'handoff'
  handoffId: string // 同 id 原地替换
  from: { agentId: string; name?: string }
  to: { agentId: string; name?: string }
  reason?: string // 路由理由
  rule?: string // 命中的规则号，如 'R-114'
  /** 转交时带过去的上下文 */
  carried?: Array<{ label: string; detail?: string }>
  /** 转交时**没**带过去、需要人类确认的（这是本模块的重点）*/
  missing?: Array<{ id: string; label: string; detail?: string }>
  /** 人类是否已确认缺失项 */
  acknowledged?: boolean
  at?: number
}
```

挂进 `MessagePart` 联合。

### E. ui —— 身份

1. `AgentBadge`：**两级名称层级** —— agent 名 `text-cc-sm`/600 + 模型名更小一档且用 faint 色。
2. `AgentAvatar`：复用 `MessageAvatar` 的渲染，加**可选状态点**，状态覆盖
   `idle / thinking / speaking / waiting / blocked / done / error`。
3. 接进 `Message` 的作者行：**没有 `agentId` 时完全不渲染徽章与状态点** —— 单 agent 场景的视觉必须与改动前**逐字节一致**（本项最易出错的硬要求）。
4. 状态点动效处理 `prefers-reduced-motion`。

### F. ui —— 任务板（宿主级组件，挂在 `packages/ui/src/agent/`）

1. `TaskBoard` —— props 至少：`items: TodoItem[]`（复用上面的扩展）、`title?`、`groupBy?: 'status' | 'owner'`（**默认 `'status'`**）、`now?`、以及回调 `onReassign?` / `onRetry?` / `onCancel?` / `onPriority?` / `onOpen?`。
2. `TaskCard` —— 单条任务：标题、owner（用 `AgentBadge`）、状态、尝试次数、依赖条（`deps`）、产物列表（`artifacts`），以及**可展开的子流插槽**（`children?` 或 `renderStream?`，让宿主把该 agent 的流放进去）。
3. 汇总头：完成 / 进行中 / 阻塞 / 失败的计数，数字用 **tabular** 对齐。
4. **派发动作条只在给了对应回调时渲染对应按钮**（见第 1 节第 7 条原则）。
5. 任务卡上的「阻塞」态要能一眼区分于「进行中」。
6. `TaskCard` 的状态标识、卡头、owner 行、依赖条、产物列表、动作条与子流插槽均拆成独立导出子组件；拆分不得改变既有 DOM、类名与 `data-cc-task*` 属性。
7. `TaskTrajectory` —— 单条任务按时间顺序的处理史。props 为 `item: TodoItem`、`steps: TaskTrajectoryStep[]`、可选 `agents?: Agent[]`、`currentStepId?` 与交互回调；渲染 `<ol>/<li>` 竖向时间线，当前步骤带 `aria-current="step"`，阻塞/失败使用 `cc-` 语义色，时间使用 tabular 数字，并复用 `AgentBadge` / `AgentAvatar`。没有对应回调时不渲染详情或重试控件。

### G. ui —— 求助 / 闸门

`PermissionPart` 增强：当 `request.blockedOn` 存在时，在审批卡上**明确渲染「谁在等、卡住的是哪个任务、为什么」**；`resolution` 存在时仍是只读记录（现有行为不变）。没有 `blockedOn` 时渲染与改动前一致。

### H. ui —— 交接（swarm）

1. `HandoffPart` 的渲染器接进 `MessageContent.tsx` 的 switch。
2. `HandoffTrail` —— 一条**轨迹**（不是消息气泡）：节点 + 带理由的边 + **当前持有者高亮**；数据来自会话里按顺序出现的 `handoff` part（宿主把数组传进来）。
3. `HandoffContext` —— **两栏对照**：「已携带」与「**未携带（需确认）**」。
   - 未携带项**必须逐项勾选确认**，全部勾选后才能继续（`onAcknowledge?` 回调；**没给回调就只做只读展示**，不要渲染勾选框）。
   - 这是本模块的核心价值：让「转手时丢了什么」不可能被忽略。

### I. Storybook —— 本阶段的交付判据

在 `apps/docs/src/stories/` 新增一组（建议 `title: 'Multi-Agent/…'`），**用 `createMockTransport` 脚本驱动**（与 `Protocol/` 组同一套路），至少覆盖：

1. **身份**：同一会话内两个 agent 各自发言、各自徽章；**外加一个无 `agentId` 的对照**（证明零变化）。
2. **任务板**：按状态分组 + 切换到按 owner；含一条阻塞任务（带 `blockedOn` 的审批卡）与一条带依赖/产物的任务。
3. **交接**：轨迹两个节点（含理由与当前持有者）+ 上下文卡（已携带 3 项 / 未携带 2 项，**可勾选确认**）。
4. **求助卡**：agent 卡在任务上请求人类决定（复用 `PermissionPart`）。
5. **任务轨迹**：至少 5 步，包含一次交接、工具高风险审批阻塞、一次重试与完成，且当前步骤高亮。
6. **拆分后的任务卡**：单独渲染一张卡，并在 story 中组合至少一个独立导出的 TaskCard 子组件。

要求：

- 每条 story **尽量带 `play` 断言**（`@storybook/test` 已在依赖里），断言要**咬行为**（例如「未携带项没勾完时确认按钮不可用」「无 `agentId` 时查不到徽章」「没给派发回调时查不到派发按钮」）。
- **必须能在浏览器里打开并看到内容** —— 这是本阶段唯一算数的判据（见第 5 节）。

## 3. 测试

- **core**：① 无 `agentId` 时消息不带该字段；② 有 `agentId` 时正确落位；③ 同一 turn 内两个不同 `agentId` 互不污染；④ `resolveAgent` 对未知/缺失 id 返回中性结果且不抛；⑤ `handoff` part 同 `handoffId` 原地替换。
- **ui**：① 有 `agentId` → 徽章出现且 agent 名与模型名各自正确；② **无 `agentId` → 查询不到徽章**；③ 没给派发回调 → 查不到派发按钮；④ 未携带项未全部确认时确认不可用；⑤ `HandoffTrail` 高亮当前持有者。
- **ui 增补**：① `TaskTrajectory` 当前步骤带 `aria-current="step"`；② steps 顺序与输入一致；③ 没有详情/重试回调时查不到对应交互按钮；④ `TaskCard` 拆分出的子组件可以独立渲染。
- 测试位置：core 放 `packages/core/src/**`、ui 放 `packages/ui/src/**`（`vitest` 的 `include` 已覆盖 `packages/*/src/**/*.test.{ts,tsx}`）。

## 4. 严格不做

- **不动 turn 模型**（一个 turn 一条 assistant 消息的限制本阶段不碰）
- **不改 `Agent` 的形状**（不加 endpoint / token / prompt 字段）
- **不改既能 story 的可见行为**（既有 story 一条都不许变样）
- 不改 `packages/core` 里 `agent-chat/1` 既有协议行为（本阶段全是**增量**）
- 不引入任何新依赖
- 不碰 `examples/**`、不做辩论式并行 lane
- 不 commit / 不 push / 不建分支（保持工作区未提交，由上级处理）

## 5. 验收（**必须全部跑，贴真实输出**）

```bash
pnpm typecheck
pnpm lint
pnpm prettier --check "**/*.{ts,tsx,css,md,json}"     # ← CI 有这一步，别漏
pnpm test
pnpm build
pnpm --filter @agent-chat/docs typecheck
pnpm build:storybook
```

- 根 `pnpm typecheck` / `build` 只覆盖 `./packages/*`，**不含 `apps/docs`** —— 后两条才是 story 的正确性检查。
- **`prettier --check` 必须在推送前是绿的**（上一轮就是漏了这一步把 CI 弄红）。**提交前请对自己改过的文件跑 `pnpm prettier --write`。**
- 既有用例一条都不许变红、不许改预期；报告里给出 `pnpm test` 的**前后文件数 / 用例数对比**。

## 6. 报告格式

1. 改了哪些文件 + 完整 `git diff`；
2. 新增的公开 API：组件 props、类型、**locale 的键名（中英都要列）**；
3. **你怎么证明「无 `agentId` 时零视觉变化」**（说明用了什么断言或逐字节对比）；
4. Storybook：新增 story 的 id 列表 + **你无法自行验证的部分**（明说你没法在浏览器里看，需要上级实测 —— 尤其是「首屏真的渲染出内容」这件事）；
5. 第 5 节每条命令的真实输出；
6. 明确说「本阶段完成」。

---

# 7. 设计修订（Phase A2 —— 按评审意见追加）

> 来源：三条评审意见（头像要拆成基础件再组合 / 任务板要多列 / 每个任务要有简介等信息）。
> **本节推翻或细化了第 2 节的对应部分，冲突时以本节为准。**

## 7.1 `AgentAvatar` 拆成基础件，再组合

**现状问题**：`AgentAvatar` 把「头像」和「状态点」焊死在一个组件里 —— `status` prop 驱动一个内联的绝对定位点。结果：单用头像做不到、单用状态点做不到、想换一个别的标记（不一定是状态点）也做不到。

**要求：**

1. **`AgentAvatar` 收成基础组件**：只画头像。props 收敛为 `agent?` / `name?` / `src?` / `size?` / `className?` —— **不含任何状态逻辑**。
2. **`AgentStatusDot` 抽成独立基础组件**：props `status` / `size?` / `label?` / `className?`；颜色走 `cc-` token；`thinking`/`speaking` 的动效尊重 `prefers-reduced-motion`；无障碍标签走 locale（**不要写死英文**）。
3. **`AgentPresence` = 组合件**：`AgentAvatar` + 定位好的 `AgentStatusDot`。`Message` 的作者行与 `TaskCard` 改用它。
4. **可组合的关键**：`AgentAvatar` 要接 `overlay?: ReactNode` —— 宿主能把自己的标记叠上去（不一定是状态点），而不是只能在「有状态点」和「没状态点」之间二选一。
5. **`Message.tsx` 的既有视觉必须不变** —— 拆组件不等于改样子。
6. 三个组件都桶式导出到 `packages/ui/src/index.ts`。
7. **story**：新增 `Agent pieces: composed` —— 同一屏并列：基础头像单独用 / 加状态点组合用 / 六种 status 各一 / 不带 status。play 要断言「基础件自己不含状态点」「组合件含」。

## 7.2 `TaskBoard` 支持多列（看板）

1. `TaskBoard` 新增 `layout?: 'columns' | 'stack'`，**默认 `'columns'`**（看板是这个组件的自然形态）；`'stack'` 保持现在的竖向分组列表。
2. **列**：`groupBy='status'` 时一列一个状态（列头 = 状态名 + 计数）；`groupBy='owner'` 时一列一个 agent。列头数字用 **tabular**。
3. **窄容器必须处理好**：列宽固定 + 整体横向滚动（`overflow-x` + snap），或窄到一定程度退化成 stack —— 自己选一种，但**不许出现内容被压扁或溢出裁切**。
4. **空列要保留**（列头可见、计数 0），否则列位置会跳 —— 除非该状态在当前数据里压根没出现过。
5. 既有的分组切换（Status / Owner）在多列下同样要工作。
6. **story**：新增 `Task board: columns`（一列一状态、含空列）；原 `task-board-states` 显式改为 `layout='stack'`，**两条都留着**。

## 7.3 任务要能表达「简介」等信息

**现状问题**：`TodoItem` 只有 `title` + 一行 `note`，卡片信息量太薄。

1. `TodoItem` 新增（都可选、向后兼容）：
   - `description?: string` —— 简介，卡片正文；**默认折叠到 2–3 行**，可展开。
   - `labels?: string[]` —— 小标签（如 `risk` / `needs-review` / `blocked`）。
2. **状态要显式**：`TodoStatus` 追加 `'blocked'` 与 `'failed'`（增量）。注意现在 `TaskCard` 是用 `status === 'pending' && owner !== undefined` **推断**「阻塞」、用 `cancelled` 当「失败」—— 这是隐式重载，卡片上说不清到底卡在哪。改成：**显式状态优先**；为不破坏既有 story/测试，`pending + owner` 的旧推断**只保留为兼容回退**，并在注释里写明它是什么、为什么留着。
3. **卡片的呈现顺序**（从上到下）：标题 → 标签 → **简介** → owner（`AgentPresence`）→ 状态 / 尝试次数 → 依赖 → 产物。同类信息成组，不要散着放。
4. locale 补新增键（**中英都要**）：展开/收起简介、标签区、显式的阻塞/失败状态名。
5. **story fixture 必须真的带上 `description` 与 `labels`** —— 否则等于没做。至少两条任务写**有实质内容的简介**（不要 `TODO` / `lorem` 之类占位）。
6. play 断言要咬行为：例如「默认只显示 2–3 行、展开后能看到完整简介」「阻塞态走的是显式 status 而不是推断」。

## 7.4 本节验收

沿用第 5 节全部命令，另加一条不许破的红线：

- **既有 story 与测试一条都不许变红**；
- **`Message.tsx` 的既有视觉不得变化**（拆 `AgentAvatar` 时最容易碰坏的就是这里 —— 用断言或逐字节对比证明）。

## 7.5 断言卫生：这类错误绝不能再溜过去

**背景**：同一类缺陷已经发生**三次** —— `task-board-states` 的 `getByText('Builder')`（多处匹配）、`handoff` 的 `getByText('Plan is ready')`（文本被拆散）、`agent-pieces-composed` 的 `getByText('speaking')` 与 `task-board-columns` 的 `getByTestId('cc-agent-badge')`（多张卡各有一个徽章）。**四次都不是组件错，都是断言没有作用域。**

根本原因：**story 的 `play` 断言根本不在 `pnpm test` 的覆盖范围内**（vitest 的 `include` 只到 `packages/*/src` 与 `examples/*/src`），所以它们只有**人肉打开 Storybook** 才被检查 —— 全部自动化验收绿灯，story 却是坏的。

要求：

1. **断言必须有作用域或数量**。禁止无作用域的 `getByText(...)` / `getByTestId(...)` 去查一个「页面上本来就可能有多个」的东西。做法：`within(某个稳定标记元素)` 限定范围，或 `getAllBy*` + 断言**精确数量**。禁止用 `length >= 1` 这种把意义弄丢的弱化写法。
2. **必须让 play 断言进 CI**：把 `apps/docs` 里那个现成的孤儿装置（`vitest.protocol.config.ts` + `Protocol.play.test.tsx`，它把 story 的 `play` 函数在 jsdom 里真跑一遍）**推广到 `apps/docs/src/stories/` 下的全部 story**，接成一条 `pnpm test:stories`，并加进 `.github/workflows/ci.yml`。
   - 要求：跑到**全部** story（含 `Protocol/` 与 `Multi-Agent/`），任一 story 的 play 失败或抛错 → 该命令非零退出。
   - 注意它需要在 jsdom 里提供 story 需要的 provider/decorator；若某类 story 在 jsdom 下确实无法运行（例如依赖 canvas 尺寸），**允许显式排除并在文件里写清为什么**，但不许整仓跳过。
3. 第 5 节的验收命令里**追加 `pnpm test:stories`**。
4. 报告里给出该命令的真实输出：**跑了多少条 story、几条跳过、为什么跳过**。
