'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import { useEffect, useRef, useState } from 'react'

import { DownloadIcon, ExternalLinkIcon, SpinnerIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { DOCX_CLASS, renderDocx, type DocxRenderResult } from './docx-renderer'
import { PreviewFrame, PreviewToolbarSpacer } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { UnsupportedPreview } from './UnsupportedPreview'

export type WordPreviewProps = {
  file: PreviewFile
  className?: string
}

/** A .docx, rendered by `docx-preview` into a container we own. */
export function WordPreview({ file, className }: WordPreviewProps) {
  return (
    <PreviewLoader file={file} as="blob">
      {(blob) => <WordDocument blob={blob} file={file} className={className} />}
    </PreviewLoader>
  )
}

function WordDocument({
  blob,
  file,
  className,
}: {
  blob: Blob
  file: PreviewFile
  className?: string
}) {
  const locale = useLocale()
  const bodyRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<DocxRenderResult | null>(null)

  useEffect(() => {
    const body = bodyRef.current
    const styles = styleRef.current
    if (!body || !styles) return

    let cancelled = false
    setResult(null)

    void renderDocx(blob, body, styles).then((next) => {
      if (cancelled) return
      setResult(next)
    })

    return () => {
      cancelled = true
      /* Emptied by hand. The library appends into these nodes rather than owning them, so
       * React does not know there is anything to clean up, and a second render would stack
       * a second copy of the document under the first. */
      body.replaceChildren()
      styles.replaceChildren()
    }
  }, [blob])

  const failed = result !== null && result.status !== 'ok'

  return (
    <PreviewFrame
      className={className}
      toolbar={
        <>
          <PreviewToolbarSpacer />
          {canDownload(file) && (
            <IconButton
              size="sm"
              label={locale.previewDownload}
              icon={<DownloadIcon size={14} />}
              onClick={() => downloadFile(file)}
            />
          )}
          {file.url && (
            <IconButton
              size="sm"
              label={locale.previewOpenExternal}
              icon={<ExternalLinkIcon size={14} />}
              onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
            />
          )}
        </>
      }
    >
      {/* The style container stays mounted whatever happens: it is where the library put the
          document's own CSS, and unmounting it mid-render would strip the styles off the
          markup that is still on screen. */}
      <div ref={styleRef} hidden />

      {result === null && (
        <div className="flex h-full items-center justify-center gap-2 text-cc-sm text-cc-faint">
          <SpinnerIcon size={14} />
          {locale.previewLoading}
        </div>
      )}

      {failed && (
        <UnsupportedPreview
          file={file}
          reason={result.status === 'unavailable' ? 'renderer-missing' : 'render-failed'}
          packageName="docx-preview"
          detail={result.status === 'error' ? result.message : undefined}
        />
      )}

      <div
        ref={bodyRef}
        // Hidden rather than unmounted while loading: the library renders into this node, so
        // it has to exist before there is anything to show in it.
        className={`${DOCX_CLASS}-host bg-cc-paper-canvas ${result?.status === 'ok' ? '' : 'hidden'}`}
      />
    </PreviewFrame>
  )
}
