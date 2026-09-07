'use client'

import { fileExtension, type PreviewFailure, type PreviewFile } from '@xinjiyuan97/chat-core'
import type { ReactNode } from 'react'

import { Button } from '../primitives/Button'
import { cn } from '../lib/cn'
import { formatBytes } from '../lib/format'
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  RegenerateIcon,
  SlidesIcon,
  ZoomOutIcon,
} from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'

export type UnsupportedPreviewProps = {
  file: PreviewFile
  reason: PreviewFailure
  /** npm package name, for `renderer-missing`. */
  packageName?: string
  /** Extra detail under the headline — an HTTP status, a parser's complaint. */
  detail?: string
  /** Offer a retry. Only meaningful for the two transient reasons. */
  onRetry?: () => void
  /** Byte cap that was exceeded, for `too-large`. */
  maxBytes?: number
  className?: string
}

/**
 * What the panel shows when it cannot show the file.
 *
 * Two decisions:
 *
 * **The reason is spelled out.** "无法预览" tells a user nothing they can act on. A missing
 * optional dependency is fixed with one `pnpm add`; a missing PDF worker with one prop; an
 * over-large file by downloading it instead. Each of those is a different sentence and a
 * different button, and collapsing them into one message throws away the only useful part.
 *
 * **None of it is drawn as an error.** Same call as `ImagePart`: red is reserved for the
 * agent failing at something. A `.psd` we cannot render is not a failure, it is the
 * ordinary state of a library that does not render Photoshop files, and painting it red
 * teaches users to distrust a colour that should mean something.
 */
export function UnsupportedPreview({
  file,
  reason,
  packageName,
  detail,
  onRetry,
  maxBytes,
  className,
}: UnsupportedPreviewProps) {
  const locale = useLocale()
  const extension = fileExtension(file.name)

  const headline: Record<PreviewFailure, string> = {
    'unsupported-type': locale.previewUnsupported(extension),
    'renderer-missing': locale.previewRendererMissing(packageName ?? ''),
    'needs-config': locale.previewNeedsConfig,
    'too-large': locale.previewTooLarge(
      formatBytes(file.size),
      maxBytes === undefined ? '' : formatBytes(maxBytes),
    ),
    'fetch-failed': locale.previewFetchFailed,
    'render-failed': locale.previewRenderFailed,
    'converted-artifact-missing': locale.previewConvertedArtifactMissing,
  }

  const hint: Partial<Record<PreviewFailure, ReactNode>> = {
    'renderer-missing': packageName ? <Snippet>{`pnpm add ${packageName}`}</Snippet> : null,
    'needs-config': (
      <>
        <p className="text-cc-xs text-cc-faint">{locale.previewPdfWorkerHint}</p>
        <Snippet>{PDF_WORKER_SNIPPET}</Snippet>
      </>
    ),
  }

  const Glyph = reason === 'converted-artifact-missing' ? SlidesIcon : GLYPHS[reason]
  const retryable = reason === 'fetch-failed' || reason === 'render-failed'
  const saveable = canDownload(file)

  return (
    /*
     * `m-auto` on the inner block rather than `justify-center` on the outer one. Both centre
     * the card, but a centred flex item that outgrows its container overflows in *both*
     * directions and the top half becomes unreachable — no scrolling gets you back to it.
     * Auto margins collapse to zero instead, so a tall card (the worker snippet, in a short
     * panel) simply starts at the top and scrolls.
     */
    <div className={cn('flex h-full min-h-0 flex-col overflow-y-auto', className)}>
      <div className="m-auto flex flex-col items-center gap-3 px-6 py-10 text-center">
        {/* Without `shrink-0` the icon is the flex item that gives when the card is too tall
            for the panel, and 28px of glyph collapses into a 1px smudge. */}
        <Glyph size={28} className="shrink-0 text-cc-faint" />

        <div className="flex max-w-80 flex-col gap-1">
          <p className="truncate text-cc-sm font-medium text-cc-fg" title={file.name}>
            {file.name}
          </p>
          <p className="text-cc-sm text-cc-muted">{headline[reason]}</p>
          {detail && <p className="text-cc-xs text-cc-faint">{detail}</p>}
        </div>

        {hint[reason] && <div className="flex max-w-96 flex-col gap-1.5">{hint[reason]}</div>}

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {retryable && onRetry && (
            <Button
              size="sm"
              variant="subtle"
              onClick={onRetry}
              iconLeft={<RegenerateIcon size={13} />}
            >
              {locale.previewRetry}
            </Button>
          )}
          {saveable && (
            <Button
              size="sm"
              variant="outline"
              iconLeft={<DownloadIcon size={13} />}
              onClick={() => downloadFile(file)}
            >
              {locale.previewDownload}
            </Button>
          )}
          {file.url && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<ExternalLinkIcon size={13} />}
              onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
            >
              {locale.previewOpenExternal}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const GLYPHS: Record<PreviewFailure, typeof FileIcon> = {
  'unsupported-type': FileIcon,
  'renderer-missing': FileIcon,
  'needs-config': FileIcon,
  'too-large': ZoomOutIcon,
  'fetch-failed': FileIcon,
  'render-failed': FileIcon,
  'converted-artifact-missing': SlidesIcon,
}

const PDF_WORKER_SNIPPET = `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

<ChatThemeProvider pdfWorkerSrc={workerSrc}>`

/*
 * Wraps rather than scrolls horizontally. This snippet exists to be copied, and a line that
 * runs off the right edge of a 380px panel hides the half the reader needs — with no scrollbar
 * hint that anything is missing. A wrapped `import` line is mildly ugly; a truncated one is
 * useless.
 */
function Snippet({ children }: { children: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-cc-sm bg-cc-subtle px-2.5 py-2 text-left font-mono text-cc-xs text-cc-muted">
      <code>{children}</code>
    </pre>
  )
}
