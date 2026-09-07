import { useMemo, useState, type ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react'

import type { FileNode, PreviewFailure, PreviewFile } from '@xinjiyuan97/chat-core'
import { useSidePanel } from '@xinjiyuan97/chat-core'
import {
  Button,
  ChatThemeProvider,
  FilePreview,
  FileTree,
  FolderPreview,
  Markdown,
  SidePanel,
  TableIcon,
  UnsupportedPreview,
  definePreview,
  filePreviewPanel,
  folderPanel,
  type PreviewRegistry,
} from '@xinjiyuan97/chat-ui'

/* The files live next door because the end-to-end workspace story shows the same repo. */
import { FILES, SLIDES, TREE, lazyExpand } from '../preview-fixtures'
/* Vite hands back a URL for the worker file, which is exactly what `pdfWorkerSrc` wants.
 * The same one line works in any app: no CDN, no version skew, no network at runtime. */
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const meta = {
  title: 'Chat/Preview',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "右侧面板里的**文件预览**。\n\n注册表是**两层**的，这是整块设计的核心：`SidePanel` 那层只认不透明的 `kind`（`diff`、`log`、`settings`…），完全不知道「文件」是什么；其中一个 kind 交给 `filePreviewPanel`，才轮到第二层按**文件类型**去挑渲染器。两层各自可扩展 —— 宿主既可以加一个全新的 kind，也可以只往 `previews` 里塞一种格式。\n\n```\nSidePanel(kind) → filePreviewPanel → previews(文件类型) → 渲染器\n                                                     ↘ 没匹配上 → UnsupportedPreview\n```\n\n匹配顺序是：宿主的精确 mediaType → 宿主的后缀 → 宿主的 mediaType 通配 → 内置的同样三轮。**宿主永远赢内置**，所以覆盖我们的 markdown 渲染器只需要注册一条 `extensions: ['md']`，不用先反注册什么东西。\n\n三个重依赖（`pdfjs-dist` / `docx-preview` / `exceljs`）是 optional peer：没装不是错误，是兜底页的一个分支。",
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/** A panel-sized box, since every viewer is written to fill the height it is given. */
function Stage({ children, height = 620 }: { children: ReactNode; height?: number }) {
  return (
    <div
      className="overflow-hidden rounded-cc-lg border border-cc-border bg-cc-surface"
      style={{ height }}
    >
      {children}
    </div>
  )
}

function Preview({ file, height }: { file: PreviewFile; height?: number }) {
  return (
    <ChatThemeProvider pdfWorkerSrc={pdfWorkerSrc}>
      <Stage height={height}>
        <FilePreview file={file} />
      </Stage>
    </ChatThemeProvider>
  )
}

// ---------------------------------------------------------------------------
// One story per renderer
// ---------------------------------------------------------------------------

export const Pdf: Story = {
  name: 'PDF',
  render: () => <Preview file={FILES.pdf} height={700} />,
  parameters: {
    docs: {
      description: {
        story:
          "四页 PDF。工具栏是翻页、跳页输入框、缩放、适应宽度、下载、新窗口打开。\n\n只渲染视口附近的页 —— 滚到第 20 页时前面的 canvas 已经被回收（`canvas.width = 0`），否则一个几百页的文档会把显存吃光。canvas 的实际像素尺寸乘了 `devicePixelRatio`，不然 retina 屏上文字发糊。\n\n**worker 必须由宿主给**：这个 story 用的是 `import src from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`。不传就是下面 `Fallback / needs-config` 那一页 —— 我们不偷偷打 CDN，内网部署会静默失败，版本不一致时 pdf.js 报的错也基本没法自查。",
      },
    },
  },
}

export const Image: Story = {
  name: '图片',
  render: () => <Preview file={FILES.image} />,
  parameters: {
    docs: {
      description: {
        story:
          '缩放锚在**指针位置**而不是图片中心：放大是为了看清鼠标底下那块东西，锚在中心的话它会滑出屏幕。滚轮缩放、拖拽平移、双击在「适应窗口」与 1:1 之间切换，状态机在 core 的 `useImageZoom` 里。',
      },
    },
  },
}

export const Text: Story = {
  name: '文本与代码',
  render: () => <Preview file={FILES.code} />,
  parameters: {
    docs: {
      description: {
        story:
          'txt 和所有代码类走同一个渲染器。高亮直接用消息里代码块那套 `highlighter.ts`，三十种语言懒加载 —— 预览白拿，且以后加语言两边同时生效。没有对应语法的文件渲染成纯文本，而不是掉到兜底页。',
      },
    },
  },
}

export const MarkdownFile: Story = {
  name: 'Markdown（预览 / 原文）',
  render: () => <Preview file={FILES.markdown} />,
  parameters: {
    docs: {
      description: {
        story: '左上角的分段控件切换渲染结果与原文，原文那一侧走的就是上面的文本渲染器。',
      },
    },
  },
}

export const Html: Story = {
  name: 'HTML（沙箱）',
  render: () => <Preview file={FILES.html} />,
  parameters: {
    docs: {
      description: {
        story:
          "**这个 fixture 里塞了 `<script>alert(1)</script>` 和 `<img onerror=alert(1)>`，两个都不会执行。**\n\n渲染用的是 `<iframe srcdoc sandbox=\"\">` —— 空 sandbox，`allow-scripts` 是刻意不给的。脚本不跑、`javascript:` 不解析、表单不提交、frame 不能导航顶层窗口，而且拿到的是不透明源，碰不到宿主的 storage 和 DOM。这些都是浏览器强制的，不是我们用正则删出来的。\n\n所以这里没有 DOMPurify：sanitizer 是一份要追着新绕过手法跑的黑名单，sandbox 是引擎级的能力开关。代价是带脚本的文档（图表、交互报表）会渲染成静态版本，对预览面板来说这个取舍是对的。\n\n开着 devtools 看这条 story，控制台会有一句 `Failed to execute 'postMessage' … does not match the recipient window's origin ('null')`。那是 Storybook 的 a11y 插件（axe-core）想往每个 iframe 里注入检查脚本，被不透明源挡了回去 —— 恰好是这个沙箱该有的表现，不是组件的报错。",
      },
    },
  },
}

export const Word: Story = {
  name: 'Word',
  render: () => <Preview file={FILES.docx} />,
  parameters: {
    docs: {
      description: {
        story:
          '`docx-preview` 解析，渲染进我们自己的容器并带 `cc-docx` 前缀做样式隔离 —— 它会往 DOM 里注入自己的 `<style>`，不隔离就漏到宿主页面上了。没装这个包就是兜底页的 `renderer-missing`。',
      },
    },
  },
}

export const Excel: Story = {
  name: 'Excel',
  render: () => <Preview file={FILES.xlsx} />,
  parameters: {
    docs: {
      description: {
        story:
          '`exceljs` 只负责解析，**表格是我们自己用 token 画的**，不引第二个渲染依赖。首行与行号列冻结，数字右对齐并用等宽数位，`numFmt` 里的百分比、千分位、日期序列号做了粗略还原（完整的 ECMA-376 格式不在范围内，宁可显示得朴素也不显示错）。超大表按行截断，底部说明只显示了前 N 行。\n\nsheet 标签放在**工具栏里**而不是像 Excel 那样放底部：面板宽度有限，底部再占一条会把本来就不多的表格高度又切掉一块。',
      },
    },
  },
}

export const Slides: Story = {
  name: 'PPT（宿主转换产物）',
  render: () => <Preview file={SLIDES} height={700} />,
  parameters: {
    docs: {
      description: {
        story:
          '**我们不解析 .pptx。** 一份 deck 是绝对定位的形状、主题继承、内嵌字体、SmartArt 和动画，目前没有保真度可接受的纯前端渲染器 —— 文字会跑到它本来所属的形状之外，而读者没有任何办法判断自己看到的是哪一种。安静地错比不显示更糟。\n\n所以约定是明确的：宿主给 `file.converted`（服务端 LibreOffice 转出来的 PDF，或者逐页图片），就渲染；不给就是兜底页里那句「需要先在服务端转换」。这个 story 给的是 PDF 形态。',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Fallbacks
// ---------------------------------------------------------------------------

const FALLBACKS: {
  reason: PreviewFailure
  file: PreviewFile
  packageName?: string
  maxBytes?: number
  detail?: string
}[] = [
  { reason: 'unsupported-type', file: { name: '设计稿.psd', size: 18_400_000, url: '#' } },
  {
    reason: 'renderer-missing',
    file: { name: '工程周报.docx', size: 24_100 },
    packageName: 'docx-preview',
  },
  { reason: 'needs-config', file: { name: '季度报告.pdf', size: 1_280_000 } },
  {
    reason: 'too-large',
    file: { name: '全量日志.txt', size: 48 * 1024 * 1024, url: '#' },
    maxBytes: 2 * 1024 * 1024,
  },
  {
    reason: 'fetch-failed',
    file: { name: '附件.zip', url: '#' },
    detail: 'HTTP 502 Bad Gateway',
  },
  {
    reason: 'render-failed',
    file: { name: '销售明细.xlsx', size: 91_000 },
    detail: "Invalid zip: can't find end of central directory",
  },
  {
    reason: 'converted-artifact-missing',
    file: { name: '发布评审.pptx', size: 3_400_000, url: '#' },
  },
]

export const Fallbacks: Story = {
  name: '兜底页',
  render: () => (
    <ChatThemeProvider>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {FALLBACKS.map((entry) => (
          <div key={entry.reason}>
            <p className="mb-1.5 font-mono text-cc-xs text-cc-faint">{entry.reason}</p>
            <Stage height={280}>
              <UnsupportedPreview
                file={entry.file}
                reason={entry.reason}
                packageName={entry.packageName}
                detail={entry.detail}
                maxBytes={entry.maxBytes}
                onRetry={
                  entry.reason === 'fetch-failed' || entry.reason === 'render-failed'
                    ? () => {}
                    : undefined
                }
              />
            </Stage>
          </div>
        ))}
      </div>
    </ChatThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '七种原因，七句不同的话。「无法预览」等于什么都没说 —— 少一个可选依赖是一条 `pnpm add` 能解决的，缺 worker 是一个 prop，文件太大是改成下载，这三件事塞进同一句话就把唯一有用的部分丢掉了。\n\n**一处危险红都没有。** 红色留给 agent 真的失败了的时候。渲染不了 `.psd` 不是失败，那是一个不渲染 Photoshop 文件的库的正常状态，把它画成红的只会教用户不信任这个颜色。',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Host extension — the living documentation for requirement 1
// ---------------------------------------------------------------------------

/** A format this library has never heard of, plus a replacement for a built-in. */
const HOST_PREVIEWS: PreviewRegistry = {
  /* New type. `.ndjson` matches nothing built-in, so without this entry it lands on the
   * fallback page. */
  ndjson: definePreview({
    extensions: ['ndjson', 'jsonl'],
    mediaTypes: ['application/x-ndjson'],
    icon: TableIcon,
    render: ({ file }) => {
      const lines = String(file.content ?? '')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
      const columns = [...new Set(lines.flatMap((row) => Object.keys(row)))]
      return (
        <div className="h-full overflow-auto p-3">
          <table className="w-full text-cc-sm">
            <thead>
              <tr className="border-b border-cc-border text-left text-cc-xs text-cc-faint">
                {columns.map((column) => (
                  <th key={column} className="py-1 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={index} className="border-b border-cc-border/60">
                  {columns.map((column) => (
                    <td key={column} className="py-1 pr-4 tabular-nums">
                      {String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
  }),

  /* Overrides the built-in markdown viewer. Nothing had to be unregistered first: a host
   * entry wins the resolve, whatever the built-ins claim. */
  markdown: definePreview({
    extensions: ['md', 'markdown'],
    mediaTypes: ['text/markdown'],
    render: ({ file }) => (
      <div className="h-full overflow-auto bg-cc-subtle p-6">
        <div className="mx-auto max-w-2xl rounded-cc-lg border border-cc-accent/40 bg-cc-surface p-5 shadow-cc-card">
          <p className="mb-3 text-cc-xs font-medium text-cc-accent">宿主自己的 Markdown 渲染器</p>
          <Markdown>{String(file.content ?? '')}</Markdown>
        </div>
      </div>
    ),
  }),
}

const NDJSON: PreviewFile = {
  name: 'events.ndjson',
  content: [
    '{"ts":"10:30:02","level":"info","event":"run.start","tokens":0}',
    '{"ts":"10:30:04","level":"info","event":"tool.read","tokens":1284}',
    '{"ts":"10:30:09","level":"warn","event":"tool.retry","tokens":1284}',
    '{"ts":"10:30:11","level":"info","event":"run.finish","tokens":4102}',
  ].join('\n'),
}

export const HostRegistration: Story = {
  name: '宿主注册自己的类型',
  render: () => (
    <ChatThemeProvider previews={HOST_PREVIEWS}>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-cc-xs text-cc-faint">新增一种格式：.ndjson</p>
          <Stage height={300}>
            <FilePreview file={NDJSON} />
          </Stage>
        </div>
        <div>
          <p className="mb-1.5 text-cc-xs text-cc-faint">覆盖内置的 markdown 渲染器</p>
          <Stage height={300}>
            <FilePreview file={FILES.markdown} />
          </Stage>
        </div>
      </div>
    </ChatThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "要求「宿主能二次开发自己的预览类型」在这里就是一个 `previews` prop：\n\n```tsx\nconst previews = {\n  ndjson: definePreview({\n    extensions: ['ndjson', 'jsonl'],\n    icon: TableIcon,\n    render: ({ file }) => <YourTable text={String(file.content)} />,\n  }),\n  markdown: definePreview({ extensions: ['md'], render: YourMarkdown }),\n}\n\n<ChatThemeProvider previews={previews}>\n```\n\n左边那条注册了一种内置完全不认识的格式；右边那条**覆盖**了内置的 markdown 渲染器 —— 没有反注册这一步，宿主的条目在 `resolvePreview` 里天然排在内置前面。文件树的图标也跟着走注册表，所以新格式在树里自动就是它自己的图标，没有第二份列表要维护。\n\n匹配是声明式的 `extensions` / `mediaTypes`，不是 `match(file) => boolean`：一个不透明的谓词无法排序、无法解释「凭什么是它接管了」，也没法变成 README 里那张支持格式表。",
      },
    },
  },
}

// ---------------------------------------------------------------------------
// File tree
// ---------------------------------------------------------------------------

export const Tree: Story = {
  name: '文件树',
  render: () => (
    <ChatThemeProvider pdfWorkerSrc={pdfWorkerSrc}>
      <Stage height={620}>
        <FolderPreview
          nodes={TREE}
          defaultExpanded={['src', 'docs']}
          onExpand={lazyExpand}
          storageKey="story:folder"
        />
      </Stage>
    </ChatThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '左树右预览，中间那条能拖。`src/generated` 是懒加载的 —— 展开时才去取，取的过程中行上有 spinner，失败会回退成折叠态（留着展开只会显示一个空目录，读起来像「这个文件夹里什么都没有」）。\n\n**整棵树只有一个 tab 停靠点。** 四百个文件挨个 tab 过去不叫导航，所以用 roving tabindex：进树以后 ↑↓ 移动、→ 展开或进入第一个子节点、← 折叠或回到父节点、Home/End 跳两端、Enter 打开。键盘导航只走**已渲染的行**，光标不会走进折叠起来的子树里。\n\n缩进用行的 `padding-inline-start`，不是嵌套 `<ul>` 的 margin：深路径的长文件名仍然拿得到整行宽度、在右边截断，而不是被挤成一列。文件图标取自预览注册表。\n\n面板窄于 480px 时自动变成「树 → 点开进详情 → 返回」的两级：380px 宽再左右分栏，两边都窄到没法看。',
      },
    },
  },
}

function TreeOnlyDemo() {
  const [selected, setSelected] = useState<FileNode | null>(null)
  return (
    <ChatThemeProvider>
      <div className="flex gap-4 p-4">
        <Stage height={420}>
          <div className="w-64">
            <FileTree
              nodes={TREE}
              defaultExpanded={['docs']}
              onExpand={lazyExpand}
              onSelect={setSelected}
            />
          </div>
        </Stage>
        <p className="self-center text-cc-sm text-cc-muted">
          选中：<code className="font-mono">{selected?.id ?? '—'}</code>
        </p>
      </div>
    </ChatThemeProvider>
  )
}

export const TreeOnly: Story = {
  name: '文件树（单独用）',
  render: () => <TreeOnlyDemo />,
  parameters: {
    docs: {
      description: {
        story:
          '`FileTree` 本身不依赖预览，`onSelect` 就是普通回调 —— 拿去做文件选择器、diff 的左栏、任何需要一棵树的地方都行。',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Wired into the actual panel
// ---------------------------------------------------------------------------

function PanelDemo() {
  const panel = useSidePanel()

  const openers = useMemo(
    () => [
      { label: 'PDF', file: FILES.pdf },
      { label: 'Word', file: FILES.docx },
      { label: 'Excel', file: FILES.xlsx },
      { label: '代码', file: FILES.code },
      { label: '图片', file: FILES.image },
      { label: '不支持的类型', file: { name: '设计稿.psd', size: 18_400_000 } as PreviewFile },
    ],
    [],
  )

  return (
    <div className="flex h-[680px]">
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6">
        <p className="text-cc-sm text-cc-muted">
          面板里开的每一项都只是{' '}
          <code className="font-mono">{"{ kind: 'file', data: { file } }"}</code>
          —— 右栏认的是 kind，文件类型是下一层的事。
        </p>
        <div className="flex flex-wrap gap-2">
          {openers.map((entry) => (
            <Button
              key={entry.label}
              size="sm"
              variant="outline"
              onClick={() =>
                panel.open({
                  id: entry.file.name,
                  kind: 'file',
                  title: entry.file.name,
                  data: { file: entry.file },
                })
              }
            >
              {entry.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              panel.open({
                id: 'workspace',
                kind: 'folder',
                title: '工作区',
                data: { nodes: TREE, onExpand: lazyExpand },
              })
            }
          >
            文件夹
          </Button>
        </div>
      </div>
      <SidePanel panel={panel} storageKey="story:preview-panel" />
    </div>
  )
}

export const InPanel: Story = {
  name: '接进右侧面板',
  render: () => (
    <ChatThemeProvider
      pdfWorkerSrc={pdfWorkerSrc}
      panels={{ file: filePreviewPanel, folder: folderPanel }}
    >
      <PanelDemo />
    </ChatThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "两层注册表接起来一共两行：\n\n```tsx\n<ChatThemeProvider panels={{ file: filePreviewPanel, folder: folderPanel }}>\npanel.open({ id: path, kind: 'file', title: name, data: { file } })\n```\n\n`filePreviewPanel` 是个现成的 `PanelDefinition`，它做的唯一一件事就是把 `data.file` 交给第二层。`SidePanel` 依旧只认 `kind`，多种文件格式对它来说是同一个 kind，所以右栏以后放 diff、运行日志、设置面板，代码一行都不用动。",
      },
    },
  },
}
