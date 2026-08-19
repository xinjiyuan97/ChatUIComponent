'use client'

import type { ChatModel } from '@agent-chat/core'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../lib/cn'
import { CheckIcon, ChevronDownIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'

export type ModelSelectProps = {
  models: ChatModel[]
  /** Controlled selection; omit to let the picker manage its own. */
  value?: string
  defaultValue?: string
  onChange?: (modelId: string, model: ChatModel) => void
  disabled?: boolean
  /** Opens upwards. On by default — the picker normally sits in the composer footer. */
  placement?: 'top' | 'bottom'
  className?: string
}

/**
 * The composer's model picker.
 *
 * Deliberately not a `<select>`: a native one cannot show a description line, and on
 * desktop it renders in the platform's own chrome, which is the one thing on the whole
 * screen that would not match the rest of the composer.
 *
 * The trigger shows only the model name — no icon, no accent colour. It sits next to the
 * attach and mic buttons, and the accent budget for that row is already spent on the send
 * button (see CONTRIBUTING, 「强调色一次只出现在一个地方」).
 */
export function ModelSelect(props: ModelSelectProps) {
  const {
    models,
    value: controlledValue,
    defaultValue,
    onChange,
    disabled = false,
    placement = 'top',
    className,
  } = props

  const locale = useLocale()
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? models[0]?.id)
  const selectedId = controlledValue ?? uncontrolled
  const selected = models.find((model) => model.id === selectedId) ?? models[0]

  const [open, setOpen] = useState(false)
  /* Which option the keyboard is on. Kept separate from the selection so arrowing through
   * the list does not commit anything until Enter. */
  const [activeIndex, setActiveIndex] = useState(0)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const select = useCallback(
    (model: ChatModel) => {
      if (model.disabled) return
      if (controlledValue === undefined) setUncontrolled(model.id)
      onChange?.(model.id, model)
      close()
    },
    [close, controlledValue, onChange],
  )

  /* Opening moves the cursor to the current selection rather than to the top: the list can
   * be long, and "where am I now" is the question the menu opens to answer. */
  const openMenu = () => {
    const index = models.findIndex((model) => model.id === selectedId)
    setActiveIndex(index < 0 ? 0 : index)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'Tab') {
      // Tabbing out of an open menu should close it, not leave a floating panel behind.
      close(false)
      return
    }

    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step !== 0) {
      event.preventDefault()
      setActiveIndex((index) => (index + step + models.length) % models.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(models.length - 1)
    }
  }

  if (models.length === 0) return null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${locale.model}: ${selected?.name ?? ''}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          openMenu()
        }}
        className={cn(
          'inline-flex h-7 max-w-44 items-center gap-1 rounded-cc-sm pl-2 pr-1.5',
          'text-cc-sm text-cc-muted transition-colors duration-150 ease-cc',
          'hover:bg-cc-subtle hover:text-cc-fg',
          'disabled:pointer-events-none disabled:opacity-50',
          'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
          open && 'bg-cc-subtle text-cc-fg',
        )}
      >
        <span className="truncate">{selected?.name}</span>
        <ChevronDownIcon
          size={13}
          className={cn(
            'shrink-0 text-cc-faint transition-transform duration-150 ease-cc',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" aria-hidden="true" onClick={() => close(false)} />
          <div
            role="listbox"
            aria-label={locale.model}
            onKeyDown={onListKeyDown}
            className={cn(
              'absolute left-0 z-30 max-h-72 w-64 overflow-y-auto overscroll-contain',
              'rounded-cc-md border border-cc-border bg-cc-surface p-1',
              'shadow-cc-overlay animate-cc-rise',
              placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            )}
          >
            {models.map((model, index) => {
              const isSelected = model.id === selectedId
              return (
                <button
                  key={model.id}
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={model.disabled}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onClick={() => select(model)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-cc-xs px-2 py-1.5 text-left',
                    'transition-colors duration-150 ease-cc outline-none',
                    'hover:bg-cc-subtle focus-visible:bg-cc-subtle',
                    'disabled:pointer-events-none disabled:opacity-45',
                  )}
                >
                  {/* The check keeps its column even when absent, so the names stay aligned
                      instead of shifting by 16px as the selection moves. */}
                  <span className="flex h-[1.15rem] w-3.5 shrink-0 items-center justify-center">
                    {isSelected && <CheckIcon size={13} className="text-cc-accent" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-cc-sm font-medium text-cc-fg">
                        {model.name}
                      </span>
                      {model.badge && (
                        <span className="shrink-0 rounded-cc-xs bg-cc-subtle px-1 py-px text-cc-xs text-cc-faint">
                          {model.badge}
                        </span>
                      )}
                    </span>
                    {model.description && (
                      <span className="mt-0.5 text-cc-xs leading-[1.5] text-cc-faint">
                        {model.description}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
