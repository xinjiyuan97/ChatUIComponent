import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import {
  ChatThemeProvider,
  CodeBlock,
  Markdown,
  TypingText,
  completeMarkdown,
} from '@xinjiyuan97/chat-ui'

import {
  MARKDOWN_CALLOUTS,
  MARKDOWN_DIAGRAMS,
  MARKDOWN_SAMPLE,
  MARKDOWN_SHORT,
  MERMAID_BROKEN,
} from '../fixtures'
import { mockRunCode } from '../mock-run'

const meta = {
  title: 'Chat/Markdown',
  component: Markdown,
  parameters: {
    docs: {
      description: {
        component:
          '流式 Markdown 的三个要点：未闭合语法在解析前补齐（否则代码块会闪成裸文本）、按顶层块 memo（否则长回复每个 delta 都重解析）、Shiki 单例 + 双主题走 CSS 变量（否则切暗色要重新高亮）。',
      },
    },
  },
  // Satisfies the required `children` for the stories that supply their own `render`.
  args: { children: MARKDOWN_SHORT },
} satisfies Meta<typeof Markdown>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  args: { children: MARKDOWN_SHORT },
}

export const LongAnswer: Story = {
  args: { children: MARKDOWN_SAMPLE },
}

/** Replays a long answer character by character — the case the memoisation exists for. */
function Replay({ text, cps = 260 }: { text: string; cps?: number }) {
  const [length, setLength] = useState(0)

  useEffect(() => {
    setLength(0)
    const id = setInterval(() => {
      setLength((n) => {
        if (n >= text.length) {
          clearInterval(id)
          return n
        }
        return Math.min(text.length, n + Math.max(1, Math.round(cps / 20)))
      })
    }, 50)
    return () => clearInterval(id)
  }, [text, cps])

  return (
    <div className="flex flex-col gap-3">
      <Markdown streaming>{text.slice(0, length)}</Markdown>
      <button
        type="button"
        onClick={() => setLength(0)}
        className="self-start rounded-cc-sm border border-cc-border px-2.5 py-1 text-cc-xs text-cc-muted hover:bg-cc-subtle"
      >
        重放
      </button>
    </div>
  )
}

export const Streaming: Story = {
  render: () => <Replay text={MARKDOWN_SAMPLE} />,
}

/**
 * The raw versus repaired comparison. Without the repair, the half-written fence on the
 * left renders as literal text and then snaps into a code block — a visible flash on
 * every long answer that contains code.
 */
export const UnclosedSyntax: Story = {
  name: 'Unclosed syntax repair',
  render: () => {
    const partial =
      '这里有个还没写完的代码块：\n\n```ts\nconst refreshing = null\nexport async function getToken('

    return (
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-cc-xs font-medium text-cc-muted">未修复</h3>
          <div className="rounded-cc-sm border border-cc-border p-3">
            <Markdown>{partial}</Markdown>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-cc-xs font-medium text-cc-muted">completeMarkdown 修复后</h3>
          <div className="rounded-cc-sm border border-cc-border p-3">
            <Markdown>{completeMarkdown(partial)}</Markdown>
          </div>
        </section>
      </div>
    )
  },
}

/**
 * Blockquotes, and the callouts that share the element with them. `> [!WARNING]` is
 * GitHub's syntax, which is what models emit; an unrecognised marker degrades to a plain
 * quote with its text intact rather than leaving a stray `[!DANGER]` in the output.
 */
export const Quotes: Story = {
  name: 'Blockquotes & callouts',
  render: () => <Markdown>{MARKDOWN_CALLOUTS}</Markdown>,
  parameters: {
    docs: {
      description: {
        story:
          '五个等级的图标形状各不相同（圆、灯泡、气泡、三角、八角），不是同一个圆圈换颜色 —— 色觉障碍下颜色分不出来，轮廓分得出来。普通引用是中性的旁白色，只有标记过的提示框才着色。',
      },
    },
  },
}

export const Code: Story = {
  name: 'CodeBlock',
  render: () => (
    <div className="flex flex-col gap-4">
      <CodeBlock
        filename="src/auth.ts"
        language="typescript"
        showLineNumbers
        code={`let refreshing: Promise<Token> | null = null

export async function getToken(): Promise<Token> {
  const cached = store.read()
  if (cached && !isExpired(cached)) return cached

  // Concurrent callers share one refresh instead of each starting their own.
  refreshing ??= refresh(cached).finally(() => {
    refreshing = null
  })

  return refreshing
}`}
      />
      <CodeBlock
        language="bash"
        code={`pnpm add @xinjiyuan97/chat-ui @xinjiyuan97/chat-core
pnpm add -D tailwindcss@next`}
      />
      <CodeBlock
        language="json"
        code={`{ "model": "claude-opus-5", "stream": true, "tools": ["read_file", "grep"] }`}
      />
    </div>
  ),
}

/**
 * ```mermaid fences render as diagrams. `mermaid` is an *optional* peer dependency: when
 * it is not installed the fence falls back to a normal code block, which is also what a
 * diagram the parser rejects does.
 */
export const Diagrams: Story = {
  name: 'Mermaid diagrams',
  render: () => <Markdown>{MARKDOWN_DIAGRAMS}</Markdown>,
  parameters: {
    docs: {
      description: {
        story:
          '图表主题跟随明暗切换重新渲染 —— Mermaid 把颜色烤进 SVG，没法像 Shiki 那样一次输出两套 CSS 变量。渲染走 `securityLevel: "strict"` + `htmlLabels: false`，并且对源码长度和边数设了上限：图表内容是模型输出，同步布局跑飞就是整个标签页卡死。',
      },
    },
  },
}

/**
 * What a model gets wrong. The source stays readable and the parser's own message names
 * the offending line — dropping the fence entirely would lose what the model said.
 */
export const DiagramError: Story = {
  name: 'Mermaid — invalid syntax',
  render: () => <Markdown>{MERMAID_BROKEN}</Markdown>,
}

/**
 * With `onRunCode` on the provider, every code block gets a run button and a result
 * panel. Without it, no button renders anywhere — executing model output is the host's
 * decision, and this library never makes it.
 */
export const Runnable: Story = {
  name: 'Runnable code',
  render: () => (
    <ChatThemeProvider asFragment onRunCode={mockRunCode}>
      <div className="flex flex-col gap-4">
        <CodeBlock
          filename="src/auth.ts"
          language="typescript"
          code={`const token = await getToken()
console.log(token)`}
        />
        {/* Contains `throw`, which the mock runner turns into a failed run. */}
        <CodeBlock
          language="typescript"
          code={`if (!refreshing) {
  throw new Error('refresh token rotated')
}`}
        />
        {/* Defines and prints nothing: an empty-but-successful run still shows a panel,
            so "done" and "nothing happened" stay distinguishable. */}
        <CodeBlock
          language="typescript"
          code={`type Token = { value: string; expiresIn: number }`}
        />
        <CodeBlock language="sql" code={`select status, count(*) from tokens group by status;`} />
        {/* Opting a single block out, even though a runner is available. */}
        <CodeBlock language="bash" runnable={false} code={`rm -rf ./dist`} />
      </div>
    </ChatThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '`onRunCode` 也可以直接传给单个 `CodeBlock`，或者用 `runnable={false}` 把某一块的按钮关掉（上面最后一块）。结果面板贴在代码框底部，成功是中性灰、失败是 danger 色；`durationMs` 有值时显示耗时。想自己管理状态就传受控的 `result` / `running`，这时面板上的清除按钮会隐藏。',
      },
    },
  },
}

export const Typewriter: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <TypingText
        text="打字机效果不是逐字定时器 —— 网络 delta 是突发的，一次来 40 个字然后卡 300ms。useSmoothText 用 rAF 把缓冲区匀速排出，落后太多时自动加速追上。"
        streaming
      />
      <p className="text-cc-xs text-cc-faint">
        `prefers-reduced-motion` 下会直接全量输出，不做逐字揭示。
      </p>
    </div>
  ),
}
