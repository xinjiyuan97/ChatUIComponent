import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import {
  Button,
  Collapsible,
  IconButton,
  Skeleton,
  SkeletonText,
  ThinkingDots,
  ToolIcon,
  TrashIcon,
  CopyIcon,
  SearchIcon,
  StreamingCursor,
} from '@xinjiyuan97/chat-ui'

const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    docs: {
      description: {
        component:
          '所有颜色是 oklch，暗色主题只是把 L 挪一挪、C/H 基本不动，所以不会出现色相漂移。切换顶栏的主题开关看对照 —— 暗色下阴影几乎无用，分层改由边框和留白承担。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const COLORS = [
  'canvas',
  'surface',
  'sunken',
  'subtle',
  'border',
  'border-strong',
  'fg',
  'muted',
  'faint',
  'accent',
  'accent-hover',
  'accent-subtle',
  'success',
  'success-subtle',
  'warning',
  'warning-subtle',
  'danger',
  'danger-subtle',
]

export const Colors: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {COLORS.map((name) => (
        <div key={name} className="flex flex-col gap-1.5">
          <div
            className="h-14 rounded-cc-sm border border-cc-border"
            style={{ backgroundColor: `var(--color-cc-${name})` }}
          />
          <code className="font-cc-mono text-cc-xs text-cc-muted">cc-{name}</code>
        </div>
      ))}
    </div>
  ),
}

export const Typography: Story = {
  render: () => (
    <div className="flex max-w-cc-measure flex-col gap-4">
      <p className="text-cc-body leading-[1.65] text-cc-fg">
        正文 `text-cc-body`。行高 1.65，配合 `max-w-cc-measure` 把每行控制在舒服的字数内 ——
        聊天记录是要连续阅读的，行太长会一直丢行。
      </p>
      <p className="text-cc-sm text-cc-muted">
        次级文本 `text-cc-sm` + `text-cc-muted`，用在折叠标题、时间戳、工具名这类地方。
      </p>
      <p className="text-cc-xs text-cc-faint">
        三级文本 `text-cc-xs` + `text-cc-faint`，只用于元信息，不承载内容。
      </p>
      <code className="font-cc-mono text-cc-code text-cc-fg">
        等宽 `font-cc-mono` + `text-cc-code`
      </code>
    </div>
  ),
}

export const Radii: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {['xs', 'sm', 'md', 'lg', 'bubble', 'full'].map((name) => (
        <div key={name} className="flex flex-col items-center gap-1.5">
          <div
            className="size-16 border border-cc-border bg-cc-subtle"
            style={{ borderRadius: `var(--radius-cc-${name})` }}
          />
          <code className="font-cc-mono text-cc-xs text-cc-muted">cc-{name}</code>
        </div>
      ))}
    </div>
  ),
}

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          {(['primary', 'subtle', 'outline', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} variant={variant} size={size}>
              {variant}
            </Button>
          ))}
          <Button variant="primary" size={size} disabled>
            disabled
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <IconButton label="复制" icon={<CopyIcon size={14} />} tooltip />
        <IconButton label="搜索" icon={<SearchIcon size={14} />} tooltip />
        <IconButton label="删除" icon={<TrashIcon size={14} />} tone="danger" tooltip />
      </div>
    </div>
  ),
}

export const Collapsibles: Story = {
  render: () => {
    const Demo = () => {
      const [open, setOpen] = useState(false)
      return (
        <div className="flex max-w-cc-measure flex-col gap-2">
          <Collapsible
            open={open}
            onOpenChange={setOpen}
            header={
              <span className="inline-flex items-center gap-1.5 text-cc-sm text-cc-muted">
                <ToolIcon size={13} />
                受控折叠块
              </span>
            }
          >
            <p className="text-cc-sm text-cc-muted">
              折叠动画用 grid-template-rows 0fr →
              1fr，不需要预先知道内容高度，也不会在展开到一半时卡住。
            </p>
          </Collapsible>
          <Collapsible
            header={<span className="text-cc-sm text-cc-muted">非受控折叠块</span>}
            defaultOpen
          >
            <p className="text-cc-sm text-cc-muted">默认展开，自己管开合状态。</p>
          </Collapsible>
        </div>
      )
    }
    return <Demo />
  },
}

export const LoadingStates: Story = {
  render: () => (
    <div className="flex max-w-cc-measure flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <SkeletonText lines={4} />
      </div>
      <div className="flex items-center gap-6 text-cc-sm text-cc-muted">
        <span className="inline-flex items-center gap-2">
          思考中 <ThinkingDots />
        </span>
        <span className="inline-flex items-center">
          正在输出
          <StreamingCursor />
        </span>
      </div>
    </div>
  ),
}
