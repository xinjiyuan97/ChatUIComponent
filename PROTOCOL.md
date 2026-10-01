# Agent Chat Protocol

`agent-chat` 是 `@xinjiyuan97/chat-core` 与后端 agent 之间的流式、双向协议。
它把自研 agent、OpenAI Responses 转发层和 Anthropic Messages 转发层统一成同一套
turn、input、event 和 SSE 语义。

## 当前版本

- 协议标识：`agent-chat/1`
- 当前正文：[`docs/protocol/agent-chat-1.md`](docs/protocol/agent-chat-1.md)
- 代码影响清单：[`docs/protocol/IMPACT.md`](docs/protocol/IMPACT.md)

本文件是入口和版本指针；字段、状态机、事件和兼容规则以版本正文为准。

## 如何阅读

1. 先读 v1 的请求 envelope、身份模型和 SSE 帧规则。
2. 再读双向 `input` 与 server → client `ChatEvent` 的 schema。
3. 接入现有 core 前，查看影响清单，区分服务端工作和 UI/core 改动。

## 演进原则

- 新增字段必须可选；同一协议版本内不得改变已有字段语义或类型。
- 未知事件默认忽略；未知的必需 input 必须拒绝。
- 事件带 `eventId` 时可重放，且同一个 `eventId` 的内容不可变。
- 废弃流程为 `active → deprecated → removed`，移除时递增协议主版本。
- 协议版本由请求 JSON 的 `protocol` 字段决定，HTTP header 只用于辅助协商。
