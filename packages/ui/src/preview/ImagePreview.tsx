'use client'

import { useImageZoom, type PreviewFile } from '@xinjiyuan97/chat-core'
import { useEffect, useMemo, useState } from 'react'

import { cn } from '../lib/cn'
import { DownloadIcon, FitIcon, ZoomInIcon, ZoomOutIcon } from '../icons'
import { IconButton } from '../primitives/IconButton'
import { useLocale } from '../provider/ChatThemeProvider'
import { canDownload, downloadFile } from './download'
import { PreviewFrame, PreviewToolbarLabel, PreviewToolbarSeparator } from './PreviewFrame'
import { PreviewLoader } from './PreviewLoader'
import { UnsupportedPreview } from './UnsupportedPreview'

export type ImagePreviewProps = {
  src: string
  /** Alt text. The file name is the honest default — we do not know what is in the image. */
  alt?: string
  onDownload?: () => void
  className?: string
}

/**
 * An image with zoom and pan.
 *
 * The state machine is [`useImageZoom`](../../../core/src/hooks/useImageZoom.ts); what is
 * here is the toolbar and the two details that only exist at the DOM level: `draggable=false`
 * on the image, because the browser's native image drag hijacks the first few pixels of
 * every pan, and `touch-action: none` on the viewport, because otherwise the browser
 * consumes the gesture for scrolling before a pointer move ever arrives.
 */
export function ImagePreview({ src, alt, onDownload, className }: ImagePreviewProps) {
  const locale = useLocale()
  const zoom = useImageZoom()
  const { fit } = zoom
  const [failed, setFailed] = useState(false)

  // A new image is a new document: whatever the last one was zoomed to should not carry over.
  useEffect(() => {
    setFailed(false)
    fit()
  }, [src, fit])

  if (failed) {
    return (
      <UnsupportedPreview
        file={{ name: alt ?? '', url: src }}
        reason="fetch-failed"
        className={className}
      />
    )
  }

  return (
    <PreviewFrame
      className={className}
      // The image is transformed inside a fixed viewport; scrollbars would fight the pan.
      scroll={false}
      toolbar={
        <>
          <IconButton
            size="sm"
            label={locale.previewZoomOut}
            icon={<ZoomOutIcon size={14} />}
            disabled={zoom.scale <= zoom.min}
            onClick={zoom.zoomOut}
          />
          <PreviewToolbarLabel>{`${Math.round(zoom.scale * 100)}%`}</PreviewToolbarLabel>
          <IconButton
            size="sm"
            label={locale.previewZoomIn}
            icon={<ZoomInIcon size={14} />}
            disabled={zoom.scale >= zoom.max}
            onClick={zoom.zoomIn}
          />
          <PreviewToolbarSeparator />
          <IconButton
            size="sm"
            label={locale.previewActualSize}
            icon={<span className="text-cc-xs font-medium">1:1</span>}
            active={!zoom.fitted && zoom.scale === 1}
            onClick={zoom.actual}
          />
          <IconButton
            size="sm"
            label={locale.previewFit}
            icon={<FitIcon size={14} />}
            active={zoom.fitted}
            onClick={zoom.fit}
          />
          {onDownload && (
            <>
              <PreviewToolbarSeparator />
              <IconButton
                size="sm"
                label={locale.previewDownload}
                icon={<DownloadIcon size={14} />}
                onClick={onDownload}
              />
            </>
          )}
        </>
      }
    >
      <div
        ref={zoom.viewportRef}
        {...zoom.viewportProps}
        className={cn(
          'flex h-full w-full items-center justify-center overflow-hidden bg-cc-paper-canvas',
          'touch-none select-none',
          zoom.fitted ? 'cursor-default' : zoom.panning ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <img
          src={src}
          alt={alt ?? ''}
          draggable={false}
          onLoad={(event) =>
            zoom.setNaturalSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
          }
          onError={() => setFailed(true)}
          style={{ transform: zoom.transform }}
          // No transition on the transform: it would lag a drag by its own duration and
          // make the image feel like it is on a rubber band.
          className="max-w-none origin-center"
        />
      </div>
    </PreviewFrame>
  )
}

export type ImageFilePreviewProps = {
  file: PreviewFile
  className?: string
}

/**
 * `ImagePreview` for a `PreviewFile`.
 *
 * A remote image is handed to `<img>` by URL rather than fetched into a blob first: the
 * browser then streams and caches it, and a progressive JPEG paints as it arrives instead of
 * appearing all at once after a download we would have had to buffer entirely in memory.
 * Only inline or lazily-loaded content takes the object-URL path.
 */
export function ImageFilePreview({ file, className }: ImageFilePreviewProps) {
  const download = canDownload(file) ? () => downloadFile(file) : undefined

  if (file.content === undefined && file.url) {
    return (
      <ImagePreview src={file.url} alt={file.name} onDownload={download} className={className} />
    )
  }

  return (
    <PreviewLoader file={file} as="blob">
      {(blob) => (
        <BlobImagePreview blob={blob} alt={file.name} onDownload={download} className={className} />
      )}
    </PreviewLoader>
  )
}

function BlobImagePreview({
  blob,
  alt,
  onDownload,
  className,
}: {
  blob: Blob
  alt: string
  onDownload?: () => void
  className?: string
}) {
  const src = useMemo(() => URL.createObjectURL(blob), [blob])
  // Revoked on unmount, not on the next render: leaking one object URL per opened image
  // pins the whole decoded bitmap for the lifetime of the tab.
  useEffect(() => () => URL.revokeObjectURL(src), [src])

  return <ImagePreview src={src} alt={alt} onDownload={onDownload} className={className} />
}
