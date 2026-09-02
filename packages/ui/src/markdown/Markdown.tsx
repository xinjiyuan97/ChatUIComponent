'use client'

import {
  Children,
  createContext,
  isValidElement,
  memo,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '../lib/cn'
import { useChatTheme } from '../provider/ChatThemeProvider'
import { Blockquote } from './Blockquote'
import { Cited } from './Citation'
import { CodeBlock } from './CodeBlock'
import { completeMarkdown, splitMarkdownBlocks } from './complete-markdown'
import { Mermaid } from './Mermaid'

export type MarkdownProps = {
  children: string
  /**
   * Text is still arriving. Enables repair of half-written syntax so a code fence renders
   * as a code block from its first line rather than snapping into one at the end.
   */
  streaming?: boolean
  className?: string
}

/** Flattens a react-markdown child tree back to plain text, for code extraction. */
function toText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(toText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return toText(node.props.children)
  return ''
}

function languageOf(node: ReactNode): string | undefined {
  if (!isValidElement<{ className?: string }>(node)) return undefined
  const match = /language-([\w+#-]+)/.exec(node.props.className ?? '')
  return match?.[1]
}

/**
 * Whether the block currently being rendered is the one still receiving tokens.
 *
 * Context rather than a prop because `COMPONENTS` below has to stay a module-scope
 * constant — react-markdown treats it as render input, so rebuilding it per render would
 * defeat the per-block memoisation.
 */
const StreamingBlockContext = createContext(false)

/**
 * Fence renderer.
 *
 * A ```mermaid fence is a diagram; everything else is a code block. The split lives here
 * rather than inside `CodeBlock` so a host that turns diagrams off (`mermaid={false}` on
 * the provider) pays nothing for the renderer at all.
 */
function PreBlock({ children }: { children?: ReactNode }) {
  const { mermaid } = useChatTheme()
  const streaming = useContext(StreamingBlockContext)

  const child = Children.toArray(children)[0]
  const code = toText(child).replace(/\n$/, '')
  const language = languageOf(child)

  if (mermaid && language?.toLowerCase() === 'mermaid') {
    return <Mermaid code={code} streaming={streaming} />
  }
  return <CodeBlock code={code} language={language} />
}

/**
 * Element overrides.
 *
 * Defined once at module scope: react-markdown treats this object as part of its render
 * input, so rebuilding it per render would defeat the block memoisation below.
 *
 * Styling lives here rather than in a global stylesheet so the library needs no
 * typography plugin and consumers can override any single element by class.
 */
const COMPONENTS: Components = {
  // `Cited` is applied to the inline containers only. Not to `code`, where a `[1]` is an
  // array index; not to `a`, where the marker would be swallowed by the link.
  p: ({ children }) => (
    <p className="my-2.5 first:mt-0 last:mb-0">
      <Cited>{children}</Cited>
    </p>
  ),

  // Headings step down in weight rather than in size alone. In a chat column a large h1
  // shouts; the hierarchy has to work within a two-point size range.
  h1: ({ children }) => (
    <h1 className="mb-2 mt-5 text-[1.15em] font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-[1.08em] font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-4 text-[1em] font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-4 text-[1em] font-medium text-cc-muted first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1.5 mt-3 text-cc-sm font-semibold text-cc-muted first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mb-1.5 mt-3 text-cc-sm font-medium text-cc-muted first:mt-0">{children}</h6>
  ),

  ul: ({ children }) => (
    <ul className="my-2.5 ml-[1.15em] list-outside list-disc space-y-1 marker:text-cc-faint">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="my-2.5 ml-[1.35em] list-outside list-decimal space-y-1 marker:text-cc-faint marker:tabular-nums"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="[&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
      <Cited>{children}</Cited>
    </li>
  ),

  // Plain quote, or a `> [!WARNING]` callout — see `Blockquote`.
  blockquote: ({ children }) => <Blockquote>{children}</Blockquote>,

  hr: () => <hr className="my-5 border-0 border-t border-cc-border" />,

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      // `noreferrer` matters as much as `noopener`: chat content is model output and the
      // destination should not learn where the link was rendered.
      rel="noopener noreferrer"
      className={cn(
        'text-cc-accent underline decoration-cc-accent/30 underline-offset-2',
        'transition-colors duration-150 ease-cc hover:decoration-cc-accent',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45 rounded-cc-xs',
        // A bare URL used as its own link text has no break opportunity either.
        '[overflow-wrap:anywhere]',
      )}
    >
      {children}
    </a>
  ),

  strong: ({ children }) => <strong className="font-semibold text-cc-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-cc-muted line-through">{children}</del>,

  img: ({ src, alt }) => (
    <img
      src={typeof src === 'string' ? src : undefined}
      alt={alt ?? ''}
      loading="lazy"
      className="my-3 max-w-full rounded-cc-md border border-cc-border"
    />
  ),

  // A fenced block always arrives as <pre><code>. Intercepting at `pre` catches blocks
  // with and without an info string, which leaves `code` below handling only inline spans.
  pre: PreBlock,

  code: ({ children }) => (
    <code
      className={cn(
        'rounded-cc-xs bg-cc-subtle px-[0.35em] py-[0.15em] font-cc-mono text-[0.875em] text-cc-fg',
        // Inline code is routinely a path, an identifier or a URL with no break
        // opportunity in it, and one of those is enough to push the whole message column
        // wider than its container. `anywhere` rather than `break-word` because only
        // `anywhere` also shrinks the min-content width, which is what decides whether a
        // long token folds or widens a table cell or flex child.
        '[overflow-wrap:anywhere]',
        // Without this the background and radius are painted once across the whole
        // fragmented box, so a wrapped span loses its left padding and corners on the
        // second line and reads as a rendering fault.
        '[box-decoration-break:clone] [-webkit-box-decoration-break:clone]',
      )}
    >
      {children}
    </code>
  ),

  // Tables scroll inside their own container rather than widening the message column.
  table: ({ children }) => (
    <div className="my-3 w-full overflow-x-auto rounded-cc-md border border-cc-border">
      <table className="w-full border-collapse text-cc-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-cc-subtle/60">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-cc-border last:border-0">{children}</tr>,
  th: ({ children, style }) => (
    <th style={style} className="px-3 py-2 text-left font-medium text-cc-muted">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top">
      <Cited>{children}</Cited>
    </td>
  ),
}

const PLUGINS = [remarkGfm]

const MarkdownBlock = memo(function MarkdownBlock({
  source,
  streaming,
}: {
  source: string
  streaming: boolean
}) {
  return (
    <StreamingBlockContext.Provider value={streaming}>
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {source}
      </ReactMarkdown>
    </StreamingBlockContext.Provider>
  )
})

/**
 * Markdown renderer tuned for streaming.
 *
 * The document is split into top-level blocks and each is memoised on its own text. Only
 * the final block changes while tokens arrive, so a 3000-word reply with ten code blocks
 * re-parses one paragraph per frame instead of the whole document — the difference between
 * a smooth reveal and a visibly stuttering one.
 */
function MarkdownImpl({ children, streaming = false, className }: MarkdownProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(children), [children])

  return (
    /* `break-words` as the floor for prose. Deliberately not `anywhere` here: in running
       text `anywhere` lets the browser break a word even when a better opportunity exists
       later on the line, which shreds the right margin. `code` and `a` above opt into the
       stronger rule because they are the elements that actually overflow. */
    <div
      className={cn('cc-markdown break-words text-cc-body leading-[1.65] text-cc-fg', className)}
    >
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1
        // Only the trailing block can be unterminated, and repairing it is only safe while
        // more text is coming — see `completeMarkdown`'s `inline` option.
        const source = isLast ? completeMarkdown(block, { inline: streaming }) : block
        return <MarkdownBlock key={index} source={source} streaming={isLast && streaming} />
      })}
    </div>
  )
}

export const Markdown = memo(MarkdownImpl)
