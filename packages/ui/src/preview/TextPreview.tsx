'use client'

import { fileExtension, useCopyToClipboard, type PreviewFile } from '@xinjiyuan97/chat-core'
import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { CheckIcon, CopyIcon, DownloadIcon, WrapIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { canHighlight, highlight, resolveLanguage } from '../markdown/highlighter'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { PreviewFrame, PreviewToolbarLabel, PreviewToolbarSpacer } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'

export type TextPreviewProps = {
  text: string
  /** Fence info string or extension. Decides the grammar; unknown ones render plain. */
  language?: string
  /** Extra toolbar controls, prepended before the shared ones. */
  toolbar?: ReactNode
  onDownload?: () => void
  className?: string
}

/**
 * A whole file as text, syntax-highlighted where we have the grammar.
 *
 * This covers txt and every code format at once, because `highlighter.ts` already owns the
 * language list for code fences in messages — the preview inherits all thirty of them and
 * whatever is added later, with nothing to keep in sync.
 *
 * It highlights in a plain effect rather than reusing `CodeBlock`'s queueing version: that
 * machinery exists because a fence grows token by token during streaming, and a file on
 * disk does not. Plain text still renders on the first frame, so a large file is readable
 * before Shiki finishes.
 */
export function TextPreview({ text, language, toolbar, onDownload, className }: TextPreviewProps) {
  const locale = useLocale()
  const { copied, copy } = useCopyToClipboard()
  const [wrap, setWrap] = useState(false)
  const html = useHighlighted(text, language)
  const label = resolveLanguage(language) ?? language ?? ''

  return (
    <PreviewFrame
      className={className}
      toolbar={
        <>
          {toolbar}
          {label && <PreviewToolbarLabel>{label}</PreviewToolbarLabel>}
          <PreviewToolbarSpacer />
          <IconButton
            size="sm"
            label={locale.wrapLines}
            active={wrap}
            icon={<WrapIcon size={14} />}
            onClick={() => setWrap((value) => !value)}
          />
          <IconButton
            size="sm"
            label={copied ? locale.previewCopied : locale.previewCopy}
            icon={
              copied ? <CheckIcon size={14} className="text-cc-success" /> : <CopyIcon size={14} />
            }
            onClick={() => void copy(text)}
          />
          {onDownload && (
            <IconButton
              size="sm"
              label={locale.previewDownload}
              icon={<DownloadIcon size={14} />}
              onClick={onDownload}
            />
          )}
        </>
      }
    >
      {/* `cc-code` is what `tokens.css` hangs the Shiki theme, wrapping and line-number
          rules on, so the preview and a fenced block in a reply look identical. */}
      <div className="cc-code h-full" data-cc-wrap={wrap} data-cc-numbers="true">
        {html ? (
          // Shiki escapes every token itself; this is machine-generated markup, not the
          // file's bytes passed through.
          <div
            className="p-3 text-cc-code font-cc-mono"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="p-3 text-cc-code font-cc-mono text-cc-fg">
            <code className={cn(wrap && 'whitespace-pre-wrap [overflow-wrap:anywhere]')}>
              {text}
            </code>
          </pre>
        )}
      </div>
    </PreviewFrame>
  )
}

function useHighlighted(text: string, language: string | undefined): string | null {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!canHighlight(language)) {
      setHtml(null)
      return
    }
    let cancelled = false
    void highlight(text, language).then(
      (result) => {
        if (!cancelled) setHtml(result?.html ?? null)
      },
      () => {
        // A grammar that fails to load leaves the plain-text rendering in place, which is
        // the whole file, just uncoloured.
        if (!cancelled) setHtml(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [text, language])

  return html
}

/**
 * `TextPreview` for a `PreviewFile`.
 *
 * The extension is passed straight through as the language: `resolveLanguage` already
 * understands `ts`, `py`, `rs` and the rest, and anything it does not know renders as plain
 * text — which is the correct outcome for a `.log` or a `.env`.
 */
export function TextFilePreview({ file, className }: { file: PreviewFile; className?: string }) {
  return (
    <PreviewLoader file={file} as="text">
      {(text) => (
        <TextPreview
          text={text}
          language={fileExtension(file.name)}
          onDownload={canDownload(file) ? () => downloadFile(file) : undefined}
          className={className}
        />
      )}
    </PreviewLoader>
  )
}
