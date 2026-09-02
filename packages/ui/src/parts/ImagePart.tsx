'use client'

import type { FilePart as FilePartData } from '@xinjiyuan97/chat-core'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { AlertIcon, ImageOffIcon } from '../icons'
import { ImageSkeleton, ImageSkeletonFill, reservedBoxStyle } from '../primitives/ImageSkeleton'
import { useLocale } from '../provider/ChatThemeProvider'

/** Matches `ImageSkeleton`'s default cap, so placeholder and image agree on the box. */
const MAX_HEIGHT = 320

export type ImagePartProps = {
  part: FilePartData
  className?: string
}

/**
 * An image, including the minutes before it exists.
 *
 * Generated imagery arrives long after the message around it, so this renders the whole
 * lifecycle: a box at the declared aspect ratio, then the bitmap faded in once it has
 * actually decoded. Holding the placeholder until `onLoad` matters as much as showing it
 * in the first place — swapping to an `<img>` the instant a URL arrives just moves the
 * blank frame from before the request to after it.
 */
export function ImagePart({ part, className }: ImagePartProps) {
  const locale = useLocale()
  const [loaded, setLoaded] = useState(false)
  const [broken, setBroken] = useState(false)

  const url = part.url
  /* A regenerated image reuses its part, so the decode state has to follow the URL rather
   * than the mount — otherwise the second image inherits the first one's "already
   * loaded" and appears without ever having been drawn. */
  useEffect(() => {
    setLoaded(false)
    setBroken(false)
  }, [url])

  /* Two different failures, told apart on purpose. The generator refusing or erroring is
   * an agent-level event the user needs to see and probably act on; an image whose URL
   * simply will not load — expired link, offline, 404 — is a fact about one asset. Painting
   * the second one red trains people to ignore the first. */
  if (part.status === 'error') {
    return (
      <div
        className={cn(
          'my-2 flex w-fit max-w-full items-center gap-2 rounded-cc-md border',
          'border-cc-danger/35 bg-cc-danger-subtle/40 px-2.5 py-2',
          className,
        )}
      >
        <AlertIcon size={15} className="shrink-0 text-cc-danger" />
        <span className="truncate text-cc-sm text-cc-muted">
          {part.error || locale.imageFailed}
        </span>
      </div>
    )
  }

  if (broken) {
    return (
      <div
        className={cn(
          'my-2 flex w-fit max-w-full items-center gap-2 rounded-cc-md border border-cc-border',
          'bg-cc-surface px-2.5 py-2 opacity-70',
          className,
        )}
      >
        <ImageOffIcon size={15} className="shrink-0 text-cc-faint" />
        <span className="truncate text-cc-sm text-cc-muted">
          {part.name ?? locale.imageUnavailable}
        </span>
      </div>
    )
  }

  const ratio = part.width && part.height ? part.width / part.height : undefined

  if (part.status === 'generating' || !url) {
    return (
      <ImageSkeleton
        ratio={ratio}
        progress={part.progress}
        label={locale.imageGenerating}
        maxHeight={MAX_HEIGHT}
        className={className}
      />
    )
  }

  /* With no declared dimensions there is no box to reserve, so a placeholder would only
   * trade one reflow for another: it would be sized by a guessed ratio and then jump to
   * the real one. Render the image and let it size itself. */
  if (ratio === undefined) {
    return (
      <ImageLink url={url} className={cn('my-2 block w-fit max-w-full', className)}>
        <img
          src={url}
          alt={part.name ?? ''}
          loading="lazy"
          onError={() => setBroken(true)}
          className="max-h-80 max-w-full object-contain"
        />
      </ImageLink>
    )
  }

  return (
    <ImageLink
      url={url}
      className={cn('relative my-2 block overflow-hidden', className)}
      style={reservedBoxStyle(ratio, MAX_HEIGHT)}
    >
      {/* Stacked rather than swapped: the image has to be in the tree to start decoding,
          and the placeholder has to stay until it finishes. */}
      <img
        src={url}
        alt={part.name ?? ''}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        className={cn('size-full object-contain', loaded ? 'animate-cc-fade-in' : 'opacity-0')}
      />
      {/* No label here. By this point the bytes exist and are merely in transit — claiming
          「生成中」 would be a lie for an ordinary attachment that is simply downloading. */}
      {!loaded && <ImageSkeletonFill />}
    </ImageLink>
  )
}

function ImageLink({
  url,
  className,
  style,
  children,
}: {
  url: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      className={cn(
        'rounded-cc-md border border-cc-border',
        'outline-none transition-shadow duration-150 ease-cc',
        'focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      {children}
    </a>
  )
}
