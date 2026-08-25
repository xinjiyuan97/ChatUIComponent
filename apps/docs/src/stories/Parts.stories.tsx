import type { Meta, StoryObj } from '@storybook/react'

import type { ChatMessage, ToolPart } from '@xinjiyuan97/chat-core'
import {
  ErrorPart,
  FilePart,
  JsonViewer,
  ReasoningPart,
  SourcesPart,
  ToolCallPart,
} from '@xinjiyuan97/chat-ui'

import { NOW } from '../fixtures'

const HOST: ChatMessage = { id: 'host', role: 'assistant', parts: [], createdAt: NOW }

const REASONING_TEXT = `用户说线上偶发 401，本地复现不了。「偶发 + 只在线上」几乎总是并发问题：本地基本是单请求，线上是页面一打开就并发五六个。

如果每个请求各自发现 token 过期、各自去刷新，那么第二个请求会拿一个已经被轮换掉的 refresh token —— 服务端按 RFC 6749 §6 的建议作废旧 token，于是返回 401。这解释了为什么错误是零星的：只有刷新窗口内并发才会中招。

要验证的话，看 auth.ts 里 getToken 有没有共享的 in-flight promise 就行。`

const meta = {
  title: 'Chat/Parts',
  parameters: {
    docs: {
      description: {
        component:
          '`MessageContent` 按 `part.type` 分派到这些渲染器。折叠块统一用 1px 细线 + 极淡底，不用阴影、不用重色 —— 它们是次要信息，不能盖过正文。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Reasoning
// ---------------------------------------------------------------------------

export const ReasoningStreaming: Story = {
  name: 'Reasoning — streaming',
  render: () => (
    <ReasoningPart part={{ type: 'reasoning', text: REASONING_TEXT.slice(0, 96) }} streaming />
  ),
}

export const ReasoningDone: Story = {
  name: 'Reasoning — finished (auto-collapsed)',
  render: () => (
    <ReasoningPart part={{ type: 'reasoning', text: REASONING_TEXT, durationMs: 4200 }} />
  ),
}

export const ReasoningOpen: Story = {
  name: 'Reasoning — finished, expanded',
  render: () => (
    <ReasoningPart
      part={{ type: 'reasoning', text: REASONING_TEXT, durationMs: 4200 }}
      defaultOpen
    />
  ),
}

// ---------------------------------------------------------------------------
// Tool calls
// ---------------------------------------------------------------------------

const TOOL_STATES: ToolPart[] = [
  {
    type: 'tool',
    toolCallId: 's1',
    name: 'read_file',
    state: 'input-streaming',
    inputText: '{"path": "src/au',
  },
  {
    type: 'tool',
    toolCallId: 's2',
    name: 'read_file',
    state: 'input-available',
    input: { path: 'src/auth.ts', startLine: 1, endLine: 80 },
  },
  {
    type: 'tool',
    toolCallId: 's3',
    name: 'run_tests',
    state: 'executing',
    input: { filter: 'auth', watch: false },
  },
  {
    type: 'tool',
    toolCallId: 's4',
    name: 'grep',
    state: 'output-available',
    input: { pattern: 'refresh\\(', glob: 'src/**/*.ts' },
    output: {
      matches: [
        { file: 'src/auth.ts', line: 42, text: 'return refresh(cached)' },
        { file: 'src/api/client.ts', line: 17, text: 'await refresh()' },
      ],
      truncated: false,
    },
    durationMs: 340,
  },
  {
    type: 'tool',
    toolCallId: 's5',
    name: 'run_tests',
    state: 'output-error',
    input: { filter: 'auth' },
    error:
      'Command failed: 2 of 14 tests failed\n  ✕ refreshes once under concurrency\n  ✕ keeps the session on a slow network',
    durationMs: 8600,
  },
]

export const ToolCallStates: Story = {
  name: 'Tool call — every state',
  render: () => (
    <div className="flex flex-col gap-1">
      {TOOL_STATES.map((part) => (
        <ToolCallPart key={part.toolCallId} part={part} message={HOST} />
      ))}
    </div>
  ),
}

export const ToolCallMalformedInput: Story = {
  name: 'Tool call — unparseable arguments',
  render: () => (
    <ToolCallPart
      // The model emitted invalid JSON. Showing the raw text beats showing nothing, and
      // beats crashing the message outright.
      part={{
        type: 'tool',
        toolCallId: 's6',
        name: 'write_file',
        state: 'input-available',
        inputText: '{"path": "src/auth.ts", "content": "…unterminated',
      }}
      message={HOST}
    />
  ),
}

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

export const Files: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <FilePart
        part={{
          type: 'file',
          url: '#',
          mediaType: 'application/pdf',
          name: '架构评审.pdf',
          size: 2_411_232,
        }}
      />
      <FilePart
        part={{
          type: 'file',
          url: '#',
          mediaType: 'text/csv',
          name: 'latency-p99.csv',
          size: 18_402,
        }}
      />
      <FilePart
        part={{
          type: 'file',
          url: '#',
          mediaType: 'image/png',
          name: 'flamegraph.png',
          size: 940_112,
        }}
      />
    </div>
  ),
}

export const Sources: Story = {
  render: () => (
    <SourcesPart
      sources={[
        {
          type: 'source',
          url: 'https://datatracker.ietf.org/doc/html/rfc6749#section-6',
          title: 'RFC 6749 §6 — Refreshing an Access Token',
          snippet:
            'The authorization server MAY issue a new refresh token, in which case the client MUST discard the old one.',
        },
        {
          type: 'source',
          url: 'https://developer.mozilla.org/docs/Web/API/AbortController',
          title: 'AbortController — MDN',
        },
      ]}
    />
  ),
}

export const Errors: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <ErrorPart
        part={{
          type: 'error',
          message: '与模型服务的连接中断（504 Gateway Timeout）',
          retryable: true,
        }}
        onRetry={() => {}}
      />
      <ErrorPart
        part={{ type: 'error', message: '当前模型不支持该附件类型。', retryable: false }}
      />
    </div>
  ),
}

export const Json: Story = {
  name: 'JSON viewer',
  render: () => (
    <div className="max-w-xl">
      <JsonViewer
        value={{
          model: 'claude-opus-5',
          usage: { inputTokens: 18_204, outputTokens: 1_942, cacheReadTokens: 16_000 },
          tools: ['read_file', 'grep', 'run_tests'],
          nested: { deeply: { hidden: { until: 'expanded' } } },
          finishReason: 'stop',
          stream: true,
          seed: null,
        }}
      />
    </div>
  ),
}
