'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import { useState } from 'react'

import { CodeIcon, DownloadIcon, EyeIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { PreviewFrame, PreviewToggle, PreviewToolbarSpacer } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { TextPreview } from './TextPreview'

export type HtmlPreviewProps = {
  html: string
  /** Names the frame for assistive tech. Defaults to the locale's preview label. */
  title?: string
  onDownload?: () => void
  className?: string
}

type Mode = 'rendered' | 'source'

/**
 * An HTML file, rendered in a sandbox or read as source.
 *
 * ## Why an iframe and not sanitised inline markup
 *
 * The document is agent output, and rendering it inline would put arbitrary markup in the
 * host page's DOM: one `<script>` and it is running with the host's cookies and origin, one
 * `position: fixed` rule and it is painting over the chat. Neither is fixable by escaping
 * strings.
 *
 * So it goes in `<iframe srcdoc sandbox="">` — an **empty** sandbox, with `allow-scripts`
 * deliberately absent. That single attribute is what makes this safe, and it is enforced by
 * the browser rather than by us: scripts do not run, `javascript:` URLs do not resolve,
 * forms do not submit, plugins do not load, the frame cannot navigate the top window, and
 * it gets an opaque origin so it cannot touch the host's storage or DOM. Adding
 * `allow-scripts` here would undo all of it at once.
 *
 * That is also why there is no DOMPurify dependency. A sanitiser is a denylist that has to
 * keep pace with every new bypass; the sandbox is an engine-level capability switch. The
 * cost is that legitimate scripted documents — a chart, an interactive report — render
 * static, which is the right trade for a preview pane.
 */
export function HtmlPreview({ html, title, onDownload, className }: HtmlPreviewProps) {
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
        text={html}
        language="html"
        toolbar={toggle}
        onDownload={onDownload}
        className={className}
      />
    )
  }

  return (
    <PreviewFrame
      className={className}
      // The iframe scrolls its own document; an outer scrollbar would be a second one.
      scroll={false}
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
      <iframe
        // Remounts on new content instead of reusing the frame: a document that scrolled
        // itself or set a hash would otherwise carry that state into the next file.
        key={html}
        title={title ?? locale.previewRendered}
        srcDoc={html}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-full w-full border-0 bg-cc-paper"
      />
    </PreviewFrame>
  )
}

/** `HtmlPreview` for a `PreviewFile`. */
export function HtmlFilePreview({ file, className }: { file: PreviewFile; className?: string }) {
  return (
    <PreviewLoader file={file} as="text">
      {(html) => (
        <HtmlPreview
          html={html}
          title={file.name}
          onDownload={canDownload(file) ? () => downloadFile(file) : undefined}
          className={className}
        />
      )}
    </PreviewLoader>
  )
}
