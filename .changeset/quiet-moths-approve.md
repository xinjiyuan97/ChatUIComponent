---
'@xinjiyuan97/core': minor
'@xinjiyuan97/ui': minor
---

新增权限审批菜单与任务清单两个 part

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
