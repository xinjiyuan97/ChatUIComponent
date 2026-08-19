'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { SpinnerIcon } from '../icons'

export type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

/**
 * Focus is always shown with a ring offset from the element rather than an outline on
 * it: on rounded surfaces an outline traces the bounding box, which looks broken.
 */
const FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cc-canvas'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-cc-accent text-cc-accent-fg hover:bg-cc-accent-hover shadow-cc-card active:translate-y-px',
  subtle: 'bg-cc-subtle text-cc-fg hover:bg-cc-sunken',
  ghost: 'text-cc-muted hover:bg-cc-subtle hover:text-cc-fg',
  outline: 'border border-cc-border bg-cc-surface text-cc-fg hover:bg-cc-subtle',
  danger: 'bg-cc-danger text-white hover:brightness-95',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-cc-xs rounded-cc-sm',
  md: 'h-9 gap-2 px-3.5 text-cc-sm rounded-cc-md',
  lg: 'h-11 gap-2 px-5 text-cc-body rounded-cc-md',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'subtle',
    size = 'md',
    loading,
    iconLeft,
    iconRight,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,color,box-shadow,transform] duration-150 ease-cc',
        'disabled:pointer-events-none disabled:opacity-45',
        FOCUS,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <SpinnerIcon size={14} className="animate-cc-spin" /> : iconLeft}
      {children}
      {iconRight}
    </button>
  )
})
