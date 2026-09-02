'use client'

import type { CSSProperties, ReactNode } from 'react'

import { cn } from '../lib/cn'
import { ImageIcon } from '../icons'
import { Skeleton } from './Skeleton'

/**
 * Inline style that reserves the box an image will occupy.
 *
 * Inline rather than a Tailwind `aspect-*` class: the ratio is a runtime number, and a
 * class name built from one is invisible to the JIT scanner, so it would simply never be
 * generated. Shared with `ImagePart` so the placeholder and the decoded image are laid out
 * by identical arithmetic — any drift between the two is a visible jump.
 */
export function reservedBoxStyle(aspect: number, maxHeight: number): CSSProperties {
  return { aspectRatio: aspect, width: '100%', maxHeight, maxWidth: maxHeight * aspect }
}

export type ImageSkeletonProps = {
  /** Width / height. Ignored when `width` and `height` are both given. */
  ratio?: number
  /** Intrinsic pixel dimensions, if the generator declared them. */
  width?: number
  height?: number
  /** 0–1. Omit for an indeterminate wait — most generators cannot report progress. */
  progress?: number
  /** One line under the glyph, e.g. the locale's 「生成中」. */
  label?: ReactNode
  /** Caps how tall the placeholder may grow in a narrow column. */
  maxHeight?: number
  className?: string
}

/**
 * The box an image will occupy, drawn before the image exists.
 *
 * The point is the *aspect ratio*, not the shimmer: generation takes tens of seconds, and
 * an image that appears with no reserved space shoves everything below it down at the
 * exact moment the user has started reading. Reserving the ratio up front costs one number
 * from the generator and removes the reflow entirely.
 *
 * Falls back to 1:1 when nothing is declared — square is the least wrong guess for
 * generated imagery, and a wrong ratio still beats no box at all.
 */
export function ImageSkeleton({
  ratio,
  width,
  height,
  progress,
  label,
  maxHeight = 320,
  className,
}: ImageSkeletonProps) {
  const aspect = width && height ? width / height : (ratio ?? 1)

  return (
    <div
      role="img"
      aria-label={typeof label === 'string' ? label : undefined}
      aria-busy="true"
      className={cn(
        'relative my-2 overflow-hidden rounded-cc-md border border-cc-border bg-cc-subtle',
        className,
      )}
      style={reservedBoxStyle(aspect, maxHeight)}
    >
      <ImageSkeletonFill progress={progress} label={label} />
    </div>
  )
}

/**
 * The contents of a placeholder box, without the box.
 *
 * Split out so `ImagePart` can lay the same shimmer over an image that has a URL but has
 * not decoded yet, inside a box it already owns.
 */
export function ImageSkeletonFill({ progress, label }: { progress?: number; label?: ReactNode }) {
  const determinate = progress !== undefined && Number.isFinite(progress)
  const clamped = determinate ? Math.min(1, Math.max(0, progress)) : 0

  return (
    <>
      <Skeleton className="absolute inset-0 rounded-none" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <ImageIcon size={22} className="text-cc-faint/60" />
        {label && <span className="text-cc-xs text-cc-faint">{label}</span>}
      </div>

      {determinate && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-cc-sunken">
          <div
            className="h-full bg-cc-accent/70 transition-[width] duration-300 ease-cc"
            style={{ width: `${clamped * 100}%` }}
          />
        </div>
      )}
    </>
  )
}
