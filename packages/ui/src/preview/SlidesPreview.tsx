'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'

import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { DownloadIcon, ExternalLinkIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { PdfPreview } from './PdfPreview'
import { PreviewFrame, PreviewToolbarLabel, PreviewToolbarSpacer } from './PreviewFrame'
import { UnsupportedPreview } from './UnsupportedPreview'

export type SlidesPreviewProps = {
  file: PreviewFile
  className?: string
}

/**
 * A slide deck — shown only if someone else has already converted it.
 *
 * **We do not parse .pptx.** There is no front-end renderer for it with acceptable
 * fidelity: a deck is absolute-positioned shapes, theme inheritance, embedded fonts,
 * SmartArt and transitions, and every library that attempts it produces a slide whose text
 * has moved off the shape it belonged to. A preview that is quietly wrong is worse than no
 * preview, because the reader has no way to tell which of the two they are looking at.
 *
 * So the deal is explicit: hand us `file.converted` — a PDF or one image per slide, from
 * LibreOffice or an equivalent on the server — and it renders. Otherwise the fallback page
 * says, in as many words, that server-side conversion is what this needs.
 */
export function SlidesPreview({ file, className }: SlidesPreviewProps) {
  const locale = useLocale()
  const converted = file.converted

  if (converted?.kind === 'pdf') {
    return <PdfPreview file={converted.file} className={className} />
  }

  if (converted?.kind === 'images' && converted.pages.length > 0) {
    return (
      <PreviewFrame
        className={className}
        toolbar={
          <>
            <PreviewToolbarLabel>
              {locale.previewPageOf(converted.pages.length)}
            </PreviewToolbarLabel>
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
        {/* A scrolling column rather than a slideshow: this is a preview pane, and the
            question it answers is "what is in this deck", which is faster to skim than to
            click through. */}
        <div className="flex flex-col items-center gap-4 bg-cc-paper-canvas p-4">
          {converted.pages.map((page, index) => (
            <figure key={page.url ?? page.name ?? index} className="w-full max-w-4xl">
              <img
                src={page.url}
                alt={page.name || `${index + 1}`}
                loading="lazy"
                className="w-full bg-cc-paper shadow-cc-card"
              />
              <figcaption className="pt-1 text-center text-cc-xs tabular-nums text-cc-faint">
                {index + 1}
              </figcaption>
            </figure>
          ))}
        </div>
      </PreviewFrame>
    )
  }

  return (
    <UnsupportedPreview file={file} reason="converted-artifact-missing" className={className} />
  )
}
