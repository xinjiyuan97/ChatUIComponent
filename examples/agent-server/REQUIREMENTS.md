# agent-chat/1 参考 agent 后端 —— 需求

> 本文件是**需求的唯一来源**。实现时反复读本文件与 `docs/protocol/agent-chat-1.md`，不要凭记忆发明字段名。
> 本文件放在仓库里，是为了让实现者有据可依、也为了以后能对照验收。

## 0. 并行协作边界（**先读这一条，违反会破坏别人的工作**）

**这台机器上同时有另一条线程在改这个仓库**（它在改 `apps/docs/.storybook/**`、`apps/docs/package.json`、`apps/docs/.storybook/shims/**`）。

因此你**只允许**创建/修改这些路径：

```
examples/agent-server/**        ← 新包，你的主战场
examples/next-app/**            ← 只在 D 节要求的范围内
vitest.config.ts                ← 只改 test.include 一行
package.json                    ← 只在需要加 dev 脚本时
```

**严禁触碰**（那是另一条线程在改的）：

```
apps/docs/**            尤其 apps/docs/.storybook/**
packages/**             任何文件（包括 packages/core/src）
```

另外：**工作区里有大量未提交改动（前 16 项的全部成果）——一律不要 commit、不要 push、不要建分支、不要 stash、不要回滚任何东西。** 你的产物也保持未提交状态即可。

---

## 1. 目标

`agent-chat/1` 的前端一侧（`packages/core` 的 store/reducer/transport 与 `packages/ui`）已经被前 15 项打磨完整，但这些协议路径**一直是在前端里用 `createMockTransport` 自己演的**。

本项要交付：**一个真能说这个协议的独立后端 agent**，并用**真 HTTP + 真前端栈**证明一致性 —— 让「协议符合性」变成可自动复跑的联调测试。

## 2. 先读，不要从零造

- **`docs/protocol/agent-chat-1.md` 是规范**。逐条落实，章节：§2 请求 envelope（§2.1 `messages` 与 `input`、§2.2 输入类型）、§3 SSE 传输、§4 身份与状态、§5 事件模型（§5.1 `blockId` 与顺序）、§6 续传/重放/幂等、§7 工具/权限/A2UI、§8 能力协商、§9 错误/取消/终局、§10 用量、§11 附件、§12 兼容与未知值。
- **`docs/protocol/IMPACT.md`** 记了实现影响面。
- **`examples/next-app/app/api/chat/route.ts`（435 行）已经是一份能说这个协议的实现**：有 turn/run 注册表、`REPLAY_WINDOW`、`capabilities`、`limits`、`appendEvent`、`finish`、取消等。**先把它的协议逻辑读懂并抽出来**，不要重写一遍、也不要另发明一套状态模型。
- `packages/core/src/transport/`（`sse-parser.ts` / `sse.ts` / `http.ts` / `mock.ts`）是**前端一侧的对照实现**：你要发出的帧必须能被它正确解析、你收到的输入必须与它发送的形态一致。

## 3. 技术选型与依赖白名单（**硬约束**）

- **零新依赖。** 不许新增任何 `dependencies`/`devDependencies`（不许 express/fastify/koa/tsx/ts-node/esbuild/zod…）。
- HTTP + SSE 用 Node 内置 **`node:http`** 手写。
- 运行时形态：**TypeScript 源文件直接用 Node 跑**
  - Node 是 **v22.22.2**，用 `node --experimental-strip-types src/index.ts` 运行（脚本里显式带这个 flag，别依赖默认值）
  - 相对导入**必须写显式 `.ts` 扩展名**（Node 的 type stripping 要求）；`tsconfig.json` 里开 `allowImportingTsExtensions: true`
  - `package.json` 设 `"type": "module"`
  - **运行时不得 import `@xinjiyuan97/chat-core` 的运行时值** —— 协议类型一律 `import type`（这样 `node src/index.ts` 不依赖任何 workspace 包是否已 build）
- 自带 `tsconfig.json`（`extends: '../../tsconfig.base.json'`，若该文件不适用就自建最小配置）与 `typecheck` 脚本 —— 注意**根 `pnpm typecheck` / `pnpm build` 只覆盖 `./packages/*`，不会管你**，所以你必须自带并在验收里自己跑。
- 监听端口用**环境变量 `PORT`**，默认 `3210`；端口被占用要报清晰错误而不是静默失败。

## 4. 精确文件树（照此创建；名字可以微调，但结构要保持）

```
examples/agent-server/
├── REQUIREMENTS.md          ← 本文件
├── README.md                ← 怎么跑、怎么指前端、怎么触发每个场景（必须写，见 E 节）
├── package.json             ← name: @agent-chat/agent-server；private；scripts: dev/start/typecheck
├── tsconfig.json
└── src/
    ├── index.ts             ← 入口：读 PORT、起服务、打印监听地址
    ├── frames.ts            ← 帧序列化（§3 的帧规则都在这）
    ├── engine.ts            ← 协议引擎：turn/run 状态机、身份集、终局、取消、重放窗口
    ├── scenarios.ts         ← 场景注册表（C 节的 12 条）
    ├── provider.ts          ← AgentProvider 接缝 + 默认 ScriptedProvider（离线）
    ├── server.ts            ← node:http 路由 + 把引擎输出写进 SSE 响应
    └── conformance.test.ts  ← 联调一致性测试（D 节，本项核心产出）
```

**引擎与传输必须解耦**：`engine.ts` 要能在**没有 HTTP** 的情况下被单测直接驱动（生成事件序列）；`server.ts` 只负责把事件写成帧、把请求体喂给引擎。

## 5. 协议实现要求

### B1. 传输与帧规则（§3，最容易做错的地方）

- `POST /agent/chat` → 请求 envelope，响应 `text/event-stream`
- **一帧一个 `ChatEvent`**；**JSON 不得跨行**
- **心跳注释行不推进 `eventId`**
- `[DONE]` 只作兼容，**业务终局是 `message-end`**
- `eventId` 在**同一个 run 内严格单调递增**
- **每一帧写完立即 flush**（不许等缓冲）；响应头含 `content-type: text/event-stream`、`cache-control: no-cache, no-transform`、`x-accel-buffering: no`

### B2. 身份与状态（§4）

- 身份集完整：`conversationId` / `turnId` / `runId` / `messageId` / `blockId` / `eventId` / `inputId`
- 一个 POST = 一个 turn；`messages`（非权威）与 `input[]`（带 `inputId` 幂等键）分离
- **同一 `inputId` 重复投递不得产生第二次效果**（§6 幂等）

### B3. 输入类型（§2.2）

五类都要能收并正确处理：`message` / `tool-result` / `permission-decision` / `a2ui-action` / `cancel`

### B4. 终局（§9）

六种齐全且语义正确：`stop` / `length` / `tool-calls` / `awaiting-permission` / `cancelled` / `error`

### B5. 恢复语义（已冻结的决策，照做）

- **权限等待**：流以 `finishReason:'awaiting-permission'` **正常结束**；之后**同一 turn 下开新 run**恢复（不要挂着一个没结束的 run）
- 重连/续传：**同 turn 同 run**；重放窗口外的行为照 §6
- retry = 同 turn 新 run；regenerate = 新 turn

### B6. `blockId`（§5.1）

支持两路（或多路）`blockId` 交错的文本/推理块增量；同时保留「不带 `blockId` 时按顺序语义」的兼容回退。

### B7. 工具、权限、A2UI（§7）

- **client tool**：声明 `execution:'client'` 后，服务端**等待宿主回传 `tool-result`**，不得自己执行
- 权限：发 `permission` 请求 → 等 `permission-decision` → 恢复
- A2UI：能发 A2UI 节点、能收 `a2ui-action`

### B8. 能力协商（§8）

`server-hello` 声明 `capabilities`（`blockIds` / `resume` / `clientTools` / `permissions` / `a2ui`）与 `limits`（如 `disconnectGracePeriodMs` / `maxAttachmentBytes` / `maxAttachmentCount` / `resumeWindowEvents`）。**必须支持「能力缺失的最小集」模式**（用场景触发），以便验证前端降级。

### B9. 错误（§9）

结构化错误照规范（`scope` / `code` / `message` / `retryAfterMs` / `retryable` 等，取值以规范为准），并且**要能产出「不可重试」的一例**。

### B10. 用量（§10）与附件（§11）

`usage` 是**快照覆盖**语义（不是累加）；附件按 `limits` 校验并给出超限错误。

## 6. C 节 · 场景注册表（确定性触发每条路径）

把每个协议路径做成一段**确定性**的「事件序列 + 时序」。触发方式自选（建议请求体里带场景名 / `metadata.scenario`，另给一个 `GET /agent/scenario/:name` 便于人肉排查），**但必须在 README 与报告里给出对照表**。

至少覆盖以下 12 条：

| #   | 场景           | 命中什么                                                                       |
| --- | -------------- | ------------------------------------------------------------------------------ |
| 1-6 | 六种终局各一条 | `stop`/`length`/`tool-calls`/`awaiting-permission`/`cancelled`/`error`         |
| 7   | 断流           | run 未发 `message-end` 就断开（前端应判「未完成」而非成功）                    |
| 8   | 取消           | 流式进行中收到 `cancel` input → 终局 `cancelled`                               |
| 9   | 重复投递与乱序 | 同一 `eventId` 重复发 + 乱序发（**故意违约以测前端**；服务端不得依赖前端容错） |
| 10  | 结构化错误     | 含 `retryAfterMs`，且含一例**不可重试**                                        |
| 11  | 未知事件类型   | 验证前端忽略而不崩                                                             |
| 12  | `blockId` 交错 | 两路文本块交替增量                                                             |
| 13  | client tool    | `execution:'client'` → 等待 → `tool-result` → 继续                             |
| 14  | 权限往返       | `awaiting-permission` → 同 turn 新 run 恢复                                    |
| 15  | 能力最小集     | `server-hello` 声明 `blockIds:false` 等 → 前端降级                             |
| 16  | 用量覆盖       | 多次 usage 快照覆盖而非累加                                                    |
| 17  | 附件超限       | 按 `limits` 报错                                                               |

（编号 13-17 是第 10-12 条的补充，一并做。共 17 条场景。）

## 7. D 节 · 联调一致性测试（**本项核心产出**）

在 `examples/agent-server/src/conformance.test.ts` 写测试：

- **真的起这个 HTTP 服务**：监听 `127.0.0.1` 的**临时端口**（`listen(0)` 取系统分配端口），测试结束**必须关掉**（`afterAll` 里 `server.close()`，并确保不留下挂起的连接/定时器，否则 vitest 会报未清理）
- 客户端用 **`@xinjiyuan97/chat-core` 的真 store + 真 SSE 传输**（`createChatStore` + 真 `fetch` 路径），**绝不用 `createMockTransport`**
- **每个场景至少一条端到端断言**，且断言必须**咬到行为**，例如：
  - 断流 → 断言状态是 `error`（**不是** `done`）
  - 取消 → 断言消息状态与「不转圈」「permission 未被自动处理」
  - `blockId` 交错 → 断言**两个 part 各自的文本各自正确**（不是拼在一条里）
  - 去重 → 断言被重复投递/乱序的事件**没有**被二次应用
  - 幂等 → 同一 `inputId` 投两次，断言只产生一次效果
- 文件顶部标 `// @vitest-environment node`（服务端测试不需要 jsdom）

### ⚠️ 必须同时改 `vitest.config.ts`（否则你的测试根本不会被跑到）

现在根配置是：

```ts
include: ['packages/*/src/**/*.test.{ts,tsx}'],
```

**不含 `examples`** —— 也就是说你把测试写好了，`pnpm test` 也不会执行它，等于没写。请把它扩成同时包含 examples：

```ts
include: [
  'packages/*/src/**/*.test.{ts,tsx}',
  'examples/*/src/**/*.test.{ts,tsx}',
],
```

**只改这一处，不要动该文件里其它任何内容。** 改完在报告里贴**前后对比**：`pnpm test` 的**文件数**与**用例数**必须都变化（当前基线 **28 文件 / 376 用例**）。

## 8. E 节 · 前端可指向外部 agent（联调接缝）

- `examples/next-app` 支持读环境变量 **`NEXT_PUBLIC_AGENT_URL`**：设置了就**浏览器直连**该地址；未设置则**回落到原来自己的 `/api/chat`**（**既有行为必须逐字节不变**）。
- 直连要求 agent server 发**正确的 CORS 头**：处理 `OPTIONS` 预检；允许 `content-type`、`last-event-id` 等请求头；允许所需 method。（本地开发用宽松策略即可，但要写清这是开发用。）
- **`examples/next-app` 的 dev 端口用 3102**（`next dev -p 3102`）—— 3100 在这台机器上被别的服务占着。若你改了端口，请在 README 里写清。

## 9. F 节 · 一个命令起两个进程 + README

- 提供可复跑脚本（`examples/agent-server/scripts/dev-both.sh` 或根 `package.json` 加 `dev:agent` / `dev:example`），一次起 agent（3210）与 next-app（3102），并打印两行清晰提示。
- `examples/agent-server/README.md` 必须写清：
  1. 怎么起 agent（含 `PORT` 环境变量）
  2. 怎么把前端指过来（`NEXT_PUBLIC_AGENT_URL`）
  3. **每个场景怎么触发**（对照表：场景名 ↔ 怎么发）
  4. 怎么关
  5. 已知限制（例如「这是参考实现、不含真实 LLM」）

## 10. 验收（**必须贴真实输出**）

```bash
cd examples/agent-server
pnpm typecheck                       # 或 npx tsc --noEmit（自带 typecheck 脚本）
node --experimental-strip-types src/index.ts &   # 起服务
curl -sS -N -X POST http://127.0.0.1:3210/agent/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[],"input":[{"type":"message","inputId":"i1","text":"hi"}]}' | head -20
# 从根目录：
pnpm lint && pnpm test && pnpm typecheck && pnpm build
```

要求：**`pnpm test` 全绿**，且既有 **28 文件 / 376 用例一条都不许变红、不许改预期**。

## 11. 严格不做

- 不接任何真实 LLM、不发起任何外部网络请求（**测试必须完全离线可跑**）
- 不引入任何新依赖
- 不改 `packages/**` 与 `apps/docs/**`（见第 0 节）
- 不 commit / 不 push / 不建分支 / 不 stash / 不回滚
- 不改既有测试的预期

## 12. 报告格式（交回给上级）

1. **场景对照表**：场景名 ↔ 命中哪条协议路径 ↔ 对应哪条测试
2. 联调测试怎么起服务、端口怎么选、怎么关；断言了什么
3. `vitest.config.ts` 改动 + `pnpm test` **前后文件数/用例数对比**
4. `next-app` 你改了什么（`NEXT_PUBLIC_AGENT_URL` 的落点）、未设置时的行为怎么保证不变
5. provider 接缝在哪、换真 LLM 要动什么
6. 10 节所有验收命令的**真实输出**
7. **明确列出：哪些结论你无法自行验证、需要上级用浏览器/真进程实测**（例如「我只证明帧按序发出，没证明浏览器里不是等整段才出现」——这类必须写明，不要含糊）
8. 明确说「本项完成」
