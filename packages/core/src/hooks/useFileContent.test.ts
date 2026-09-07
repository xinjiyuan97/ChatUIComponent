import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useFileContent } from './useFileContent'
import type { PreviewFile } from '../preview/file'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useFileContent', () => {
  it('is empty when the file has no source at all', async () => {
    const { result } = renderHook(() => useFileContent({ name: 'a.txt' }, { as: 'text' }))

    // A name-only file is legitimate input — it belongs on the fallback page, not a spinner.
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('is empty when no file is given', async () => {
    const { result } = renderHook(() => useFileContent(undefined, { as: 'text' }))

    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('reads inline string content', async () => {
    const file: PreviewFile = { name: 'a.txt', content: 'hello' }
    const { result } = renderHook(() => useFileContent(file, { as: 'text' }))

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'hello' }))
  })

  it('decodes an inline ArrayBuffer as text', async () => {
    const buffer = new TextEncoder().encode('hi').buffer
    const file: PreviewFile = { name: 'a.txt', content: buffer as ArrayBuffer }
    const { result } = renderHook(() => useFileContent(file, { as: 'text' }))

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'hi' }))
  })

  it('fetches a url', async () => {
    const fetchMock = vi.fn(async () => new Response('remote'))
    vi.stubGlobal('fetch', fetchMock)

    const file: PreviewFile = { name: 'a.txt', url: 'https://example.test/a.txt' }
    const { result } = renderHook(() => useFileContent(file, { as: 'text' }))

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: 'remote' }))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reports a non-ok response as fetch-failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))

    const file: PreviewFile = { name: 'a.txt', url: 'https://example.test/a.txt' }
    const { result } = renderHook(() => useFileContent(file, { as: 'text' }))

    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'error',
        reason: 'fetch-failed',
        message: 'HTTP 404',
      }),
    )
  })

  it('reports a rejected load as fetch-failed', async () => {
    const file: PreviewFile = { name: 'a.txt', load: async () => Promise.reject(new Error('gone')) }
    const { result } = renderHook(() => useFileContent(file, { as: 'text' }))

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'error', reason: 'fetch-failed', message: 'gone' }),
    )
  })

  it('refuses an over-large file before requesting it', async () => {
    const fetchMock = vi.fn(async () => new Response('x'))
    vi.stubGlobal('fetch', fetchMock)

    const file: PreviewFile = { name: 'big.bin', url: 'https://example.test/big', size: 10_000 }
    const { result } = renderHook(() => useFileContent(file, { as: 'text', maxBytes: 100 }))

    await waitFor(() => expect(result.current).toEqual({ status: 'error', reason: 'too-large' }))
    // The point of checking `size` first: nothing was downloaded.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses an over-large file that lied about its size', async () => {
    const file: PreviewFile = { name: 'big.txt', content: 'x'.repeat(200), size: 1 }
    const { result } = renderHook(() => useFileContent(file, { as: 'text', maxBytes: 100 }))

    await waitFor(() => expect(result.current).toEqual({ status: 'error', reason: 'too-large' }))
  })

  it('honours maxBytes: 0 as no cap', async () => {
    const file: PreviewFile = { name: 'big.txt', content: 'x'.repeat(200), size: 10_000_000 }
    const { result } = renderHook(() => useFileContent(file, { as: 'text', maxBytes: 0 }))

    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('aborts the previous request when the file changes', async () => {
    const signals: AbortSignal[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal)
        return new Response('ok')
      }),
    )

    const { rerender } = renderHook(({ file }) => useFileContent(file, { as: 'text' }), {
      initialProps: { file: { name: 'a.txt', url: 'https://example.test/a' } as PreviewFile },
    })

    rerender({ file: { name: 'b.txt', url: 'https://example.test/b' } as PreviewFile })

    await waitFor(() => expect(signals).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  it('does not refetch when the host rebuilds an equivalent file object', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)

    const { rerender, result } = renderHook(({ file }) => useFileContent(file, { as: 'text' }), {
      initialProps: { file: { name: 'a.txt', url: 'https://example.test/a' } as PreviewFile },
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    rerender({ file: { name: 'a.txt', url: 'https://example.test/a' } as PreviewFile })

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
