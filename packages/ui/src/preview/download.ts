import type { PreviewFile } from '@xinjiyuan97/chat-core'

/**
 * Saves a preview's file, from whichever source it has.
 *
 * `<a download>` is ignored cross-origin — the browser navigates to the URL instead — so
 * for a remote file this is a best effort that degrades to opening it. Inline content goes
 * through an object URL, where `download` is always honoured because the blob is same-origin.
 *
 * Returns false when there is nothing to save, so a caller can hide the button.
 */
export function downloadFile(file: PreviewFile): boolean {
  if (typeof document === 'undefined') return false

  if (file.content !== undefined) {
    const blob =
      typeof file.content === 'string'
        ? new Blob([file.content], { type: file.mediaType ?? 'text/plain' })
        : file.content instanceof Blob
          ? file.content
          : new Blob([file.content], { type: file.mediaType ?? 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    click(url, file.name)
    // Revoked on the next task: revoking synchronously races the click on some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  }

  if (file.url) {
    click(file.url, file.name)
    return true
  }

  return false
}

/** True when `downloadFile` would do something, for deciding whether to show the button. */
export function canDownload(file: PreviewFile): boolean {
  return file.content !== undefined || Boolean(file.url)
}

function click(href: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = name
  anchor.rel = 'noopener'
  anchor.click()
}
