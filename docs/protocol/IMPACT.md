# agent-chat/1 实施影响清单

本文档只描述把 [`agent-chat/1`](agent-chat-1.md) 落到当前仓库需要做的工作。本轮
没有修改源码。行号以当前工作树为准，后续源码变更后需要重新核对。

严重度：

- **阻塞**：不解决就无法把 `examples/next-app` 当作真实端到端 demo 使用。
- **高**：协议核心能力不可用或会产生错误状态。
- **中**：能力可用，但缺少完整语义或兼容性。
- **低**：增强项，不影响基本 turn。

## 1. 仅服务端或协议适配层

这些工作可以先完成，不要求立即改 UI reducer；它们主要属于 route handler、agent
runtime、provider adapter 和持久化层。

| 严重度 | 工作                                                                                 | 现状依据                                                                                                                                        | 影响                                                     |
| ------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 高     | 维护 `conversationId`、`turnId`、`runId` 与 canonical transcript                     | 当前请求只有 `messages/body/headers/regenerate`，`packages/core/src/transport/types.ts:4-10`                                                    | 服务端不能把客户端 `messages` 当权威历史                 |
| 高     | 为每个 input 建立 `inputId` 幂等记录                                                 | 当前没有 typed input，`packages/core/src/transport/types.ts:4-10`                                                                               | 重试权限、工具结果或 action 可能重复副作用               |
| 高     | 实现 `Last-Event-ID` 续放、重放窗口和 `resume_expired`                               | SSE parser 已保留 id，但没有协议状态，`packages/core/src/transport/sse-parser.ts:36-70`                                                         | 长任务断流后无法安全继续                                 |
| 高     | 服务端生成 run 内单调 `eventId`，保证重复事件内容不变                                | 当前 demo 只发送 `data`，`examples/next-app/app/api/chat/route.ts:31-33`                                                                        | 无法去重和审计                                           |
| 高     | 定义 turn/run 终态及权限等待新 run 规则                                              | 当前 demo 在单流内直接 `message-end`，`examples/next-app/app/api/chat/route.ts:72-73`                                                           | 无法表达等待审批后恢复                                   |
| 高     | 增加 `server-hello`、capabilities 和 limits                                          | 当前没有握手事件                                                                                                                                | 客户端无法知道 resume、client tools、blockIds 和附件上限 |
| 高     | client tool 只在 `tool-input-start` 声明 `server/client` owner                       | 当前 demo 直接从服务端发 `tool-executing`，`examples/next-app/app/api/chat/route.ts:53-67`                                                      | 无法安全区分客户端执行与服务端执行                       |
| 高     | 权限、工具结果、A2UI action 改成 typed input                                         | 当前 demo 用文本和本地动作模拟，`examples/next-app/app/api/chat/route.ts:112-132`                                                               | 真实用户动作无法回到 agent                               |
| 高     | 结构化 turn/block/tool error，并决定 HTTP 错误与 SSE 错误的边界                      | 当前非 2xx 由 `TransportError` 承载，`packages/core/src/transport/http.ts:35-57`                                                                | 鉴权、限流、上游和工具错误无法统一分类                   |
| 中     | provider adapter 保存 Anthropic signature 和其他 provider metadata                   | 当前 Anthropic 丢弃 signature，`packages/core/src/transport/anthropic.ts:94-95`                                                                 | 多轮 thinking continuation 可能失败                      |
| 中     | provider adapter 将 OpenAI Responses、Anthropic Messages 和自研 agent 映射到统一事件 | 当前已有 OpenAI/Anthropic mapper，但目标字段不同，`packages/core/src/transport/openai.ts:1-35`、`packages/core/src/transport/anthropic.ts:1-36` | 后端差异不能泄露到 UI                                    |
| 中     | 附件 ref 使用服务端认可的 opaque URI 并校验 MIME、权限、过期                         | 当前 `useAttachments` 可 inline 或由 `onUpload` 返回引用，`README.md:195-221`                                                                   | 任意 URL 和过期文件不能被当成可信输入                    |
| 低     | 记录 usage 的 turn 累计 snapshot 和成本归属                                          | 当前只有最终 `TokenUsage`，`packages/core/src/types.ts:310-314`                                                                                 | 多次模型调用的成本无法解释                               |

## 2. 需要修改 `events.ts`、类型或 transport wire

这些修改会改变 core 的公开类型或事件管线，但未必要求立刻改变现有 UI 的默认渲染。

| 严重度 | 文件与位置                                        | 工作                                                                                 | 是否阻塞 demo                                         |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 高     | `packages/core/src/events.ts:15-78`               | 为事件增加 wire 关联信息：`eventId`、`turnId`、`runId`、`messageId`、可选 `blockId`  | 当前假端点可运行；真实 resume 阻塞                    |
| 高     | `packages/core/src/events.ts:15-78`               | 增加 `server-hello` 事件，或由 transport 消费后暴露 capability 回调                  | 不阻塞最小 demo；阻塞能力降级和可靠接入               |
| 高     | `packages/core/src/events.ts:20-24`               | text/reasoning start/delta/end 增加可选 `blockId`                                    | 不阻塞顺序流；阻塞并发 block                          |
| 高     | `packages/core/src/events.ts:25-38`               | `tool-input-start` 增加 `execution: 'server'                                         | 'client'`；约束 client tool 不发 `tool-executing`     | 不阻塞 server tool demo；阻塞 client tool |
| 高     | `packages/core/src/events.ts:73-78`               | `message-end` 增加标准 finish reason 和累计 usage 语义                               | 当前 demo 能完成；取消/审批状态不正确                 |
| 高     | `packages/core/src/events.ts:76`                  | `error` 从 string 扩展为结构化 error，至少含 scope/code/message/retryable            | 当前错误仍能显示；重试语义错误                        |
| 中     | `packages/core/src/events.ts:29-31`               | reasoning 事件增加 `signature?`、`provider?`、`metadata?`                            | 不阻塞纯文本 reasoning；阻塞 Anthropic signature 保留 |
| 中     | `packages/core/src/events.ts:40-45`               | A2UI event 增加 action 声明所需 metadata                                             | 本地卡片不阻塞；真实 action 往返受限                  |
| 高     | `packages/core/src/transport/types.ts:4-24`       | `SendRequest` 增加 protocol、ids、capabilities、input、resume 信息                   | 当前 `messages/body` 仍可发；v1 envelope 阻塞         |
| 高     | `packages/core/src/transport/sse.ts:25-45`        | 不再只消费 `message.data`；把 SSE `id` 映射成 eventId，并保证一个 SSE 帧一个上层事件 | **阻塞 resume**                                       |
| 中     | `packages/core/src/transport/sse-parser.ts:1-132` | parser 已正确解析 `id`；补充协议层校验和保留 parser id 的测试                        | parser 本身不阻塞；上层未消费 id 才阻塞               |
| 中     | `packages/core/src/transport/anthropic.ts:94-95`  | 保存 signature delta，并绑定到对应 reasoning block                                   | 不阻塞基础 Anthropic 文本流                           |
| 中     | `packages/core/src/transport/openai.ts:1-35`      | 为 provider block/choice 映射稳定的 message/block 关联                               | 不阻塞当前单 choice 流                                |

说明：`sse-parser.ts` 已经读取并保存 `id`，问题在 `sse.ts` 的 `createSSETransport()`
只依据 `message.data` 映射事件；因此不应重复实现 parser，而应打通 parser → transport
→ store 的链路。

## 3. 需要修改 `reducer.ts` + `store.ts`

这一组是 UI/core 侧的主要工作。其中第一项是当前 demo 的直接阻塞问题。

### 3.1 阻塞项：activeMessageId 改名后失联

**位置：**

- `packages/core/src/store.ts:59-61`：保存客户端临时 `activeMessageId`。
- `packages/core/src/store.ts:86-91`：`flush()` 以该 id 查找消息。
- `packages/core/src/store.ts:120-136`：创建 assistant 并保存临时 id。
- `packages/core/src/store.ts:103-118`：`message-start` 立即 flush。
- `packages/core/src/reducer.ts:12-18`：`message-start` 把消息 id 改成服务端 id。
- `packages/core/src/store.ts:180-192`：`markActive()` 仍用旧 id 查找。

**机理：**

1. store 创建 `asst-*` 临时消息，并把 `activeMessageId` 设为该值。
2. 服务端发送 `message-start{id: 'assistant-*'}`。
3. `flush()` 找到临时消息，`applyEvent()` 将消息 id 改成服务端 id。
4. `activeMessageId` 没有同步，仍是 `asst-*`。
5. 后续 text、reasoning、tool 事件再次执行 `findIndex(m.id === activeMessageId)`，找不到消息，事件被丢弃。
6. 结果是 demo 可能只留下空的 assistant 消息，即“回复空白”。

**处理要求：**

这不是本轮修复项，但协议落地前必须单独修复或采用等价设计。修复必须保证服务端
message id 改名后，`activeMessageId`、`flush()`、`markActive()` 和 `onFinish` 仍指向
同一条消息。该问题标记为 **阻塞 demo**。

### 3.2 reducer 的事件语义改造

| 严重度 | 文件与位置                                                                | 工作                                                                                 | 是否阻塞 demo                         |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| 阻塞   | `packages/core/src/reducer.ts:12-18`、`packages/core/src/store.ts:86-100` | 修复 message-start 改名后的 active pointer 关联                                      | **是**                                |
| 高     | `packages/core/src/reducer.ts:20-60`                                      | text/reasoning 从 `appendToLast` 迁移到按 `blockId` 定位；无 id 时保留顺序回退       | 当前顺序 demo 不阻塞；并发 block 阻塞 |
| 高     | `packages/core/src/reducer.ts:220-240`                                    | `message-end` 按 finishReason 映射 turn/message 状态；不能一律 `status:'complete'`   | 取消和审批状态不正确                  |
| 高     | `packages/core/src/reducer.ts:232-239`                                    | error 不再一律 `retryable: true`，保留结构化 scope/code/retryAfter                   | 当前错误可显示；重试行为错误          |
| 高     | `packages/core/src/reducer.ts:359-390`                                    | `closeDanglingParts` 区分正常终局、取消、临时断流和 resume，而不是统一把工具变 error | **resume/取消阻塞**                   |
| 高     | `packages/core/src/reducer.ts:64-115`                                     | client tool 不在服务端 `tool-executing`；支持结果回传后的确认状态                    | client tool 阻塞                      |
| 中     | `packages/core/src/reducer.ts:156-177`                                    | permission resolution 与新 run 的恢复语义对齐；重复 resolution 幂等                  | 多设备冲突不在 v1 解决                |
| 中     | `packages/core/src/reducer.ts:120-205`                                    | A2UI action 不是本地 `resolved` 的替代品，保留服务端 action 状态                     | 本地卡片不阻塞                        |
| 中     | `packages/core/src/types.ts:42-65`                                        | reasoning part 保存 blockId/signature/provider metadata                              | Anthropic continuation 受影响         |
| 中     | `packages/core/src/types.ts:310-314`                                      | usage 类型保留最终 turn snapshot，并为扩展 metadata 预留空间                         | 不阻塞基础 UI                         |

### 3.3 store / transport 生命周期改造

| 严重度 | 文件与位置                           | 工作                                                                                | 是否阻塞 demo              |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------- |
| 高     | `packages/core/src/store.ts:74-118`  | 保存、去重、检查和推进 `eventId`；拒绝重复与乱序事件                                | **resume 阻塞**            |
| 高     | `packages/core/src/store.ts:120-192` | 保存 turn/run 状态，支持同 run resume、权限后新 run、retry 和 regenerate 的 id 规则 | 长任务阻塞                 |
| 高     | `packages/core/src/store.ts:220-250` | `stop()` 除 abort 外发送 typed cancel；处理服务端 cancelled 终态                    | 当前停止只对浏览器本地生效 |
| 高     | `packages/core/src/store.ts:43-53`   | 重新定义 `onEvent`：观察、client tool 拦截和异步结果回传不能混为一个同步 callback   | client tool 阻塞           |
| 高     | `packages/core/src/store.ts:226-233` | `submit()` 支持 permission/tool-result/A2UI/cancel input，而不再只发送完整 messages | 双向 agent 阻塞            |
| 中     | `packages/core/src/store.ts:292-305` | `resolveA2UISurface()` 继续负责本地只读状态，但 action 另走 typed input             | 当前本地 UI 不阻塞         |
| 中     | `packages/core/src/store.ts:158-175` | 结构化 transport error 映射到正确 retryable/status，而不是统一 retryable            | 错误 UX 受影响             |

## 4. demo 端点需要的服务端改造

`examples/next-app/app/api/chat/route.ts` 当前是脚本流：

- `examples/next-app/app/api/chat/route.ts:31-33` 只发送 `data`，没有 `id`、turn/run 或 hello。
- `examples/next-app/app/api/chat/route.ts:44-73` 固定吐 reasoning、server tool、text、A2UI 和 message-end。
- `examples/next-app/app/api/chat/route.ts:75-82` 错误只发送字符串 error，并始终发送 `[DONE]`。
- `examples/next-app/app/api/chat/route.ts:112-132` 的按钮只存在于 A2UI spec，没有对应 `a2ui-action` input。

升级为真实端到端 demo 时，route 至少需要：

1. 解析 `protocol`、ids、capabilities、messages 和 typed input。
2. 首帧发送 `server-hello`。
3. 每帧发送 `id: <eventId>`。
4. 保存或连接 canonical transcript。
5. 对重复 input 做幂等处理。
6. 在权限等待时结束当前 run，并允许新 run 继续同一个 turn。
7. 正确区分 `message-end`、结构化 error 和 `[DONE]`。
8. 对 A2UI action、client tool 和取消提供真实往返。

## 5. 本轮不应顺手修改的内容

- 不修改 `packages/core/src/events.ts`、`reducer.ts`、`store.ts` 或任何 transport 源码。
- 不修改 `examples/next-app/app/api/chat/route.ts`。
- 不把 `activeMessageId` 修复混入协议文档提交之外的变更。
- 不把 v1 non-goals（多 assistant 消息、`either` tool、并发 block 渲染、多设备审批冲突）提前实现。
