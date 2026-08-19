'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type UseCopyToClipboardOptions = {
  /** How long the success state lasts, in ms. */
  resetAfter?: number
}

export type UseCopyToClipboardResult = {
  copied: boolean
  error: Error | null
  copy: (text: string) => Promise<boolean>
}

export function useCopyToClipboard(
  options: UseCopyToClipboardOptions = {},
): UseCopyToClipboardResult {
  const { resetAfter = 1800 } = options
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          // Insecure contexts and older Safari have no async clipboard API.
          legacyCopy(text)
        }
        setError(null)
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetAfter)
        return true
      } catch (rawError) {
        setError(rawError instanceof Error ? rawError : new Error(String(rawError)))
        setCopied(false)
        return false
      }
    },
    [resetAfter],
  )

  return { copied, error, copy }
}

function legacyCopy(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}
