'use client'

import {
  defaultMaxBytes,
  useFileContent,
  type FileContentAs,
  type FileContentData,
  type PreviewFile,
} from '@xinjiyuan97/chat-core'
import { useState, type ReactNode } from 'react'

import { SpinnerIcon } from '../icons'
import { useLocale } from '../provider/ChatThemeProvider'
import { UnsupportedPreview } from './UnsupportedPreview'

export type PreviewLoaderProps<K extends FileContentAs> = {
  file: PreviewFile
  as: K
  maxBytes?: number
  children: (data: FileContentData[K]) => ReactNode
}

/**
 * Fetches a file's bytes and renders the loading and failure states, so a viewer only has
 * to write the part that draws the document.
 *
 * Every failure lands on `UnsupportedPreview` with its actual reason rather than on a
 * generic message, and the retry re-mounts the whole thing by bumping a key — which is the
 * simplest correct retry, because it also throws away whatever half-parsed state the viewer
 * had built before it gave up.
 */
export function PreviewLoader<K extends FileContentAs>({
  file,
  as,
  maxBytes,
  children,
}: PreviewLoaderProps<K>) {
  const [attempt, setAttempt] = useState(0)
  return (
    <PreviewLoaderAttempt
      key={attempt}
      file={file}
      as={as}
      maxBytes={maxBytes}
      onRetry={() => setAttempt((value) => value + 1)}
    >
      {children}
    </PreviewLoaderAttempt>
  )
}

function PreviewLoaderAttempt<K extends FileContentAs>({
  file,
  as,
  maxBytes,
  onRetry,
  children,
}: PreviewLoaderProps<K> & { onRetry: () => void }) {
  const locale = useLocale()
  const state = useFileContent(file, { as, maxBytes })
  const cap = maxBytes ?? defaultMaxBytes(as)

  if (state.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-cc-sm text-cc-faint">
        <SpinnerIcon size={14} />
        {locale.previewLoading}
      </div>
    )
  }

  if (state.status === 'empty' || state.status === 'error') {
    /* "Nothing to fetch" is reported as a fetch failure on purpose: the type *is*
     * supported, so `unsupported-type` would send the reader looking for a renderer that
     * is already here. What is missing are the bytes. */
    const reason = state.status === 'empty' ? 'fetch-failed' : state.reason
    return (
      <UnsupportedPreview
        file={file}
        reason={reason}
        detail={state.status === 'error' ? state.message : undefined}
        maxBytes={cap}
        onRetry={onRetry}
      />
    )
  }

  return <>{children(state.data)}</>
}
