import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { PermissionOption, PermissionRequest, PermissionResolution } from '@xinjiyuan97/core'
import { PermissionMenu } from '@xinjiyuan97/ui'

const meta = {
  title: 'Chat/Permission',
  parameters: {
    docs: {
      description: {
        component:
          'agent 要做有副作用的事之前的审批卡。**内联在消息流里而不是弹窗** —— 弹窗会盖住导致这次请求的推理和工具调用，而那正是判断该不该批准所需要的上下文；审批完卡片原地塌成一行只读记录，留在 transcript 里当审计痕迹。\n\n键盘按终端菜单的习惯：`↑` `↓` 循环、数字键直接提交、`Esc` 等于「拒绝」。选中行用 `bg-cc-subtle` 而不是强调色 —— 强调色一屏只出现一次，在聊天里那个位置属于发送按钮。',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const READ_FILE: PermissionRequest = {
  id: 'req-read',
  toolName: 'read_file',
  detail: 'packages/core/src/reducer.ts',
  risk: 'low',
}

const RM: PermissionRequest = {
  id: 'req-rm',
  toolName: 'bash',
  title: 'bash 想在项目根目录执行命令',
  detail: 'rm -rf node_modules .next dist',
  detailLanguage: 'bash',
  risk: 'high',
}

const FETCH: PermissionRequest = {
  id: 'req-fetch',
  toolName: 'fetch',
  title: 'fetch 想访问外部地址',
  detail: 'POST https://api.internal.example.com/v1/deploy',
  risk: 'medium',
}

/**
 * The live card, with the host's side of the wiring.
 *
 * Left uncontrolled on purpose: without a `resolution` prop the menu keeps its own answer
 * and collapses in place, which is what a host gets for free before it has persisted
 * anything server-side.
 */
function Demo({ request, options }: { request: PermissionRequest; options?: PermissionOption[] }) {
  const [decided, setDecided] = useState<PermissionResolution | null>(null)

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <PermissionMenu request={request} options={options} onDecide={setDecided} />
      <p className="font-cc-mono text-cc-xs text-cc-faint">
        {decided
          ? `onDecide → ${decided.option}${decided.reason ? `（${decided.reason}）` : ''}`
          : '等待审批…（Tab 进卡片后试试 ↑↓ / 1 2 3 / Esc）'}
      </p>
    </div>
  )
}

export const Pending: Story = {
  name: '待审批 — 低风险',
  render: () => <Demo request={READ_FILE} />,
}

export const HighRisk: Story = {
  name: '待审批 — 高风险',
  parameters: {
    docs: {
      description: {
        story:
          '整卡着色，不是只换个图标：一张普通面板上的红色小图标，正是读者会一路略过直接点按钮的东西。',
      },
    },
  },
  render: () => <Demo request={RM} />,
}

export const MediumRisk: Story = {
  name: '待审批 — 中风险',
  render: () => <Demo request={FETCH} />,
}

export const DenyWithReason: Story = {
  name: '拒绝并说明原因',
  parameters: {
    docs: {
      description: {
        story:
          '按 `3` 或 `Esc` 只是把光标移到「拒绝」并展开理由框，**不会立刻提交** —— 「别这么做，换个方式」是回给模型信息量最大的答案，选中即提交就把它弄丢了。理由不填也能提交：没有解释的「不」仍然是一个有效回答。',
      },
    },
  },
  render: () => <Demo request={RM} />,
}

export const CustomOptions: Story = {
  name: '自定义选项',
  render: () => (
    <Demo
      request={{
        id: 'req-migrate',
        toolName: 'bash',
        title: '要在生产库上跑迁移吗？',
        detail: 'pnpm prisma migrate deploy --schema ./prisma/schema.prisma',
        detailLanguage: 'bash',
        risk: 'high',
      }}
      options={[
        {
          value: 'dry-run',
          decision: 'allow-once',
          label: '先跑 dry-run',
          description: '只打印将要执行的 SQL，不落库',
        },
        {
          value: 'apply',
          decision: 'allow-once',
          label: '直接执行',
          description: '在 prod-db-1 上应用 3 个待执行迁移',
        },
        {
          value: 'stop',
          decision: 'deny',
          label: '先别动',
          description: '把顾虑写下来带回给模型',
          promptForReason: true,
          requiresReason: true,
        },
      ]}
    />
  ),
}

export const Allowed: Story = {
  name: '记录 — 已允许',
  parameters: {
    docs: {
      description: {
        story: '审批完不消失。transcript 就是审计痕迹 —— 一批准就没影的授权，事后谁也指不出来。',
      },
    },
  },
  render: () => (
    <PermissionMenu
      request={RM}
      resolution={{ requestId: RM.id, option: 'allow-once', decision: 'allow-once' }}
    />
  ),
}

export const AllowedAlways: Story = {
  name: '记录 — 本次会话都允许',
  render: () => (
    <PermissionMenu
      request={READ_FILE}
      resolution={{ requestId: READ_FILE.id, option: 'allow-always', decision: 'allow-always' }}
    />
  ),
}

export const Denied: Story = {
  name: '记录 — 已拒绝',
  render: () => (
    <PermissionMenu
      request={RM}
      resolution={{
        requestId: RM.id,
        option: 'deny',
        decision: 'deny',
        reason: 'node_modules 删了要重装十分钟，先只删 .next 试试',
      }}
    />
  ),
}

export const Disabled: Story = {
  name: '选项被策略禁用',
  parameters: {
    docs: {
      description: {
        story:
          '禁用项由方向键**跳过**而不是停在上面死路一条。这里「本次会话都允许」被组织策略关掉了。',
      },
    },
  },
  render: () => (
    <Demo
      request={FETCH}
      options={[
        { value: 'allow-once', decision: 'allow-once' },
        {
          value: 'allow-always',
          decision: 'allow-always',
          description: '组织策略已禁用',
          disabled: true,
        },
        { value: 'deny', decision: 'deny', promptForReason: true },
      ]}
    />
  ),
}
