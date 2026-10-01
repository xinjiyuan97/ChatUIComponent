# agent-chat/1

## 1. 范围与目标

`agent-chat/1` 是浏览器中的 `@xinjiyuan97/chat-core`、`chat-ui` 与后端
agent 之间的协议。后端可以是自研 agent，也可以是 OpenAI Responses 或
Anthropic Messages 的服务端 adapter。provider 的差异必须在服务端收敛，浏览器
只消费本协议。

本协议使用一个 POST 创建或继续一个 turn，并以 SSE 返回 server → client 的事件流。
它覆盖文本、reasoning、工具、权限、计划、A2UI、文件、用量和可恢复流。

## 2. 请求 envelope

请求 JSON 的最小形状如下：

```json
{
  "protocol": "agent-chat/1",
  "conversationId": "conv_123",
  "turnId": "turn_123",
  "runId": "run_123",
  "capabilities": {
    "blockIds": false,
    "resume": true,
    "clientTools": true,
    "a2ui": true
  },
  "messages": [],
  "input": []
}
```

### 2.1 `messages` 与 `input`

`messages` 是客户端视图或上下文快照，仅供服务端参考；它不是权威历史，服务端
不得据此重新执行工具、接受权限或覆盖自己的 transcript。

`input` 是本次请求新增的事实和动作。每一项都必须有 run 内唯一且可重试的
`inputId`。服务端按自己的 canonical transcript 校验 `turnId`、关联 id 和当前
状态，并对重复 `inputId` 返回相同语义的结果，不重复执行副作用。

一个 POST 对应一个 turn 的一次处理请求。权限等待、重连和 retry 的关系见第 6 节。
权限、工具结果和 A2UI 不开专用业务端点；取消除此之外允许使用
`DELETE /turns/{turnId}`，用于当前连接已经不可写的情况。

### 2.2 输入类型

所有 input 共有：

```ts
type InputBase = {
  type: string
  inputId: string
}
```

#### 用户消息

```ts
type MessageInput = InputBase & {
  type: 'message'
  parts: MessagePart[]
}
```

`parts` 可以包含文本和附件。已有客户端发送的 `messages` 可以作为兼容输入，但
新协议应优先使用 typed `input`。

#### 客户端工具结果

```ts
type ToolResultInput = InputBase & {
  type: 'tool-result'
  toolCallId: string
  output?: unknown
  error?: string
}
```

只有服务端先声明 `execution: 'client'` 的工具，客户端才能发送该 input。服务端
不得对客户端回传的结果盲信，必须确认工具调用属于该 turn 且仍等待结果。

#### 权限决定

```ts
type PermissionDecisionInput = InputBase & {
  type: 'permission-decision'
  requestId: string
  option: string
  decision: 'allow-once' | 'allow-always' | 'deny' | 'custom'
  reason?: string
}
```

`option` 是后端定义的不透明值；`decision` 是 core 可理解的标准语义。服务端必须
校验 request 是否属于该 turn、是否尚未决定、以及 option 是否仍有效。

#### A2UI action

```ts
type A2UIActionInput = InputBase & {
  type: 'a2ui-action'
  surfaceId: string
  action: string
  payload?: unknown
}
```

`resolveA2UISurface()` 只改变本地渲染状态，不等价于发送该 input。某个 surface 的
action 是否只在本地处理、是否送回 agent、是否幂等，由对应 `a2ui` 事件的声明
决定。

#### 取消

```ts
type CancelInput = InputBase & {
  type: 'cancel'
  reason?: string
}
```

取消 input 与 `DELETE /turns/{turnId}` 具有相同的业务语义，均必须幂等。

## 3. SSE 传输

响应必须使用：

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
```

硬约束如下：

- 一个逻辑 SSE event 只承载一个协议事件，即一个 `ChatEvent`。
- `data:` 的值是一个 JSON object；v1 不允许依赖多行 `data:` 拼接业务 JSON。
- `event:` 可选，但不能改变 `data.type` 的语义。
- `id:` 是 run 内严格递增的 `eventId`，不含 NUL。
- 以 `:` 开头的行是 heartbeat，不产生 ChatEvent，也不推进序号。
- `data: [DONE]` 保持兼容，但不是协议事件；业务终局是 `message-end`。
- mapper 内部可以把一个 provider 帧映射为多个事件，但 transport 必须拆成多个
  逻辑事件后再交给上层。

## 4. 身份与状态

| 标识             | 语义                      | 生命周期                           |
| ---------------- | ------------------------- | ---------------------------------- |
| `conversationId` | 长期会话                  | 多个 turn                          |
| `turnId`         | 一次用户意图及其全部工作  | 用户消息、工具、权限等待结束后终止 |
| `runId`          | 一个 turn 的执行尝试      | 重连复用；retry 新建               |
| `messageId`      | 该 turn 的 assistant 消息 | v1 一个 turn 至多一条              |
| `blockId`        | text/reasoning 等内容块   | 同一 message 内稳定                |
| `eventId`        | run 内事件序号            | 严格单调递增                       |
| `inputId`        | 客户端动作幂等键          | 服务端 canonical transcript 记录   |

turn 和 run 的规则：

1. 重连携带 `Last-Event-ID`：相同 `turnId`、相同 `runId`，从下一事件继续。
2. 权限等待：服务端在权限处发送 `message-end{finishReason:'awaiting-permission'}`
   并结束流；客户端带权限决定创建同一 `turnId` 的新 `runId`。
3. retry：同一用户意图复用 `turnId`，创建新 `runId`。
4. regenerate：创建新 `turnId`，并以 `regeneratesTurnId` 指向旧 turn。
5. 一个 turn 至多产生一条 assistant 消息；工具前后的文字使用同一消息的多个 part。

推荐的 turn 状态至少包括：

```text
running | waiting | completed | cancelled | failed
```

现有消息状态 `streaming | complete | error | aborted` 需要在 core 落地时重新映射，
不能把 `awaiting-permission` 或 `cancelled` 静默当作普通完成。

`message-end.finishReason` 的标准值为：

```text
stop | length | tool-calls | awaiting-permission | cancelled | error
```

## 5. 事件模型

事件 envelope 的协议字段如下：

```ts
type EventEnvelope = {
  type: string
  eventId: string
  conversationId: string
  turnId: string
  runId: string
  messageId?: string
  blockId?: string
}
```

`eventId`、关联 id 是否直接进入 core 的 `ChatEvent` 类型，由客户端能力协商决定；
在协议 wire 上它们属于必需关联信息。

下面的事件基于现有 `packages/core/src/events.ts`。标记含义：`现存` 表示当前
事件已有；`变更` 表示保留事件名但增加或收紧字段；`新增` 表示当前没有。

| 类型                   | 状态 | v1 语义                                                                   |
| ---------------------- | ---- | ------------------------------------------------------------------------- |
| `message-start`        | 变更 | `messageId`，可带 `id` 兼容现有字段；一个 turn 至多一次                   |
| `text-start`           | 变更 | 可带 `blockId`                                                            |
| `text-delta`           | 变更 | `delta`，可带 `blockId`                                                   |
| `text-end`             | 变更 | 可带 `blockId`                                                            |
| `reasoning-start`      | 变更 | `blockId`、`redacted?`、`provider?`、`metadata?`                          |
| `reasoning-delta`      | 变更 | `delta`、`blockId`                                                        |
| `reasoning-end`        | 变更 | `blockId`、`redacted?`、`signature?`、`provider?`、`metadata?`            |
| `tool-input-start`     | 变更 | `toolCallId`、`name`、`execution: 'server'                                | 'client'`、可选 `blockId` |
| `tool-input-delta`     | 变更 | `toolCallId`、原始 JSON `delta`                                           |
| `tool-input-available` | 现存 | `toolCallId`、解析后的 `input`；client tool 不得随后收到 `tool-executing` |
| `tool-executing`       | 现存 | 仅 `execution:'server'` 的工具可发送                                      |
| `tool-output`          | 现存 | server tool 的结果；client tool 由服务端收到 `tool-result` 后确认         |
| `tool-error`           | 现存 | 单工具失败，不自动终止 turn                                               |
| `a2ui`                 | 变更 | `surfaceId`、spec、data?，可声明 action 处理方式                          |
| `a2ui-patch`           | 现存 | 按 `surfaceId` 更新已有 surface                                           |
| `permission-request`   | 现存 | request id 必须稳定；可重发以原地更新                                     |
| `permission-resolved`  | 现存 | `requestId`、标准 resolution；可由服务端或其他设备回灌                    |
| `todo`                 | 现存 | 同一 `todoId` 原地替换                                                    |
| `file`                 | 现存 | 同一 `id` 原地替换；文件状态按 generating/ready/error 变化                |
| `source`               | 现存 | 引用来源，不代表权限或可信度                                              |
| `custom`               | 现存 | host 扩展；不能承载协议必需语义                                           |
| `message-end`          | 变更 | `finishReason`、整个 turn 的累计 `usage`；终局只能一次                    |
| `error`                | 变更 | 结构化错误，见第 9 节；终局错误后不得再发业务事件                         |
| `server-hello`         | 新增 | 首帧能力和限制，见第 8 节                                                 |

### 5.1 blockId 与顺序

v1 定义 `blockId`，但当前 UI v1 能力可以声明 `blockIds: false`。在该能力下，服务端
必须保证同类 text block 或 reasoning block 不交错；text/reasoning 的顺序仍然必须
保持。声明 `blockIds: true` 后才允许并发 block 交错。

reasoning 的 `signature` 是服务端 provider adapter 的不透明数据。UI 只展示或保留，
不得重新序列化、修改或伪造空字符串 thinking。Anthropic 等 provider 要求回传的
签名由服务端 adapter 负责保存和回传。

## 6. 续传、重放与幂等

客户端保存已应用的最大 `eventId`，重连时发送：

```http
Last-Event-ID: <eventId>
```

服务端从该事件之后重放同一 run。重放窗口耗尽时必须返回结构化
`resume_expired`，禁止静默重新运行 agent。

规则：

- `eventId` 在 run 内严格单调递增；服务端不得乱序发送。
- 客户端必须丢弃重复事件。
- 收到小于已见最大值的事件时丢弃，并可记录警告。
- 同一个 `eventId` 的内容必须逐字节一致。
- `inputId` 与 `eventId` 是两套不同的幂等键，不得混用。
- 重复 `tool-result`、`permission-decision`、`a2ui-action` 不得重复副作用。
- `message-end` 和终局 `error` 只能出现一次。

## 7. 工具、权限与 A2UI

工具执行位置在 `tool-input-start` 声明，v1 只有 `server` 和 `client`：

- `server`：服务端可以发送 `tool-executing`，随后发送 `tool-output` 或 `tool-error`。
- `client`：服务端不得发送 `tool-executing`；客户端执行后发送 `tool-result`。
- v1 不支持 `either` 或双方竞速，也不引入 lease。

权限 request 可以使当前 run 进入 `awaiting-permission`。本地 UI 决定必须通过 typed
input 回到服务端；`permission-resolved` 用于服务端策略或其他设备已决定的结果。
decision 为 `allow-once | allow-always | deny | custom`，option 是不透明字符串。

A2UI action 是否需要回 agent 由 surface 声明决定；`resolveA2UISurface()` 仅是本地
只读化操作，不能代替 `a2ui-action`。

## 8. 能力协商

客户端在请求中声明 capabilities。服务端必须把 `server-hello` 作为首个业务事件：

```json
{
  "type": "server-hello",
  "protocol": "agent-chat/1",
  "capabilities": {
    "blockIds": false,
    "resume": true,
    "clientTools": true,
    "a2ui": true
  },
  "limits": {
    "disconnectGracePeriodMs": 10000,
    "maxAttachmentBytes": 10485760,
    "maxAttachmentCount": 10,
    "resumeWindowEvents": 10000
  }
}
```

不支持协议版本返回 HTTP `426 Upgrade Required`。不支持某个可选能力时必须降级，
不得仅因能力缺失报错。为兼容现有后端，缺少 `server-hello` 时客户端按 v1 最小集
运行，但不能假设 resume、client tools 或 blockIds 可用。

## 9. 错误、取消与终局

结构化 error：

```ts
type AgentChatError = {
  scope: 'turn' | 'message' | 'block' | 'tool'
  code: string
  message: string
  retryable: boolean
  retryAfterMs?: number
  details?: unknown
}
```

推荐 code 包括 `auth`、`validation`、`rate_limit`、`upstream`、`transport`、
`resume_expired`、`cancelled` 和 `internal`。

工具失败使用 `tool-error`，不会自动终止整个 turn。turn-level 终局 error 后不得再
发业务事件；正常完成、取消和终局 error 都必须有清晰的唯一终态。取消不能仅靠
浏览器 abort 推断：客户端优先发送 cancel input，连接已断时使用 DELETE 控制端点。
断连 grace period 由 `server-hello.limits` 声明。

## 10. 用量与计费

`message-end.usage` 是整个 turn 的累计 snapshot，不是 delta。重复播放相同终局事件
不得重复计费。当前 UI v1 只要求读取最终累计值；服务端可以在 custom 或扩展事件中
提供步骤明细，但不能改变最终 snapshot 的含义。

服务端负责决定多次模型调用、工具成本、cache token、reasoning token 的归属。客户端
展示的 usage 不是计费凭证。

## 11. 附件

附件 wire 抽象为：

```ts
type Attachment =
  | { kind: 'inline'; mediaType: string; data: string; name?: string; size?: number }
  | {
      kind: 'ref'
      uri: string
      mediaType: string
      name?: string
      size?: number
      checksum?: string
      expiresAt?: string
    }
```

inline 的 base64 计入请求体限制。ref 必须是服务端认可的 opaque 引用，不允许把任意
URL 当作可信文件地址。服务端通过 limits 声明大小、数量和 media type 限制，并决定
引用是否需要鉴权、过期后能否重试、文件内容是否进入模型上下文。客户端提供的 MIME
type 不可信，服务端必须自行校验。

## 12. 兼容、未知值与废弃

- 新增字段必须可选，新增事件不得改变已有事件语义。
- 同一版本内字段类型不可变。
- 未知事件默认忽略；未知必需 input 必须拒绝。
- 未知枚举值按字段定义处理，不能一律静默接受。
- 重放必须保持事件内容不变。
- 废弃流程为 `active → deprecated → removed`。
- `custom` 不能承载客户端无法理解而又影响安全或终态的必需语义。

## 13. 安全边界

客户端回传的 `tool-result`、`permission-decision`、`a2ui-action` 和附件 ref 都是
用户端声明，不是服务端事实。服务端必须用自己的 `turnId`、`requestId`、
`toolCallId`、surface 状态和 canonical transcript 对账。

客户端提交的 `messages` 只是视图/上下文快照，不能作为权威历史。服务端不得因为
客户端重发了一个已完成 tool 或 permission part 就再次执行副作用。

## 14. v1 non-goals

- 一个 turn 多条 assistant 消息。
- `execution: 'either'` 或双端竞速。
- 分步 usage 的 UI 展示。
- 多设备实时协同审批和冲突解决。
- 真正的并发 block 渲染；协议先定义 blockId，面向当前 UI 时服务端保证同类 block 不交错。
