'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import { useState } from 'react'

import { CodeIcon, DownloadIcon, EyeIcon } from '../icons'
import { Markdown } from '../markdown/Markdown'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { PreviewFrame, PreviewToggle, PreviewToolbarSpacer } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { TextPreview } from './TextPreview'

export type MarkdownPreviewProps = {
  text: string
  onDownload?: () => void
  className?: string
}

type Mode = 'rendered' | 'source'

/**
 * Markdown, rendered or as written.
 *
 * The rendered side is the same `<Markdown>` a reply uses, so a document produced by the
 * agent looks in the panel exactly as it did in the thread — one renderer, one set of
 * plugins, one place to fix a rendering bug.
 *
 * The source side is `TextPreview`, which means it arrives with highlighting, wrapping and
 * copy already working. Both are worth having: the rendered view is what the document says,
 * the source view is what the agent actually wrote, and when a table comes out wrong those
 * are different questions.
 */
export function MarkdownPreview({ text, onDownload, className }: MarkdownPreviewProps) {
  const locale = useLocale()
  const [mode, setMode] = useState<Mode>('rendered')

  const toggle = (
    <PreviewToggle
      value={mode}
      onChange={setMode}
      label={locale.previewRendered}
      options={[
        { value: 'rendered', label: locale.previewRendered, icon: <EyeIcon size={12} /> },
        { value: 'source', label: locale.previewSource, icon: <CodeIcon size={12} /> },
      ]}
    />
  )

  if (mode === 'source') {
    return (
      <TextPreview
        text={text}
        language="markdown"
        toolbar={toggle}
        onDownload={onDownload}
        className={className}
      />
    )
  }

  return (
    <PreviewFrame
      className={className}
      toolbar={
        <>
          {toggle}
          <PreviewToolbarSpacer />
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
      {/* Capped and centred: a document at panel width is fine, but a panel dragged out to
          half the screen would otherwise give 200-character lines. */}
      <div className="mx-auto max-w-3xl px-4 py-3">
        <Markdown>{text}</Markdown>
      </div>
    </PreviewFrame>
  )
}

/** `MarkdownPreview` for a `PreviewFile`. */
export function MarkdownFilePreview({
  file,
  className,
}: {
  file: PreviewFile
  className?: string
}) {
  return (
    <PreviewLoader file={file} as="text">
      {(text) => (
        <MarkdownPreview
          text={text}
          onDownload={canDownload(file) ? () => downloadFile(file) : undefined}
          className={className}
        />
      )}
    </PreviewLoader>
  )
}
