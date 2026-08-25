'use client'

import type { A2UIComponentProps, A2UIContext } from '@xinjiyuan97/a2ui'
import { useId, type ReactNode } from 'react'

import { cn } from '../lib/cn'
import { Button as UIButton, type ButtonVariant } from '../primitives/Button'
import { bool, num, oneOf, optionalStr, options, str } from './props'

/**
 * Reads a control's current value out of the surface's shared form state.
 *
 * Named controls are uncontrolled from the spec's point of view: the spec supplies an
 * initial `value`, the user edits it, and the renderer holds the truth from then on.
 * Without this fallback ordering, re-rendering the surface after any keystroke would snap
 * every field back to what the agent originally wrote.
 */
function valueOf(ctx: A2UIContext, name: string, props: Record<string, unknown>): unknown {
  if (name && name in ctx.values) return ctx.values[name]
  return props['value'] ?? props['defaultValue']
}

const FIELD_CLASS = cn(
  'w-full rounded-cc-sm border border-cc-border bg-cc-surface px-2.5 py-1.5',
  'text-cc-sm text-cc-fg outline-none transition-colors duration-150 ease-cc',
  'placeholder:text-cc-faint focus:border-cc-border-strong',
  'disabled:cursor-not-allowed disabled:bg-cc-subtle disabled:text-cc-faint',
)

const VARIANTS: readonly ButtonVariant[] = ['primary', 'subtle', 'ghost', 'outline', 'danger']

export function Button({ props, children, ctx }: A2UIComponentProps) {
  const label = optionalStr(props['label'] ?? props['text']) ?? children

  return (
    <UIButton
      type={bool(props['submit']) ? 'submit' : 'button'}
      variant={oneOf(props['variant'], VARIANTS, 'subtle')}
      size={oneOf(props['size'], ['sm', 'md', 'lg'] as const, 'sm')}
      disabled={ctx.disabled || bool(props['disabled'])}
      onClick={() => ctx.emit(props['onClick'] ?? props['onPress'] ?? props['action'])}
    >
      {label}
    </UIButton>
  )
}

export function Input({ props, ctx }: A2UIComponentProps) {
  const name = str(props['name'] ?? props['id'])
  const label = optionalStr(props['label'])
  const id = useId()

  return (
    <ControlShell
      id={id}
      label={label}
      required={bool(props['required'])}
      help={optionalStr(props['help'])}
    >
      <input
        id={id}
        name={name}
        // Constrained to text-like types: `file` and `image` have side effects a spec
        // should not be able to trigger, and `submit` would turn an input into a button.
        type={oneOf(
          props['type'],
          ['text', 'email', 'url', 'tel', 'number', 'password', 'date'] as const,
          'text',
        )}
        value={str(valueOf(ctx, name, props))}
        placeholder={str(props['placeholder'])}
        disabled={ctx.disabled || bool(props['disabled'])}
        required={bool(props['required'])}
        onChange={(event) => ctx.setValue(name, event.target.value)}
        className={FIELD_CLASS}
      />
    </ControlShell>
  )
}

export function Textarea({ props, ctx }: A2UIComponentProps) {
  const name = str(props['name'] ?? props['id'])
  const id = useId()

  return (
    <ControlShell
      id={id}
      label={optionalStr(props['label'])}
      required={bool(props['required'])}
      help={optionalStr(props['help'])}
    >
      <textarea
        id={id}
        name={name}
        rows={Math.min(12, Math.max(2, num(props['rows'], 3)))}
        value={str(valueOf(ctx, name, props))}
        placeholder={str(props['placeholder'])}
        disabled={ctx.disabled || bool(props['disabled'])}
        required={bool(props['required'])}
        onChange={(event) => ctx.setValue(name, event.target.value)}
        className={cn(FIELD_CLASS, 'resize-y leading-[1.6]')}
      />
    </ControlShell>
  )
}

export function Select({ props, ctx }: A2UIComponentProps) {
  const name = str(props['name'] ?? props['id'])
  const items = options(props['options'] ?? props['items'] ?? props['choices'])
  const id = useId()
  const placeholder = optionalStr(props['placeholder'])

  return (
    <ControlShell
      id={id}
      label={optionalStr(props['label'])}
      required={bool(props['required'])}
      help={optionalStr(props['help'])}
    >
      <select
        id={id}
        name={name}
        value={str(valueOf(ctx, name, props))}
        disabled={ctx.disabled || bool(props['disabled'])}
        required={bool(props['required'])}
        onChange={(event) => ctx.setValue(name, event.target.value)}
        className={cn(FIELD_CLASS, 'cursor-pointer appearance-none pr-8')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {items.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </ControlShell>
  )
}

export function Checkbox({ props, ctx }: A2UIComponentProps) {
  const name = str(props['name'] ?? props['id'])
  const checked = bool(valueOf(ctx, name, props))
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2 text-cc-sm text-cc-fg',
        (ctx.disabled || bool(props['disabled'])) && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={ctx.disabled || bool(props['disabled'])}
        onChange={(event) => ctx.setValue(name, event.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-cc-accent"
      />
      <span className="leading-[1.5]">
        {str(props['label'] ?? props['text'])}
        {optionalStr(props['help']) && (
          <span className="block text-cc-xs text-cc-faint">{str(props['help'])}</span>
        )}
      </span>
    </label>
  )
}

export function RadioGroup({ props, ctx }: A2UIComponentProps) {
  const name = str(props['name'] ?? props['id'])
  const items = options(props['options'] ?? props['items'] ?? props['choices'])
  const selected = str(valueOf(ctx, name, props))
  const label = optionalStr(props['label'])
  const disabled = ctx.disabled || bool(props['disabled'])

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      {label && (
        <legend className="mb-1 text-cc-xs font-medium text-cc-muted">
          {label}
          {bool(props['required']) && <span className="ml-0.5 text-cc-danger">*</span>}
        </legend>
      )}
      {items.map((option) => (
        <label
          key={option.value}
          className={cn(
            'flex cursor-pointer items-center gap-2 text-cc-sm text-cc-fg',
            (disabled || option.disabled) && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name || label || 'radio-group'}
            value={option.value}
            checked={selected === option.value}
            disabled={disabled || option.disabled}
            onChange={() => ctx.setValue(name, option.value)}
            className="size-3.5 shrink-0 accent-cc-accent"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

/** Shared label / help wrapper so every control lines up on the same grid. */
function ControlShell({
  id,
  label,
  required,
  help,
  children,
}: {
  id: string
  label?: string
  required?: boolean
  help?: string
  children: ReactNode
}) {
  if (!label && !help) return <>{children}</>

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-cc-xs font-medium text-cc-muted">
          {label}
          {required && <span className="ml-0.5 text-cc-danger">*</span>}
        </label>
      )}
      {children}
      {help && <span className="text-cc-xs text-cc-faint">{help}</span>}
    </div>
  )
}
