import { cn } from '../lib/cn'

export type SkeletonProps = {
  className?: string
  /** Renders a sweeping highlight instead of a flat block. */
  shimmer?: boolean
}

export function Skeleton({ className, shimmer = true }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-cc-xs bg-cc-subtle',
        shimmer && [
          // A moving gradient reads as "loading" more clearly than a pulse, and unlike
          // opacity it doesn't make surrounding text appear to flicker.
          'bg-[linear-gradient(90deg,transparent_0%,var(--color-cc-sunken)_50%,transparent_100%)]',
          'bg-[length:200%_100%] animate-cc-shimmer',
        ],
        className,
      )}
    />
  )
}

/** Multi-line placeholder with a short final line, mimicking a real paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-2/5' : index % 2 ? 'w-4/5' : 'w-full')}
        />
      ))}
    </div>
  )
}
