'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { generateId } from '../id'
import type { FilePart } from '../types'

export type AttachmentStatus = 'pending' | 'ready' | 'error'

export type Attachment = {
  id: string
  name: string
  size: number
  mediaType: string
  status: AttachmentStatus
  /**
   * Local `blob:` URL, for thumbnails. Kept separate from `url` because it is only valid
   * in this document — putting it in a message part would produce a link that breaks the
   * moment the tab closes.
   */
  previewUrl?: string
  /** What the model will see: a `data:` URL (inline mode) or whatever `onUpload` returned. */
  url?: string
  error?: string
  /**
   * The original handle, in case the host needs to upload it a second way. Optional so a
   * list restored from a saved draft can be rendered without inventing a `File`.
   */
  file?: File
}

export type UseAttachmentsOptions = {
  /** `<input accept>` syntax: `image/*,application/pdf,.csv`. Also enforced on drop and paste. */
  accept?: string
  /** Per-file ceiling in bytes. Default 10 MB. */
  maxSize?: number
  maxFiles?: number
  /**
   * Upload seam. Return the URL the model should receive.
   *
   * Omit it and files are inlined as `data:` URLs, which needs no backend but puts the
   * whole payload in the request body — fine for screenshots, not for a 40 MB video.
   */
  onUpload?: (file: File, context: { signal: AbortSignal }) => Promise<string>
  onError?: (message: string, file: File) => void
}

export type AttachmentController = {
  attachments: Attachment[]
  /** Accepts a `FileList`, an array, or anything iterable of `File`. */
  add: (files: Iterable<File> | FileList | null | undefined) => void
  remove: (id: string) => void
  clear: () => void
  /** True while anything is still reading or uploading. Block submit on this. */
  isProcessing: boolean
  /** Ready attachments as message parts. Ones that failed or are still working are skipped. */
  toParts: () => FilePart[]
  /** Returns an error message, or `null` when the file is acceptable. */
  validate: (file: File) => string | null
  accept?: string
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024
const DEFAULT_MAX_FILES = 10

/** Matches one `accept` token — `image/*`, `text/csv`, or `.csv` — against a file. */
function matchesToken(file: File, token: string): boolean {
  const rule = token.trim().toLowerCase()
  if (!rule) return false
  if (rule === '*' || rule === '*/*') return true

  if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)

  const type = (file.type || '').toLowerCase()
  if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
  return type === rule
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

/**
 * Attachment state for the composer.
 *
 * Headless on purpose: it owns validation, the object-URL lifecycle and the upload race,
 * and hands back plain data. `PromptInput` renders it, but so can anything else.
 */
export function useAttachments(options: UseAttachmentsOptions = {}): AttachmentController {
  const {
    accept,
    maxSize = DEFAULT_MAX_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    onUpload,
    onError,
  } = options

  const [attachments, setAttachments] = useState<Attachment[]>([])

  /* Options are read inside async work that outlives the render that scheduled it, so they
   * go through a ref. Capturing them directly would pin an upload to a stale `onUpload`. */
  const latest = useRef({ onUpload, onError })
  latest.current = { onUpload, onError }

  /* Mirrors the state so `add` can check the count without reading it inside the updater —
   * updaters must be pure, and React calls them twice under StrictMode. Creating object
   * URLs or kicking off uploads in there would do all of it twice. */
  const listRef = useRef(attachments)
  listRef.current = attachments

  /** One controller per attachment, so removing one file does not abort the others. */
  const aborts = useRef(new Map<string, AbortController>())
  /* Object URLs are process-global; without this the composer leaks one per preview. */
  const objectUrls = useRef(new Set<string>())

  useEffect(() => {
    const urls = objectUrls.current
    const controllers = aborts.current
    return () => {
      for (const controller of controllers.values()) controller.abort()
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
      controllers.clear()
    }
  }, [])

  const validate = useCallback(
    (file: File): string | null => {
      if (maxSize > 0 && file.size > maxSize) return 'too-large'
      if (!accept) return null
      const tokens = accept.split(',')
      return tokens.some((token) => matchesToken(file, token)) ? null : 'wrong-type'
    },
    [accept, maxSize],
  )

  const finish = useCallback((id: string, patch: Partial<Attachment>) => {
    setAttachments((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }, [])

  const add = useCallback(
    (files: Iterable<File> | FileList | null | undefined) => {
      if (!files) return
      const incoming = Array.from(files as Iterable<File>)
      if (incoming.length === 0) return

      /* Entry and file are carried together: `Attachment.file` is optional for consumers,
       * but the upload loop below always has one and should not have to prove it. */
      const accepted: Array<{ entry: Attachment; file: File }> = []
      let room = Math.max(0, maxFiles - listRef.current.length)

      for (const file of incoming) {
        if (room === 0) {
          latest.current.onError?.('too-many', file)
          continue
        }

        const problem = validate(file)
        if (problem) {
          latest.current.onError?.(problem, file)
          continue
        }
        room -= 1

        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        if (previewUrl) objectUrls.current.add(previewUrl)

        accepted.push({
          entry: {
            id: generateId('file'),
            name: file.name,
            size: file.size,
            mediaType: file.type || 'application/octet-stream',
            status: 'pending',
            previewUrl,
            file,
          },
          file,
        })
      }

      if (accepted.length === 0) return
      listRef.current = [...listRef.current, ...accepted.map((item) => item.entry)]
      setAttachments(listRef.current)

      for (const { entry, file } of accepted) {
        const controller = new AbortController()
        aborts.current.set(entry.id, controller)

        const work = latest.current.onUpload
          ? latest.current.onUpload(file, { signal: controller.signal })
          : readAsDataURL(file)

        void work
          .then((url) => {
            // Removed while in flight — the entry is gone, and writing to it would
            // resurrect a row the user already dismissed.
            if (controller.signal.aborted) return
            finish(entry.id, { status: 'ready', url })
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            const message = error instanceof Error ? error.message : String(error)
            finish(entry.id, { status: 'error', error: message })
            latest.current.onError?.(message, file)
          })
          .finally(() => {
            aborts.current.delete(entry.id)
          })
      }
    },
    [finish, maxFiles, validate],
  )

  const remove = useCallback((id: string) => {
    aborts.current.get(id)?.abort()
    aborts.current.delete(id)

    const target = listRef.current.find((item) => item.id === id)
    if (!target) return
    if (target.previewUrl) {
      URL.revokeObjectURL(target.previewUrl)
      objectUrls.current.delete(target.previewUrl)
    }

    listRef.current = listRef.current.filter((item) => item.id !== id)
    setAttachments(listRef.current)
  }, [])

  const clear = useCallback(() => {
    for (const controller of aborts.current.values()) controller.abort()
    aborts.current.clear()

    if (listRef.current.length === 0) return
    for (const item of listRef.current) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
        objectUrls.current.delete(item.previewUrl)
      }
    }

    listRef.current = []
    setAttachments(listRef.current)
  }, [])

  const toParts = useCallback((): FilePart[] => {
    const parts: FilePart[] = []
    for (const item of attachments) {
      if (item.status !== 'ready' || !item.url) continue
      parts.push({
        type: 'file',
        url: item.url,
        mediaType: item.mediaType,
        name: item.name,
        size: item.size,
      })
    }
    return parts
  }, [attachments])

  return {
    attachments,
    add,
    remove,
    clear,
    isProcessing: attachments.some((item) => item.status === 'pending'),
    toParts,
    validate,
    accept,
  }
}
