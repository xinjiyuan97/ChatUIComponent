import { useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import {
  useAttachments,
  usePromptQueue,
  type Attachment,
  type ChatMessage,
  type QuotedMessage,
} from '@xinjiyuan97/chat-core'
import {
  AgentIcon,
  AttachmentList,
  ChatMessageList,
  Message,
  ModelSelect,
  PromptBackdrop,
  PromptInput,
  QuotePreview,
  SuggestionChips,
} from '@xinjiyuan97/chat-ui'

import { MODELS, NOW } from '../fixtures'
import { useMockVoice } from '../mock-voice'

const meta = {
  title: 'Chat/Composer',
  component: PromptInput,
  parameters: {
    docs: {
      description: {
        component:
          '**中文输入法必测**：拼字过程中按 Enter 是「选词」，不是发送。组件用 `compositionstart/end` 打标记，组合态下忽略 Enter。这个坑几乎所有自研聊天框都踩过 —— 换输入法后请手动验一遍。\n\n多模态输入分两块：`useAttachments` 管附件（选择 / 拖拽 / 粘贴 / 校验 / 上传），`useVoiceInput` 管语音。两个都是 headless hook，组件只是把它们画出来。\n\n模型选择传 `models` 就出现，受控 / 非受控都支持；组件不做任何 id → endpoint 的映射，选中的 id 原样回给你。',
      },
    },
  },
  args: {
    placeholder: '问点什么…',
    showHint: true,
    onSubmit: () => {},
  },
} satisfies Meta<typeof PromptInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Prefilled: Story = {
  args: {
    defaultValue: '帮我读一下 src/auth.ts，我怀疑 token 刷新在并发下有竞态，但本地复现不了。',
  },
}

export const Streaming: Story = {
  name: 'Streaming (send becomes stop)',
  args: { streaming: true, onStop: () => {} },
}

export const Disabled: Story = {
  args: { disabled: true, placeholder: '当前会话已归档' },
}

/** Wraps a story in the note that explains what to try. */
function Hint({ children }: { children: string }) {
  return <p className="mb-3 text-cc-xs leading-[1.7] text-cc-faint">{children}</p>
}

/* Named `WithAttachments` to keep the story id stable — it predates the multimodal work,
 * and renaming it would silently 404 anyone's bookmark. */
export const WithAttachments: Story = {
  name: 'Attachments (pick, drag, paste)',
  render: (args) => {
    const Demo = () => {
      const [sent, setSent] = useState<string[]>([])
      const attachments = useAttachments({
        accept: 'image/*,application/pdf,text/csv,.md,.log',
        maxSize: 5 * 1024 * 1024,
        maxFiles: 6,
      })

      return (
        <div>
          <Hint>
            三种方式都能加附件：点回形针选文件、把文件拖到输入框上、或者直接 Ctrl/⌘+V 粘贴截图。没配
            onUpload，所以文件被读成 data URL 直接进 message.parts。 超过 5MB
            或类型不在白名单里的会被挡下来。
          </Hint>
          <PromptInput
            {...args}
            attachments={attachments}
            showImageButton
            onSubmit={(text, options) =>
              setSent((list) => [
                ...list,
                `${text || '（无文字）'} + ${options.parts.length} 个附件`,
              ])
            }
          />
          {sent.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-cc-xs text-cc-muted">
              {sent.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    return <Demo />
  },
}

export const AttachmentsUploading: Story = {
  name: 'Attachments (with an upload hook)',
  render: (args) => {
    const Demo = () => {
      const [errors, setErrors] = useState<string[]>([])
      const attachments = useAttachments({
        maxSize: 20 * 1024 * 1024,
        onError: (message, file) => setErrors((list) => [...list, `${file.name}: ${message}`]),
        // Stands in for a real upload: two seconds, and anything with "fail" in the name
        // rejects so the error state is reachable without breaking the network.
        onUpload: (file) =>
          new Promise<string>((resolve, reject) => {
            setTimeout(() => {
              if (file.name.includes('fail')) reject(new Error('上传失败，请重试'))
              else resolve(`https://cdn.example.com/${encodeURIComponent(file.name)}`)
            }, 2000)
          }),
      })

      return (
        <div>
          <Hint>
            配了 onUpload：文件先传到你的存储，拿回 URL 再进 parts。上传期间发送按钮是禁用的 ——
            附件还没就绪就发出去，模型会收到一个空链接。文件名里带 fail 会走失败分支。
          </Hint>
          <PromptInput {...args} attachments={attachments} />
          {errors.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-cc-xs text-cc-danger">
              {errors.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    return <Demo />
  },
}

/* Static rows, because three of these four states are transient by nature. */
const ATTACHMENT_STATES: Attachment[] = [
  {
    id: 'f1',
    name: '架构评审.pdf',
    size: 2_411_232,
    mediaType: 'application/pdf',
    status: 'ready',
  },
  {
    id: 'f2',
    name: 'flamegraph.png',
    size: 940_112,
    mediaType: 'image/png',
    status: 'ready',
    previewUrl:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23c2410c"/><rect y="46" width="80" height="12" fill="%23fdba74"/><rect y="62" width="52" height="12" fill="%23fed7aa"/></svg>',
  },
  {
    id: 'f3',
    name: 'latency-p99.csv',
    size: 18_402,
    mediaType: 'text/csv',
    status: 'pending',
  },
  {
    id: 'f4',
    name: 'core-dump.bin',
    size: 84_112_004,
    mediaType: 'application/octet-stream',
    status: 'error',
    error: '超过 20MB',
  },
]

export const AttachmentStates: Story = {
  name: 'Attachment states',
  render: () => (
    <div>
      <Hint>
        就绪、图片缩略图、上传中、失败。图片走缩略图而不是文件名，因为附一张截图时你唯一想确认的就是它是不是那张。
      </Hint>
      <AttachmentList attachments={ATTACHMENT_STATES} onRemove={() => {}} />
    </div>
  ),
}

export const WithModelSelect: Story = {
  name: 'Model picker',
  render: (args) => {
    const Demo = () => {
      const [model, setModel] = useState(MODELS[1]?.id)
      return (
        <div>
          <Hint>
            模型选择放在工具栏最左边，只显示名字、不上强调色 —— 这一行的强调色预算已经给了发送按钮。
            展开后用上下键走，Enter 选中，Esc 关闭；打开时光标默认落在当前选中项上，而不是第一项。
            最后一个是 disabled，代表工作区没开通的模型：列出来比藏起来好，用户至少知道有这个东西。
          </Hint>
          <PromptInput {...args} models={MODELS} model={model} onModelChange={setModel} />
          <p className="mt-3 text-cc-xs text-cc-faint">
            当前：<span className="text-cc-muted">{model}</span>
          </p>
        </div>
      )
    }
    return <Demo />
  },
}

export const ModelSelectAlone: Story = {
  name: 'ModelSelect (standalone)',
  render: () => (
    <div>
      <Hint>
        选择器本身也是导出的，可以放进消息头、设置面板或者你自己的工具栏。默认向上展开（composer
        在页面底部），需要向下时传 placement="bottom"。
      </Hint>
      <div className="flex items-center gap-4">
        <ModelSelect models={MODELS} placement="bottom" />
        <ModelSelect models={MODELS} defaultValue="deep" placement="bottom" />
        <ModelSelect models={MODELS} disabled placement="bottom" />
      </div>
    </div>
  ),
}

/** A reply worth quoting: several distinct sentences, none of them the whole answer. */
const QUOTABLE: ChatMessage = {
  id: 'q1',
  role: 'assistant',
  status: 'complete',
  createdAt: NOW,
  parts: [
    {
      type: 'text',
      text: '三处都要改。`getToken` 里把刷新收敛到一个共享 promise 上，这是主修复；`fetchWithAuth` 的重试上限从 3 降到 1，因为竞态修好之后重试只会掩盖新问题；`useSession` 那个闪一下登出态的逻辑可以整段删掉。\n\n测试我建议补两个：一个并发下只刷新一次，一个刷新失败后状态回到 idle。',
    },
  ],
}

export const WithQuote: Story = {
  name: 'Quote reply',
  render: (args) => {
    const Demo = () => {
      const [quote, setQuote] = useState<QuotedMessage | null>(null)
      const [sent, setSent] = useState<{ text: string; quote?: QuotedMessage }[]>([])

      return (
        <div className="flex flex-col gap-4">
          <Hint>
            在下面这条回复里选中一两句话，然后点操作栏里的引号按钮 ——
            被选中的那段会带到输入框上方。什么都没选就点，引用的是整条消息。 条子上的 ×
            或者输入框里按 Esc 都能取消；发送后自动清空。
          </Hint>

          <ChatMessageList>
            <Message
              message={QUOTABLE}
              showAvatar
              quoteAuthor="助手"
              onQuote={(next) => setQuote(next)}
            />
          </ChatMessageList>

          <PromptInput
            {...args}
            quote={quote}
            onQuoteRemove={() => setQuote(null)}
            onSubmit={(text, options) =>
              setSent((list) => [...list, { text, quote: options.quote }])
            }
          />

          {sent.length > 0 && (
            <ul className="flex flex-col gap-2 text-cc-xs">
              {sent.map((entry, index) => (
                <li key={index} className="flex flex-col gap-0.5">
                  {entry.quote && (
                    <span className="truncate text-cc-faint">↳ 引用：{entry.quote.text}</span>
                  )}
                  <span className="text-cc-muted">{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    return <Demo />
  },
  parameters: {
    docs: {
      description: {
        story:
          '引用不会被拼进输入框的文字里，而是原样放在 `onSubmit` 的 `options.quote` 上 —— 它最终变成一个 `>` 块、一条独立消息，还是请求里的一个字段，是宿主的决定。引用文本按纯文本渲染，模型回复里的 `#` 或图片不会在输入框里变成真的元素。',
      },
    },
  },
}

/** The strip on its own, for hosts wiring their own capture. */
export const QuoteStates: Story = {
  name: 'Quote strip',
  render: () => (
    <div className="flex flex-col gap-3">
      <QuotePreview quote={{ author: '助手', text: '把刷新收敛到一个共享 promise 上。' }} />
      <QuotePreview
        quote={{ text: QUOTABLE.parts.map((p) => (p.type === 'text' ? p.text : '')).join('') }}
        onRemove={() => {}}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '没有 `author` 时标题退回本地化的「引用回复」。长引用夹到两行 —— 选中一整屏文字后把输入框顶出视口，比看不全引用更糟。没传 `onRemove` 就不渲染关闭按钮。',
      },
    },
  },
}

export const Voice: Story = {
  name: 'Voice — live transcript',
  render: (args) => {
    const Demo = () => {
      // The real hook needs a mic and a Chromium build; this fake drives the same interface.
      const voice = useMockVoice({ mode: 'native' })
      return (
        <div>
          <Hint>
            点麦克风开始。原生识别模式下文字是边说边出的，输入框直接显示 base + 实时转写；
            期间输入框是只读的，免得手打和识别结果互相覆盖。右侧 × 是丢弃，不是停止。
          </Hint>
          <PromptInput {...args} voice={voice} />
        </div>
      )
    }
    return <Demo />
  },
}

export const VoiceTranscribing: Story = {
  name: 'Voice — record then transcribe',
  render: (args) => {
    const Demo = () => {
      const voice = useMockVoice({ mode: 'recorder' })
      return (
        <div>
          <Hint>
            传了 transcribe 就走这条路：MediaRecorder 录音、停止后把 Blob 交给你的接口。
            录音期间有实时电平条，停止后是转写中的 loading，全浏览器可用。
          </Hint>
          <PromptInput {...args} voice={voice} />
        </div>
      )
    }
    return <Demo />
  },
}

export const Multimodal: Story = {
  name: 'Attachments + voice together',
  render: (args) => {
    const Demo = () => {
      const attachments = useAttachments({ accept: 'image/*,application/pdf' })
      const voice = useMockVoice({ mode: 'native' })
      return (
        <div>
          <Hint>
            完整形态：回形针、图片、麦克风三个入口并排，附件列表在文本框上方，
            录音时整条工具栏被录音状态条接管。
          </Hint>
          <PromptInput {...args} attachments={attachments} voice={voice} showImageButton />
        </div>
      )
    }
    return <Demo />
  },
}

export const WithSuggestions: Story = {
  render: (args) => {
    const Demo = () => {
      const [value, setValue] = useState('')
      return (
        <div className="flex flex-col gap-3">
          <SuggestionChips
            suggestions={[
              '线上偶发 401，帮我看一下',
              '解释这段代码在并发下的行为',
              '给这个模块补一个并发测试',
              '把 Storybook 升到 8',
            ]}
            onSelect={setValue}
          />
          <PromptInput {...args} value={value} onValueChange={setValue} />
        </div>
      )
    }
    return <Demo />
  },
}

export const Controlled: Story = {
  render: (args) => {
    const Demo = () => {
      const [value, setValue] = useState('')
      const [sent, setSent] = useState<string[]>([])

      return (
        <div className="flex flex-col gap-3">
          <PromptInput
            {...args}
            value={value}
            onValueChange={setValue}
            onSubmit={(text) => {
              setSent((list) => [...list, text])
              setValue('')
            }}
          />
          <div className="flex flex-col gap-1 text-cc-xs text-cc-faint">
            <span>已发送 {sent.length} 条：</span>
            {sent.map((text, index) => (
              <span key={index} className="truncate text-cc-muted">
                {text}
              </span>
            ))}
          </div>
        </div>
      )
    }
    return <Demo />
  },
}

// ---------------------------------------------------------------------------
// Background slot
// ---------------------------------------------------------------------------

export const WithBackground: Story = {
  name: '背景插槽',
  parameters: {
    docs: {
      description: {
        story:
          '`background` 画在框内、文本域与工具栏**之下**，不占文档流、不改变输入框高度，也永不接收指针事件 —— 点水印会聚焦到下面的文本域。默认 `backgroundVisible="empty"`，一开始打字就淡出：水印压着用户正在写的句子是个可读性问题，不是品牌时刻。\n\n实现上唯一的坑是层叠：容器只有 `relative` 时 `z-index: auto` **不创建层叠上下文**，负 z-index 的背景层会逃到父级上下文、被容器自己的 `bg-cc-surface` 盖住而完全看不见；所以有 `background` 时容器要加 `isolate`。反过来，不用负 z-index 也不行 —— `absolute` + `z-index: auto` 的子节点在绘制顺序里排在普通流内容**之后**，会盖住文本域。',
      },
    },
  },
  render: (args) => {
    const Demo = () => (
      <div className="flex flex-col gap-6">
        <div>
          <Hint>
            角标水印。默认
            placement=&quot;top-right&quot;：空输入框里被占用的只有左上的占位文字和整条底部工具栏，右上是唯一没人认领的区域。放
            bottom-right 会正好压在发送按钮下面。
          </Hint>
          <PromptInput
            {...args}
            background={
              <PromptBackdrop>
                <span className="text-[2rem] font-semibold tracking-tight">Acme</span>
              </PromptBackdrop>
            }
          />
        </div>

        <div>
          <Hint>整块渐变，placement=&quot;fill&quot;：不做内边距，透明度交给内容自己控制。</Hint>
          <PromptInput
            {...args}
            background={
              <PromptBackdrop placement="fill">
                <div className="size-full bg-[linear-gradient(115deg,var(--color-cc-accent-subtle)_0%,transparent_55%)]" />
              </PromptBackdrop>
            }
          />
        </div>

        <div>
          <Hint>
            居中图标 + backgroundVisible=&quot;always&quot;：打字后也不淡出，用于确认淡出确实是那个
            prop 控制的。
          </Hint>
          <PromptInput
            {...args}
            defaultValue="这一条有内容，但水印仍然在。"
            backgroundVisible="always"
            background={
              <PromptBackdrop placement="center" opacity={0.05}>
                <AgentIcon size={72} />
              </PromptBackdrop>
            }
          />
        </div>

        <div>
          <Hint>
            对照组：同样的水印，默认
            backgroundVisible=&quot;empty&quot;，有内容所以已经淡出。清空文本框它会回来。
          </Hint>
          <PromptInput
            {...args}
            defaultValue="这一条有内容，水印已淡出。"
            background={
              <PromptBackdrop placement="center" opacity={0.05}>
                <AgentIcon size={72} />
              </PromptBackdrop>
            }
          />
        </div>
      </div>
    )
    return <Demo />
  },
}

// ---------------------------------------------------------------------------
// Prompt queue
// ---------------------------------------------------------------------------

export const WithQueue: Story = {
  name: '输入端队列',
  parameters: {
    docs: {
      description: {
        story:
          '生成中继续打字，按 Enter 或点发送就进队列而不是发出去；上一轮结束后按顺序自动发出下一条，一次只发一条。队列项点一下可以就地改写，hover 行尾的 × 移除。\n\n**发送和停止是两个动作，一个位置装不下。** 所以传了 `queue` 之后，发送按钮始终是发送/入队，停止移到输入框上方那条状态条上 —— 整条可点，而不是只让右边的小图标可点：生成中最常见的诉求就是叫停，把点击区做到最小是反的。不传 `queue` 时行为完全不变，仍然是发送按钮变停止按钮。',
      },
    },
  },
  render: (args) => {
    const Demo = () => {
      const [log, setLog] = useState<string[]>([])
      const [busy, setBusy] = useState(false)
      const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
      const settle = useRef<(() => void) | null>(null)

      /* Stands in for a turn: three seconds of "streaming" that `stop` can cut short. The
         promise is what `usePromptQueue` awaits before releasing the next item. */
      const run = (text: string) =>
        new Promise<void>((resolve) => {
          setBusy(true)
          setLog((list) => [...list, `▶ 开始：${text}`])
          settle.current = () => {
            timer.current = null
            settle.current = null
            setBusy(false)
            resolve()
          }
          timer.current = setTimeout(() => {
            setLog((list) => [...list, `✓ 完成：${text}`])
            settle.current?.()
          }, 3000)
        })

      const queue = usePromptQueue({
        busy,
        onSend: (item) => run(item.text),
      })

      const stop = () => {
        if (timer.current) clearTimeout(timer.current)
        setLog((list) => [...list, '■ 已停止'])
        settle.current?.()
      }

      useEffect(
        () => () => {
          if (timer.current) clearTimeout(timer.current)
        },
        [],
      )

      return (
        <div className="flex flex-col gap-3">
          <Hint>
            先发一条，趁着 3 秒的「生成中」再连打两条 ——
            它们会排在输入框上方。等第一轮结束，看它们按顺序、一次一条地自动发出。中途点状态条可以停止；停止只是叫停当前输出，队列里已经写好的话会保留。
          </Hint>
          <PromptInput
            {...args}
            queue={queue}
            streaming={busy}
            onStop={stop}
            onSubmit={(text) => void run(text)}
          />
          <div className="flex flex-col gap-0.5 rounded-cc-sm border border-cc-border bg-cc-surface/60 p-2.5 text-cc-xs">
            <span className="mb-1 text-cc-faint">时间线（队列长度 {queue.size}）</span>
            {log.length === 0 ? (
              <span className="text-cc-faint">还没有发过消息</span>
            ) : (
              log.map((entry, index) => (
                <span key={index} className="font-cc-mono text-cc-muted">
                  {entry}
                </span>
              ))
            )}
          </div>
        </div>
      )
    }
    return <Demo />
  },
}
