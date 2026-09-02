import type { Meta, StoryObj } from '@storybook/react'

import type { ChatMessage, ToolPart } from '@xinjiyuan97/chat-core'
import {
  ChatThemeProvider,
  ErrorPart,
  FilePart,
  ImageIcon,
  ImageSkeleton,
  JsonViewer,
  ReasoningPart,
  SearchIcon,
  SourcesPart,
  ToolCallPart,
  defineTool,
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

export const ReasoningWithoutText: Story = {
  name: 'Reasoning — no content returned',
  parameters: {
    docs: {
      description: {
        story:
          '部分模型只回报「思考发生过 + 时长」，不返回思考正文。此时折叠不成立 —— 点开是一片空白，比不给箭头更糟 —— 所以降级成一行静态回执。',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      <ReasoningPart part={{ type: 'reasoning', text: '', startedAt: Date.now() }} streaming />
      <ReasoningPart part={{ type: 'reasoning', text: '', durationMs: 3200 }} />
      {/* Flagged by the transport, before any duration is known. */}
      <ReasoningPart part={{ type: 'reasoning', text: '', redacted: true }} />
      {/* For comparison: the same row when there *is* something to open. */}
      <ReasoningPart part={{ type: 'reasoning', text: REASONING_TEXT, durationMs: 4200 }} />
    </div>
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

export const ToolCallCompact: Story = {
  name: 'Tool call — compact',
  parameters: {
    docs: {
      description: {
        story:
          '`toolVariant="compact"` 去掉卡片与展开区，只剩一行。跑二十个工具的一轮里，这是「一份可以扫的日志」和「二十张要读过去的卡片」的差别；代价是看不到 payload。',
      },
    },
  },
  render: () => (
    <ChatThemeProvider toolVariant="compact">
      <div className="flex flex-col">
        {TOOL_STATES.map((part) => (
          <ToolCallPart key={part.toolCallId} part={part} message={HOST} />
        ))}
      </div>
    </ChatThemeProvider>
  ),
}

const REGISTERED_TOOLS = {
  generate_image: defineTool({
    label: '生成图片',
    icon: ImageIcon,
    // Not `spin`: a rotating camera reads as a rendering fault, not as progress.
    runningMotion: 'pulse',
    tone: 'accent',
    summary: (part) => (part.input as { prompt?: string } | undefined)?.prompt,
  }),
  web_search: defineTool({
    label: '联网搜索',
    icon: SearchIcon,
    compact: true,
  }),
}

export const ToolCallRegistered: Story = {
  name: 'Tool call — registered icon + motion',
  parameters: {
    docs: {
      description: {
        story:
          '`tools` 注册表按名字接管一个工具的外观：图标、进行中的动效、色调、标签、摘要、展开区，或整块。每一项都是独立可选的 —— 想换个图标不必把整行重写一遍。`web_search` 额外声明了 `compact`，所以它单独走一行。',
      },
    },
  },
  render: () => (
    <ChatThemeProvider tools={REGISTERED_TOOLS}>
      <div className="flex flex-col gap-1">
        <ToolCallPart
          part={{
            type: 'tool',
            toolCallId: 'g1',
            name: 'generate_image',
            state: 'executing',
            input: { prompt: '一只在暴雨里等红灯的柯基，胶片颗粒', size: '1024x1024' },
          }}
          message={HOST}
        />
        <ToolCallPart
          part={{
            type: 'tool',
            toolCallId: 'g2',
            name: 'generate_image',
            state: 'output-available',
            input: { prompt: '一只在暴雨里等红灯的柯基，胶片颗粒' },
            output: { url: 'https://example.com/corgi.png' },
            durationMs: 24_300,
          }}
          message={HOST}
        />
        <ToolCallPart
          part={{
            type: 'tool',
            toolCallId: 'g3',
            name: 'web_search',
            state: 'output-available',
            input: { query: 'oauth refresh token rotation race condition' },
            durationMs: 1200,
          }}
          message={HOST}
        />
        {/* Failure always wins over the registration: a friendly camera on a call that
            blew up is the one case where honouring the icon would mislead. */}
        <ToolCallPart
          part={{
            type: 'tool',
            toolCallId: 'g4',
            name: 'generate_image',
            state: 'output-error',
            input: { prompt: '…' },
            error: 'Content policy: prompt rejected',
            durationMs: 900,
          }}
          message={HOST}
        />
      </div>
    </ChatThemeProvider>
  ),
}

// ---------------------------------------------------------------------------
// Generated images
// ---------------------------------------------------------------------------

const CORGI = 'https://images.unsplash.com/photo-1519098901909-b1553a1190af?w=1024&h=768&fit=crop'

export const ImageLifecycle: Story = {
  name: 'Image — generating → ready → failed',
  parameters: {
    docs: {
      description: {
        story:
          '生图要几十秒。声明了 `width`/`height` 就能按真实宽高比预留盒子，图片落地时不跳版；`progress` 有值时底部出确定性进度条。第三块是失败态。',
      },
    },
  },
  render: () => (
    <div className="flex max-w-md flex-col gap-2">
      <FilePart
        part={{
          type: 'file',
          id: 'i1',
          mediaType: 'image/png',
          status: 'generating',
          width: 1024,
          height: 768,
        }}
      />
      <FilePart
        part={{
          type: 'file',
          id: 'i2',
          mediaType: 'image/png',
          status: 'generating',
          width: 1024,
          height: 1024,
          progress: 0.62,
        }}
      />
      <FilePart
        part={{
          type: 'file',
          id: 'i3',
          mediaType: 'image/png',
          status: 'ready',
          url: CORGI,
          width: 1024,
          height: 768,
          name: 'corgi.png',
        }}
      />
      <FilePart
        part={{
          type: 'file',
          id: 'i4',
          mediaType: 'image/png',
          status: 'error',
          error: '生成被内容策略拒绝',
        }}
      />
    </div>
  ),
}

export const ImageSkeletonRatios: Story = {
  name: 'ImageSkeleton — ratios',
  parameters: {
    docs: {
      description: {
        story:
          '`ImageSkeleton` 也单独导出，供宿主在自己注册的 tool renderer 里复用。没有任何尺寸声明时回落到 1:1 —— 猜错的宽高比仍然好过完全不占位。',
      },
    },
  },
  render: () => (
    <div className="flex max-w-2xl flex-wrap items-start gap-3">
      <ImageSkeleton ratio={1} label="1:1" maxHeight={140} />
      <ImageSkeleton ratio={16 / 9} label="16:9" maxHeight={140} />
      <ImageSkeleton ratio={9 / 16} label="9:16" maxHeight={140} />
      <ImageSkeleton ratio={4 / 3} label="40%" progress={0.4} maxHeight={140} />
    </div>
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
          url: CORGI,
          mediaType: 'image/png',
          name: 'flamegraph.png',
          size: 940_112,
        }}
      />
      {/* A URL that will not resolve. Neutral, not red: a dead asset link is a fact about
          one file, and painting it like a failed generation trains people to ignore the
          alerts that matter. */}
      <FilePart
        part={{ type: 'file', url: 'https://example.invalid/gone.png', mediaType: 'image/png' }}
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
