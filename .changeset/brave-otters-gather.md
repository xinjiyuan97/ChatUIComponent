---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

会话列表支持 agent 分组：一个 agent 下面挂多个会话

**core**：新增 `Agent` 类型和 `Conversation.agentId`，以及 `useAgentConversations` /
`groupConversationsByAgent`（逻辑在纯函数里，hook 只是 `useMemo` 包一层）。分区顺序跟随传入的
`agents` 数组，空 agent 保留标题，`agentId` 指向不存在的 agent 时归入「未分配」而不是被丢弃。

**ui**：`ConversationList` / `ConversationSidebar` 接受 `agents`，并默认切到 `groupBy="agent"`；
新增 `collapsedAgentIds` / `defaultCollapsedAgentIds` / `onAgentToggle` 受控双模式和
`onNewChatInAgent`；新增 `AgentBadge` / `AgentSectionHeader`。搜索时跨 agent 展平，每行标注归属。
agent 模式下容器语义从 `listbox` 换成 `tree`，日期模式不变。

两个字段都是可选的，不用 agent 的项目无需改动。
