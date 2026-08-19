'use client'

import type {
  AttachmentController,
  ChatModel,
  FilePart,
  QuotedMessage,
  VoiceController,
} from '@agent-chat/core'
import { useAutoResizeTextarea } from '@agent-chat/core'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { cn } from '../lib/cn'
import { ArrowUpIcon, ImageIcon, PaperclipIcon, StopIcon, UploadIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { AttachmentList } from './AttachmentList'
import { ModelSelect } from './ModelSelect'
import { QuotePreview } from './QuotePreview'
import { VoiceButton, VoiceStatus } from './VoiceButton'

export type PromptSubmitOptions = {
  /** File parts built from the pending attachments. Empty when nothing was attached. */
  parts: FilePart[]
  /**
   * The passage being replied to, if the quote strip was showing.
   *
   * Handed back rather than spliced into the text: whether a quote becomes a `>` block, a
   * separate turn, or an API field is the host's decision, and prepending it here would
   * take that decision away.
   */
  quote?: QuotedMessage
}

export type PromptInputProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onSubmit: (value: string, options: PromptSubmitOptions) => void
  onStop?: () => void
  /** A reply is streaming: the send button becomes a stop button. */
  streaming?: boolean
  disabled?: boolean
  placeholder?: string
  /** From `useAttachments`. Enables the attach button, drag-and-drop and paste. */
  attachments?: AttachmentController
  /** From `useVoiceInput`. Enables the mic button. */
  voice?: VoiceController
  /** Adds a second, image-only picker next to the paperclip. */
  showImageButton?: boolean
  /** Adds a model picker to the toolbar. Omit — or pass `[]` — and no picker renders. */
  models?: ChatModel[]
  /** Controlled model selection; omit to let the picker manage its own. */
  model?: string
  defaultModel?: string
  onModelChange?: (modelId: string, model: ChatModel) => void
  /**
   * The message being replied to. Renders the quote strip above the textarea and comes back
   * in `onSubmit`'s options. Fully controlled — clear it in `onQuoteRemove` and after a
   * submit, or the strip stays put.
   */
  quote?: QuotedMessage | null
  /** Dismissed via the strip's close button or Escape in the textarea. */
  onQuoteRemove?: () => void
  /** Rendered on the left of the toolbar, after the model picker. */
  toolbar?: ReactNode
  /** Rendered above the textarea, under the attachment list. */
  header?: ReactNode
  /** Shows the "Enter to send" hint under the box. */
  showHint?: boolean
  maxRows?: number
  autoFocus?: boolean
  className?: string
}

/**
 * Joins a dictated fragment onto whatever was already typed.
 *
 * A space belongs between two Latin words but not between two Chinese characters, so the
 * separator is decided by the characters actually meeting at the seam.
 */
function joinTranscript(base: string, addition: string): string {
  if (!base) return addition
  if (!addition) return base
  const left = base.at(-1) ?? ''
  const right = addition[0] ?? ''
  const needsSpace = /[A-Za-z0-9)\]'"]/.test(left) && /[A-Za-z0-9([]/.test(right)
  return `${base}${needsSpace ? ' ' : ''}${addition}`
}

const EMPTY_PARTS: FilePart[] = []

/**
 * The composer.
 *
 * The one non-obvious requirement here is IME support. While a Chinese, Japanese or Korean
 * input method is composing, Enter means "accept the candidate", not "send" — a composer
 * that only checks `event.key === 'Enter'` fires halfway through every Chinese sentence.
 * See `isComposingRef` below for why the React event's own flag is not enough.
 */
export function PromptInput(props: PromptInputProps) {
  const {
    value: controlledValue,
    defaultValue = '',
    onValueChange,
    onSubmit,
    onStop,
    streaming = false,
    disabled = false,
    placeholder,
    attachments,
    voice,
    showImageButton = false,
    models,
    model,
    defaultModel,
    onModelChange,
    quote,
    onQuoteRemove,
    toolbar,
    header,
    showHint = true,
    maxRows = 12,
    autoFocus,
    className,
  } = props

  const locale = useLocale()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const value = controlledValue ?? uncontrolled

  const setValue = useCallback(
    (next: string) => {
      if (controlledValue === undefined) setUncontrolled(next)
      onValueChange?.(next)
    },
    [controlledValue, onValueChange],
  )

  /* ---------------------------------------------------------------- voice */

  /** The text as it was when recording started; dictation is appended to this. */
  const voiceBase = useRef('')
  const voiceState = useRef(voice?.state)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (!voice) return
    const previous = voiceState.current
    voiceState.current = voice.state

    if (previous !== 'listening' && voice.state === 'listening') {
      voiceBase.current = valueRef.current
      return
    }
    // The session ended (finished or cancelled) — fold whatever came back into the value.
    if ((previous === 'listening' || previous === 'transcribing') && voice.state !== previous) {
      if (voice.state === 'idle') setValue(joinTranscript(voiceBase.current, voice.transcript))
    }
  }, [voice, setValue])

  const dictating = voice?.state === 'listening' || voice?.state === 'transcribing'
  /* While the mic is open the box mirrors base + live transcript. Committing every interim
   * result into state instead would make each correction an undo step. */
  const displayValue = dictating ? joinTranscript(voiceBase.current, voice.transcript) : value

  /* ----------------------------------------------------------- attachments */

  const fileInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  /* dragenter/dragleave also fire when the pointer crosses a child element, so a boolean
   * alone flickers. Counting entries and exits is the standard fix. */
  const dragDepth = useRef(0)

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!attachments || !event.dataTransfer.types.includes('Files')) return
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragLeave = () => {
    if (!attachments) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!attachments) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    attachments.add(event.dataTransfer.files)
  }

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!attachments) return
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    // Pasted screenshots arrive as files with no name; let them through as attachments
    // rather than as the empty string the default paste would insert.
    event.preventDefault()
    attachments.add(files)
  }

  /* ---------------------------------------------------------------- submit */

  const { ref } = useAutoResizeTextarea({ value: displayValue, maxRows })

  /* Quoting is always followed by typing, and the click that produced the quote left focus
   * on a button in the transcript. Seeded with the initial value so a composer that mounts
   * with a quote already set does not steal focus on load. */
  const lastQuote = useRef(quote)
  useEffect(() => {
    const previous = lastQuote.current
    lastQuote.current = quote
    if (quote && quote !== previous) ref.current?.focus()
  }, [quote, ref])

  /**
   * True between `compositionstart` and `compositionend`.
   *
   * `event.nativeEvent.isComposing` is the documented way to detect this, but it is false
   * in the `keydown` that *ends* the composition on several Windows IMEs, and Safari has
   * historically fired `compositionend` after `keydown`. Tracking the flag ourselves and
   * clearing it on the next frame covers both, at the cost of one ref.
   */
  const isComposingRef = useRef(false)

  const pendingUploads = attachments?.isProcessing ?? false
  const hasAttachments = (attachments?.attachments.length ?? 0) > 0
  const canSend =
    (value.trim().length > 0 || hasAttachments) && !disabled && !pendingUploads && !dictating

  const submit = useCallback(() => {
    const trimmed = value.trim()
    const parts = attachments?.toParts() ?? EMPTY_PARTS
    if ((!trimmed && parts.length === 0) || disabled || streaming) return
    if (attachments?.isProcessing) return

    onSubmit(trimmed, { parts, quote: quote ?? undefined })
    setValue('')
    attachments?.clear()
    // The quote belongs to the message that was just sent; leaving the strip up would
    // silently attach it to the next one as well.
    onQuoteRemove?.()
  }, [attachments, disabled, onQuoteRemove, onSubmit, quote, setValue, streaming, value])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      // Escape during composition belongs to the IME — it cancels the candidate window.
      if (isComposingRef.current || event.nativeEvent.isComposing) return
      if (!quote) return
      event.preventDefault()
      onQuoteRemove?.()
      return
    }

    if (event.key !== 'Enter') return
    // Shift+Enter is always a newline, in every locale.
    if (event.shiftKey) return
    if (isComposingRef.current || event.nativeEvent.isComposing) return
    // keyCode 229 is the legacy "processing by IME" signal, still emitted by some
    // Windows IMEs that never fire composition events at all.
    if (event.nativeEvent.keyCode === 229) return

    event.preventDefault()
    submit()
  }

  const pickFiles = (input: HTMLInputElement | null) => {
    input?.click()
  }

  const onFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    attachments?.add(event.target.files)
    // Reset so picking the same file twice in a row still fires a change event.
    event.target.value = ''
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          if (attachments && event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'relative rounded-cc-lg border bg-cc-surface shadow-cc-card',
          'transition-[border-color,box-shadow] duration-150 ease-cc',
          // The focus ring goes on the container, not the textarea, so the whole composer
          // reads as one control.
          'focus-within:border-cc-border-strong focus-within:shadow-cc-raised',
          dragging ? 'border-cc-accent' : 'border-cc-border',
          disabled && 'opacity-60',
        )}
      >
        {(hasAttachments || quote || header) && (
          <div className="flex flex-col gap-2 border-b border-cc-border px-3 py-2.5">
            {attachments && (
              <AttachmentList attachments={attachments.attachments} onRemove={attachments.remove} />
            )}
            {quote && <QuotePreview quote={quote} onRemove={onQuoteRemove} />}
            {header}
          </div>
        )}

        <textarea
          ref={ref}
          rows={1}
          value={displayValue}
          disabled={disabled}
          /* Read-only rather than disabled while dictating: the caret and the text stay
           * visible, but typing does not race the recogniser rewriting the same string. */
          readOnly={dictating}
          autoFocus={autoFocus}
          placeholder={placeholder ?? locale.inputPlaceholder}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            // Cleared on the next frame rather than synchronously: the keydown that
            // commits the candidate can still be in flight at this point.
            requestAnimationFrame(() => {
              isComposingRef.current = false
            })
          }}
          className={cn(
            'block w-full resize-none bg-transparent px-3.5 py-3',
            'text-cc-body leading-[1.6] text-cc-fg placeholder:text-cc-faint',
            'outline-none',
          )}
        />

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          {dictating && voice ? (
            <VoiceStatus voice={voice} className="min-w-0 flex-1 pl-1.5" />
          ) : (
            <div className="flex min-w-0 items-center gap-0.5">
              {attachments && (
                <ToolbarButton
                  onClick={() => pickFiles(fileInput.current)}
                  label={locale.attach}
                  disabled={disabled}
                >
                  <PaperclipIcon size={16} />
                </ToolbarButton>
              )}
              {attachments && showImageButton && (
                <ToolbarButton
                  onClick={() => pickFiles(imageInput.current)}
                  label={locale.attachImage}
                  disabled={disabled}
                >
                  <ImageIcon size={16} />
                </ToolbarButton>
              )}
              {voice && <VoiceButton voice={voice} disabled={disabled} />}
              {models && models.length > 0 && (
                <ModelSelect
                  models={models}
                  value={model}
                  defaultValue={defaultModel}
                  onChange={onModelChange}
                  disabled={disabled}
                  /* Only inset from the icons when there are icons to be inset from. */
                  className={cn('min-w-0', (attachments || voice) && 'ml-0.5')}
                />
              )}
              {toolbar}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {streaming ? (
              <StopButton onClick={() => onStop?.()} label={locale.stop} />
            ) : (
              <SendButton onClick={submit} disabled={!canSend} label={locale.send} />
            )}
          </div>
        </div>

        {attachments && (
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={attachments.accept}
              onChange={onFilesPicked}
              className="hidden"
              tabIndex={-1}
            />
            {showImageButton && (
              <input
                ref={imageInput}
                type="file"
                multiple
                accept="image/*"
                onChange={onFilesPicked}
                className="hidden"
                tabIndex={-1}
              />
            )}
          </>
        )}

        {dragging && (
          <div
            /* Pointer events off, or the overlay itself would swallow the drop and the
             * dragleave that should dismiss it. */
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center justify-center gap-2',
              'rounded-cc-lg border-2 border-dashed border-cc-accent bg-cc-canvas/85',
              'text-cc-sm font-medium text-cc-accent backdrop-blur-[1px] animate-cc-fade-in',
            )}
          >
            <UploadIcon size={16} />
            {locale.dropToAttach}
          </div>
        )}
      </div>

      {showHint && (
        <p className="mt-1.5 select-none px-1 text-cc-xs text-cc-faint">{locale.submitHint}</p>
      )}
    </div>
  )
}

function ToolbarButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-cc-sm text-cc-muted',
        'transition-colors duration-150 ease-cc hover:bg-cc-subtle hover:text-cc-fg',
        'disabled:pointer-events-none disabled:opacity-50',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
      )}
    >
      {children}
    </button>
  )
}

export function SendButton({
  onClick,
  disabled,
  label,
  className,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-cc-full',
        'bg-cc-accent text-cc-accent-fg transition-all duration-150 ease-cc',
        'hover:bg-cc-accent-hover active:scale-95',
        'disabled:pointer-events-none disabled:bg-cc-sunken disabled:text-cc-faint',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cc-surface',
        className,
      )}
    >
      <ArrowUpIcon size={16} />
    </button>
  )
}

export function StopButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-cc-full',
        'bg-cc-fg text-cc-canvas transition-transform duration-150 ease-cc active:scale-95',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-cc-surface',
        className,
      )}
    >
      <StopIcon size={13} />
    </button>
  )
}

export function AttachButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const locale = useLocale()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={locale.attach}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-cc-sm text-cc-muted',
        'transition-colors duration-150 ease-cc hover:bg-cc-subtle hover:text-cc-fg',
        'outline-none focus-visible:ring-2 focus-visible:ring-cc-accent/45',
        className,
      )}
    >
      <PaperclipIcon size={16} />
    </button>
  )
}
