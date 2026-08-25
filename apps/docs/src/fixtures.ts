import type {
  A2UINode,
  Agent,
  ChatMessage,
  ChatModel,
  Conversation,
  MockStep,
} from '@xinjiyuan97/chat-core'
import { mockA2UI, mockReasoning, mockText, mockTool, mockTurn } from '@xinjiyuan97/chat-core'

/* A fixed clock. Stories that render relative timestamps ("2 hours ago") would otherwise
 * produce a different DOM on every run, which makes visual diffs useless. */
export const NOW = Date.UTC(2026, 2, 14, 10, 30)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export const MARKDOWN_SAMPLE = `## 认证中间件的实现

我读了 \`src/auth.ts\`，问题出在 **token 刷新的竞态**：并发请求各自发现 token 过期，于是同时去刷新，后到的那个用已经作废的 refresh token 换取，拿到 401。

\`\`\`mermaid
sequenceDiagram
    participant A as 请求 A
    participant B as 请求 B
    participant S as 授权服务
    A->>S: refresh(rt0)
    B->>S: refresh(rt0)
    S-->>A: at1 + rt1
    Note over S: rt0 已轮换作废
    S-->>B: 401 invalid_grant
\`\`\`

### 修复

把刷新过程收敛到一个 promise 上，后续调用等同一个结果：

\`\`\`ts
let refreshing: Promise<Token> | null = null

export async function getToken(): Promise<Token> {
  const cached = store.read()
  if (cached && !isExpired(cached)) return cached

  // 并发调用共享同一次刷新，而不是各刷各的。
  refreshing ??= refresh(cached).finally(() => {
    refreshing = null
  })

  return refreshing
}
\`\`\`

### 影响面

| 位置 | 现状 | 修复后 |
| --- | --- | --- |
| \`getToken\` | 每个调用各刷一次 | 并发共享一次 |
| \`fetchWithAuth\` | 偶发 401 | 稳定 |
| \`useSession\` | 会闪一次登出态 | 无闪烁 |

> 顺带一提：\`refresh()\` 里的 5s 超时太短了，弱网下会误判失败。建议提到 15s。

需要我把这个改动直接提交吗？下面还有几个待确认的点：

1. 刷新失败时是**静默重试**还是直接登出
2. 是否需要给 \`refresh\` 加指数退避
3. 要不要顺手补一个并发测试
`

export const MARKDOWN_SHORT = `支持 **粗体**、*斜体*、~~删除线~~、\`行内代码\`，以及[链接](https://example.com)。

- 无序列表
- 第二项
  - 嵌套项

1. 有序列表
2. 第二项
`

/** Four diagram kinds in one reply — the shapes a model actually reaches for. */
export const MARKDOWN_DIAGRAMS = `重构后的取数路径是这样的：

\`\`\`mermaid
flowchart LR
    U[useSession] --> G{token 有效?}
    G -- 是 --> C[(缓存)]
    G -- 否 --> R[共享 refresh]
    R --> S[授权服务]
    S --> C
    C --> F[fetchWithAuth]
\`\`\`

状态机只有三个状态，失败会退回 \`idle\` 而不是卡在 \`refreshing\`：

\`\`\`mermaid
stateDiagram-v2
    [*] --> idle
    idle --> refreshing: 过期
    refreshing --> idle: 成功
    refreshing --> idle: 失败并清空
    idle --> [*]
\`\`\`

模块之间的依赖是单向的：

\`\`\`mermaid
classDiagram
    class TokenStore {
        +read() Token
        +write(t) void
    }
    class AuthClient {
        +getToken() Promise
    }
    AuthClient --> TokenStore
\`\`\`
`

/**
 * A diagram the parser rejects. The rendered fallback — source plus the parser's own
 * message — is the thing worth looking at, because models get Mermaid syntax wrong often.
 */
export const MERMAID_BROKEN = `\`\`\`mermaid
flowchart LR
    A --> B
    B -=> C[没有这种箭头]
\`\`\`
`

/** A plain quote followed by all five callout levels, in the order they escalate. */
export const MARKDOWN_CALLOUTS = `引用块有两副面孔。普通的引用是旁白：

> 我们在 2024 年就把 refresh token 改成一次性的了，只是当时没有同步文档。

而带标记的引用是提示框，读者不该像跳过旁白那样跳过它：

> [!NOTE]
> 轮换后的 refresh token 只在第一次交换时有效，重复使用会被服务端判为重放。

> [!TIP]
> 本地想复现的话，把 \`refresh()\` 的超时改成 50ms，并发就很容易撞上。

> [!IMPORTANT]
> 这个改动会让所有并发请求共享同一次刷新，**必须**保证 \`finally\` 里把 promise 清掉，
> 否则一次失败会永久毒化缓存。

> [!WARNING]
> 上线前先确认灰度里没有还在用旧 SDK 的客户端，它们不处理 \`invalid_grant\`。

> [!CAUTION]
> 不要把 refresh token 写进 localStorage。任何一个 XSS 都等于永久会话。
`

/**
 * An answer that cites its sources inline.
 *
 * The point of the fixture is the round trip: `[1]` in the prose has to light up row 1 of
 * the list below, and `[9]` — which has no source behind it — has to stay literal text.
 */
export const MARKDOWN_CITED = `轮换后的 refresh token 不能重复使用，服务端应当把旧的一并作废 [1]。这不是实现细节，
而是规范里明确写着的行为 [1,2]。

浏览器端还有一层：把 token 放进 \`localStorage\` 等于把它暴露给任何一次 XSS [3]，所以
OAuth 的浏览器应用最佳实践直接建议用内存加 http-only cookie [2,3]。

顺带一提，代码里的 \`tokens[1]\` 和上面的角标没有关系，行内代码不会被改写；正文里出现的
\`[9]\` 也不会——没有第 9 条来源，它就只是一对方括号。
`

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/** What the composer's picker lists. Names are illustrative, not an endorsement. */
export const MODELS: ChatModel[] = [
  { id: 'fast', name: '快速模型', description: '日常问答，几乎无延迟', badge: '默认' },
  { id: 'balanced', name: '均衡模型', description: '会用工具，适合大多数任务' },
  { id: 'deep', name: '深度推理', description: '复杂重构和排查，明显更慢', badge: 'Pro' },
  /* Present but not selectable — a model the workspace has not enabled. Listing it beats
   * hiding it: the user learns the option exists and can go ask for it. */
  { id: 'vision', name: '视觉模型', description: '当前工作区未开通', disabled: true },
]

// ---------------------------------------------------------------------------
// A2UI specs
// ---------------------------------------------------------------------------

/** A confirmation card: the agent asks for the last bit of input before acting. */
export const DEPLOY_FORM_SPEC: A2UINode = {
  type: 'Card',
  props: { title: '确认部署', subtitle: '这会把 main 推到生产环境' },
  children: [
    {
      type: 'Column',
      props: { gap: 'md' },
      children: [
        {
          type: 'KeyValue',
          props: {
            items: {
              分支: 'main',
              提交: '4f2a1c9 — fix(auth): share one refresh',
              环境: 'production',
            },
          },
        },
        {
          type: 'Form',
          props: { action: 'deploy' },
          children: [
            {
              type: 'Field',
              props: { label: '发布说明', hint: '会写进 release notes' },
              children: [
                {
                  type: 'Textarea',
                  props: { name: 'notes', rows: 3, placeholder: '修复 token 刷新竞态…' },
                },
              ],
            },
            {
              type: 'Field',
              props: { label: '部署策略' },
              children: [
                {
                  type: 'Select',
                  props: {
                    name: 'strategy',
                    value: 'canary',
                    options: [
                      { value: 'canary', label: '灰度 10%' },
                      { value: 'rolling', label: '滚动更新' },
                      { value: 'all', label: '全量' },
                    ],
                  },
                },
              ],
            },
            {
              type: 'Checkbox',
              props: { name: 'notify', label: '部署完成后通知 #releases', value: true },
            },
            {
              type: 'Row',
              props: { gap: 'sm', justify: 'end' },
              children: [
                {
                  type: 'Button',
                  props: { label: '取消', variant: 'ghost', onClick: { action: 'cancel' } },
                },
                {
                  type: 'Button',
                  props: { label: '部署', variant: 'primary', onClick: { action: 'deploy' } },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

/** A read-only status surface, driven entirely by `data` templates. */
export const STATUS_SPEC: A2UINode = {
  type: 'Card',
  props: { title: '{{job.name}}' },
  children: [
    {
      type: 'Column',
      props: { gap: 'sm' },
      children: [
        { type: 'Badge', props: { text: '{{job.status}}', tone: 'success' } },
        { type: 'Progress', props: { value: '{{job.percent}}', max: 100, label: '构建进度' } },
        {
          type: 'Table',
          props: {
            columns: [
              { key: 'step', label: '步骤' },
              { key: 'duration', label: '耗时' },
            ],
            rows: '{{job.steps}}',
          },
        },
        {
          type: 'Alert',
          when: 'job.warning',
          props: { tone: 'warning', title: '注意', text: '{{job.warning}}' },
        },
      ],
    },
  ],
}

export const STATUS_DATA = {
  job: {
    name: 'build #482',
    status: 'passed',
    percent: 100,
    warning: '缓存未命中，本次构建慢了 40s',
    steps: [
      { step: 'install', duration: '18s' },
      { step: 'typecheck', duration: '9s' },
      { step: 'test', duration: '31s' },
      { step: 'build', duration: '24s' },
    ],
  },
}

// ---------------------------------------------------------------------------
// Static messages
// ---------------------------------------------------------------------------

export function userMessage(text: string, id = 'u1'): ChatMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
    createdAt: NOW - 4 * MINUTE,
    status: 'complete',
  }
}

export const ASSISTANT_FULL: ChatMessage = {
  id: 'a1',
  role: 'assistant',
  createdAt: NOW - 3 * MINUTE,
  status: 'complete',
  reactions: [
    { key: '🎯', count: 2 },
    { key: '🔥', count: 1, active: true },
  ],
  parts: [
    {
      type: 'reasoning',
      text: '用户说偶发 401。先看 auth.ts 里 token 是怎么存的，再看刷新逻辑有没有并发保护。如果每个请求各自刷新，那么第二个请求会拿一个已经被轮换掉的 refresh token —— 这正好解释了「偶发」。',
      durationMs: 4200,
    },
    {
      type: 'tool',
      toolCallId: 't1',
      name: 'read_file',
      state: 'output-available',
      input: { path: 'src/auth.ts', startLine: 1, endLine: 80 },
      output: { lines: 80, bytes: 2314, language: 'typescript' },
      durationMs: 120,
    },
    {
      type: 'tool',
      toolCallId: 't2',
      name: 'grep',
      state: 'output-available',
      input: { pattern: 'refresh\\(', glob: 'src/**/*.ts' },
      output: ['src/auth.ts:42', 'src/api/client.ts:17', 'src/hooks/useSession.ts:9'],
      durationMs: 340,
    },
    {
      type: 'tool',
      toolCallId: 't3',
      name: 'run_tests',
      state: 'output-error',
      input: { filter: 'auth' },
      error:
        'Command failed: 2 of 14 tests failed\n  ✕ refreshes once under concurrency\n  ✕ keeps the session on a slow network',
      durationMs: 8600,
    },
    { type: 'text', text: MARKDOWN_SAMPLE },
    {
      type: 'source',
      url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-6',
      title: 'RFC 6749 §6 — Refreshing an Access Token',
      snippet:
        'The authorization server MAY issue a new refresh token, in which case the client MUST discard the old one.',
    },
  ],
}

/** Prose with `[n]` markers plus the three sources they point at. */
export const ASSISTANT_CITED: ChatMessage = {
  id: 'a4',
  role: 'assistant',
  createdAt: NOW - 2 * MINUTE,
  status: 'complete',
  parts: [
    { type: 'text', text: MARKDOWN_CITED },
    {
      type: 'source',
      url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-6',
      title: 'RFC 6749 §6 — Refreshing an Access Token',
      snippet:
        'The authorization server MAY issue a new refresh token, in which case the client MUST discard the old one.',
    },
    {
      type: 'source',
      url: 'https://datatracker.ietf.org/doc/html/rfc9700',
      title: 'RFC 9700 — Best Current Practice for OAuth 2.0 Security',
      snippet:
        'Refresh tokens MUST be sender-constrained or use refresh token rotation with replay detection.',
    },
    {
      type: 'source',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html',
      title: 'OWASP — 不要在 Web Storage 里放敏感数据',
    },
  ],
}

export const ASSISTANT_STREAMING: ChatMessage = {
  id: 'a2',
  role: 'assistant',
  createdAt: NOW,
  status: 'streaming',
  parts: [{ type: 'reasoning', text: '先确认这个函数在并发下是怎么走的，' }],
}

export const ASSISTANT_ERROR: ChatMessage = {
  id: 'a3',
  role: 'assistant',
  createdAt: NOW,
  status: 'error',
  parts: [
    { type: 'text', text: '我正在读取仓库…' },
    { type: 'error', message: '与模型服务的连接中断（504 Gateway Timeout）', retryable: true },
  ],
}

// ---------------------------------------------------------------------------
// The end-to-end mock script
// ---------------------------------------------------------------------------

/**
 * One turn that touches every subsystem: reasoning, three tool calls (one of which
 * fails), a long markdown answer, and an interactive A2UI surface. If this plays
 * through cleanly, the streaming path is wired end to end.
 */
export const FULL_TURN: MockStep[] = mockTurn(
  mockReasoning(
    '用户说线上偶发 401，但本地复现不了。偶发 + 只在线上，通常意味着并发。先读 auth.ts 看 token 是怎么缓存的，再 grep 一下 refresh 的调用点，最后跑一遍 auth 相关的测试确认现状。',
    { chunkSize: 12, delay: 45 },
  ),
  mockTool({
    name: 'read_file',
    input: { path: 'src/auth.ts', startLine: 1, endLine: 80 },
    output: { lines: 80, bytes: 2314, language: 'typescript' },
    runMs: 400,
  }),
  mockTool({
    name: 'grep',
    input: { pattern: 'refresh\\(', glob: 'src/**/*.ts' },
    output: ['src/auth.ts:42', 'src/api/client.ts:17', 'src/hooks/useSession.ts:9'],
    runMs: 700,
  }),
  mockTool({
    name: 'run_tests',
    input: { filter: 'auth' },
    error:
      'Command failed: 2 of 14 tests failed\n  ✕ refreshes once under concurrency\n  ✕ keeps the session on a slow network',
    runMs: 2200,
  }),
  mockText(MARKDOWN_SAMPLE, { chunkSize: 18, delay: 22 }),
  mockA2UI('deploy-1', DEPLOY_FORM_SPEC),
)

/** The reply after the user acts on the surface — short, and with no further questions. */
export const FOLLOW_UP: MockStep[] = mockTurn(
  mockText('好的，已经按灰度 10% 发起部署，完成后我会在 #releases 里同步结果。', {
    chunkSize: 10,
    delay: 30,
  }),
)

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

const TITLE_STEMS = [
  '修复 token 刷新竞态',
  '重构消息列表的虚拟滚动',
  'Tailwind v4 迁移清单',
  '为什么 SSE 在 Safari 断流',
  '给 CI 加上类型检查',
  'Postgres 索引选择',
  '把 Storybook 升到 8',
  '设计 A2UI 的组件注册表',
  '流式 Markdown 的闪烁问题',
  '中文输入法回车误发送',
  '压缩首屏 JS 体积',
  'RSC 下的 use client 边界',
  '日志采样策略',
  '灰度发布回滚预案',
  'oklch 色板生成脚本',
]

const PREVIEWS = [
  '并发请求各自刷新，后到的那个拿到 401…',
  '行高不一致的时候，前缀和 + 二分比统一行高稳',
  '@theme 是 CSS-first 的，preset 那套不再需要',
  '心跳注释可以让代理不断开连接',
  'tsc --noEmit 跑在 lint 之前更快',
]

/** Deterministic pseudo-randomness, so the list looks varied but never changes. */
function hash(n: number): number {
  let x = Math.sin(n * 12.9898) * 43758.5453
  x -= Math.floor(x)
  return x
}

export const AGENTS: Agent[] = [
  { id: 'coder', name: '代码助手', description: '读仓库、改代码、跑测试', avatar: '⌘' },
  { id: 'analyst', name: '数据分析', description: '取数、画图、写结论', avatar: '📊' },
  { id: 'ops', name: '运维值班', description: '看日志、查告警、发布' },
  /* Intentionally owns nothing in `AGENT_CONVERSATIONS` — an agent you have created but
   * not used yet still needs a header, otherwise there is nowhere to start its first chat. */
  { id: 'translator', name: '文档翻译', description: '中英互译，保留术语' },
]

export const MANY_AGENTS: Agent[] = [
  ...AGENTS,
  { id: 'reviewer', name: '代码评审', avatar: '👀' },
  { id: 'writer', name: '文案', avatar: '✍️' },
]

/**
 * Spreads conversations over the given agents, deliberately leaving roughly one slot in
 * `agentIds.length + 1` unassigned so the trailing bucket is actually visible in stories.
 */
function agentFor(index: number, agentIds: string[]): string | undefined {
  const slot = Math.floor(hash(index + 100) * (agentIds.length + 1))
  return agentIds[slot]
}

export function makeConversations(count: number, agentIds?: string[]): Conversation[] {
  return Array.from({ length: count }, (_, i) => {
    const r = hash(i + 1)
    /* Spread across every bucket the date grouping has: today, yesterday, this week,
     * this month, older. A list that only exercises one group proves nothing. */
    const age =
      i < 3
        ? r * 6 * HOUR
        : i < 6
          ? DAY + r * 12 * HOUR
          : i < 14
            ? (2 + r * 5) * DAY
            : i < 30
              ? (8 + r * 20) * DAY
              : (35 + r * 400) * DAY

    return {
      id: `c${i}`,
      title: `${TITLE_STEMS[i % TITLE_STEMS.length]}${i >= TITLE_STEMS.length ? ` (${Math.floor(i / TITLE_STEMS.length) + 1})` : ''}`,
      preview: PREVIEWS[i % PREVIEWS.length],
      updatedAt: NOW - age,
      createdAt: NOW - age - HOUR,
      pinned: i === 1 || i === 4,
      unread: i === 2,
      agentId: agentIds ? agentFor(i, agentIds) : undefined,
    }
  })
}

export const CONVERSATIONS = makeConversations(24)
export const MANY_CONVERSATIONS = makeConversations(500)

/** Only the first three agents get conversations; `translator` stays empty on purpose. */
export const AGENT_CONVERSATIONS = makeConversations(
  24,
  AGENTS.slice(0, 3).map((agent) => agent.id),
)

export const MANY_AGENT_CONVERSATIONS = makeConversations(
  540,
  MANY_AGENTS.map((agent) => agent.id),
)
