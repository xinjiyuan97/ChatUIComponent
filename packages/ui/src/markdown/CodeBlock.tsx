'use client'

import { useCopyToClipboard } from '@agent-chat/core'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '../lib/cn'
import { formatDuration } from '../lib/format'
import { CheckIcon, CloseIcon, CopyIcon, PlayIcon, SpinnerIcon, WrapIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useChatTheme, useLocale } from '../provider/ChatThemeProvider'
import { canHighlight, highlight, resolveLanguage } from './highlighter'

/** What a run produced. `output` is rendered as plain text — never as markup. */
export type CodeRunResult = {
  status: 'ok' | 'error'
  /** stdout, a stack trace, a formatted return value. Empty is fine. */
  output?: string
  /** Wall-clock time, shown next to the result header when present. */
  durationMs?: number
}

/**
 * Host-supplied executor for a code block.
 *
 * The library never runs anything itself — not `eval`, not a Worker, not a fetch. Code in
 * a chat transcript is model output, and the decision about where it may run (a sandboxed
 * iframe, a backend container, nowhere at all) belongs to the application. Returning
 * `void` is allowed for handlers that surface their own UI elsewhere.
 */
export type CodeRunner = (
  code: string,
  language: string | undefined,
) => Promise<CodeRunResult | void> | CodeRunResult | void

export type CodeBlockProps = {
  code: string
  /** Raw fence info string, e.g. `ts` or `bash`. */
  language?: string
  /** Shown in place of the language label. */
  filename?: string
  showLineNumbers?: boolean
  defaultWrap?: boolean
  /**
   * Adds a run button. Falls back to `onRunCode` on the theme provider, which is how
   * blocks inside a Markdown reply get one.
   */
  onRun?: CodeRunner
  /** Forces the run button off (or on) regardless of whether a runner is available. */
  runnable?: boolean
  /** Controlled result; omit and the block keeps whatever the last run returned. */
  result?: CodeRunResult | null
  /** Controlled busy flag, for hosts that drive execution from their own state. */
  running?: boolean
  className?: string
}

/**
 * Highlighted code with copy, wrap and an optional run button.
 *
 * Plain text renders on the first frame and the highlighted markup replaces it when the
 * grammar has loaded. Rendering nothing until Shiki is ready would collapse the block's
 * height and shove the rest of the reply around a beat later, which during streaming
 * happens once per code block.
 */
function CodeBlockImpl({
  code,
  language,
  filename,
  showLineNumbers = false,
  defaultWrap = false,
  onRun,
  runnable,
  result: controlledResult,
  running: controlledRunning,
  className,
}: CodeBlockProps) {
  const locale = useLocale()
  const { onRunCode } = useChatTheme()
  const { copied, copy } = useCopyToClipboard()
  const [wrap, setWrap] = useState(defaultWrap)
  const html = useHighlightedHtml(code, language)

  const runner = onRun ?? onRunCode
  const showRun = runnable ?? Boolean(runner)

  const [ownResult, setOwnResult] = useState<CodeRunResult | null>(null)
  const [ownRunning, setOwnRunning] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const result = controlledResult !== undefined ? controlledResult : ownResult
  const isRunning = controlledRunning ?? ownRunning

  const run = useCallback(async () => {
    if (!runner || isRunning) return
    setOwnRunning(true)
    /* The previous output is cleared before the new run rather than after it: leaving a
     * stale result under a spinner reads as "this is the answer", which it is not. */
    setOwnResult(null)
    try {
      const next = await runner(code, language)
      if (alive.current && next) setOwnResult(next)
    } catch (error) {
      // A handler that throws is a failed run, not a broken component.
      if (alive.current) {
        setOwnResult({
          status: 'error',
          output: error instanceof Error ? (error.stack ?? error.message) : String(error),
        })
      }
    } finally {
      if (alive.current) setOwnRunning(false)
    }
  }, [code, isRunning, language, runner])

  const label = filename ?? resolveLanguage(language) ?? language?.trim() ?? ''

  return (
    <div
      className={cn(
        'cc-code group/code relative my-3 overflow-hidden rounded-cc-md border border-cc-border',
        'bg-cc-surface',
        className,
      )}
      data-cc-wrap={wrap}
      data-cc-numbers={showLineNumbers}
    >
      <div
        className={cn(
          'flex h-8 items-center justify-between gap-2 border-b border-cc-border',
          'bg-cc-subtle/60 pl-3 pr-1.5',
        )}
      >
        <span className="truncate font-cc-mono text-cc-xs text-cc-muted">{label}</span>

        <div className="flex shrink-0 items-center gap-1">
          {/* Run stays visible. Copy and wrap are conveniences you go looking for; a run
              button nobody can see is a feature that does not exist. */}
          {showRun && (
            <RunButton
              running={isRunning}
              disabled={!runner}
              label={isRunning ? locale.running : locale.run}
              onClick={() => void run()}
            />
          )}

          {/* Secondary controls stay out of the way until the block is hovered, but
              keyboard focus reveals them too — otherwise they are unreachable by Tab. */}
          <div
            className={cn(
              'flex items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-cc',
              'group-hover/code:opacity-100 group-focus-within/code:opacity-100',
            )}
          >
            <IconButton
              size="sm"
              label={locale.wrapLines}
              active={wrap}
              icon={<WrapIcon size={14} />}
              onClick={() => setWrap((value) => !value)}
            />
            <IconButton
              size="sm"
              label={copied ? locale.copied : locale.copy}
              icon={
                copied ? (
                  <CheckIcon size={14} className="text-cc-success" />
                ) : (
                  <CopyIcon size={14} />
                )
              }
              onClick={() => void copy(code)}
            />
          </div>
        </div>
      </div>

      {html ? (
        // Shiki escapes every token itself; the string is machine-generated markup, never
        // the model's text passed through.
        <div
          className="overflow-x-auto p-3 text-cc-code font-cc-mono"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 text-cc-code font-cc-mono text-cc-fg">
          <code className={cn(wrap && 'whitespace-pre-wrap [overflow-wrap:anywhere]')}>{code}</code>
        </pre>
      )}

      {result && (
        <CodeRunOutput
          result={result}
          /* Only offer to clear what this block owns. Under a controlled `result` the
             host holds the state and a dismiss button here would lie. */
          onClear={controlledResult === undefined ? () => setOwnResult(null) : undefined}
        />
      )}
    </div>
  )
}

function RunButton({
  running,
  disabled,
  label,
  onClick,
}: {
  running: boolean
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || running}
      aria-label={label}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-cc-sm px-1.5 text-cc-xs font-medium',
        'text-cc-muted transition-colors duration-150 ease-cc',
        'hover:bg-cc-subtle hover:text-cc-fg',
        'disabled:pointer-events-none disabled:opacity-50',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
      )}
    >
      {running ? <SpinnerIcon size={12} /> : <PlayIcon size={10} />}
      {label}
    </button>
  )
}

/**
 * The result panel.
 *
 * Attached to the bottom of the same bordered box rather than floating below it: the
 * output only means anything next to the code that produced it, and a detached card
 * would compete with the message's own parts for the reader's attention.
 */
function CodeRunOutput({ result, onClear }: { result: CodeRunResult; onClear?: () => void }) {
  const locale = useLocale()
  const failed = result.status === 'error'
  const duration = formatDuration(result.durationMs)

  return (
    <div className="border-t border-cc-border" data-cc-run-status={result.status}>
      <div
        className={cn(
          'flex h-7 items-center justify-between gap-2 pl-3 pr-1.5',
          failed ? 'bg-cc-danger-subtle/50' : 'bg-cc-subtle/40',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-cc-xs">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-cc-full',
              failed ? 'bg-cc-danger' : 'bg-cc-success',
            )}
          />
          <span className={cn('truncate font-medium', failed ? 'text-cc-danger' : 'text-cc-muted')}>
            {failed ? locale.runFailed : locale.runOutput}
          </span>
          {duration && <span className="shrink-0 text-cc-faint tabular-nums">{duration}</span>}
        </span>

        {onClear && (
          <IconButton
            size="sm"
            label={locale.clearOutput}
            icon={<CloseIcon size={11} />}
            onClick={onClear}
          />
        )}
      </div>

      {result.output && (
        <pre
          /* Errors read as body text, not as more code — the stack trace is the message. */
          className={cn(
            'max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-cc-mono text-cc-code',
            '[overflow-wrap:anywhere]',
            failed ? 'text-cc-danger' : 'text-cc-fg',
          )}
        >
          {result.output}
        </pre>
      )}
    </div>
  )
}

/** One highlight: the code, and the grammar it is to be tokenised with. */
type HighlightRequest = { source: string; language: string | undefined }

function differs(a: HighlightRequest, b: HighlightRequest): boolean {
  return a.source !== b.source || a.language !== b.language
}

/**
 * Keeps at most one highlight in flight and always settles on the newest code.
 *
 * During streaming this hook is called on every delta. Firing a highlight per delta would
 * queue dozens of runs whose results are stale before they resolve; instead a run in
 * progress records the latest code and re-runs once, so the cost tracks the highlighter's
 * own speed rather than the token rate.
 */
function useHighlightedHtml(code: string, language: string | undefined): string | null {
  const [html, setHtml] = useState<string | null>(null)
  const running = useRef(false)
  const queued = useRef<HighlightRequest | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!canHighlight(language)) {
      setHtml(null)
      return
    }

    /* No effect-scoped `cancelled` flag: the queue is filled by the *next* effect run while
     * the drain lives in the closure that cleanup would have cancelled, so checking one
     * here would strand the final delta on the plain-text fallback. Staleness is handled at
     * the `setHtml` calls instead. */
    const request: HighlightRequest = { source: code, language }

    if (running.current) {
      queued.current = request
      return
    }

    // Whether a *different* request is already waiting, in which case publishing this
    // result would only flash an out-of-date block for a frame.
    const superseded = (req: HighlightRequest) =>
      queued.current !== null && differs(queued.current, req)

    const run = async (req: HighlightRequest) => {
      running.current = true
      try {
        const result = await highlight(req.source, req.language)
        if (alive.current && !superseded(req)) setHtml(result?.html ?? null)
      } catch {
        // Highlighting is an enhancement; the plain-text fallback is already correct.
        if (alive.current && !superseded(req)) setHtml(null)
      } finally {
        running.current = false
      }

      const next = queued.current
      queued.current = null
      if (next && alive.current && differs(next, req)) await run(next)
    }

    void run(request)
  }, [code, language])

  return html
}

/**
 * Memoised on content: a streaming reply re-renders its whole Markdown tree on every
 * delta, and finished code blocks above the cursor must not re-highlight.
 */
export const CodeBlock = memo(CodeBlockImpl)
