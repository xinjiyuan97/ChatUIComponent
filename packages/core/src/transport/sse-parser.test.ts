import { describe, expect, it } from 'vitest'

import { createSSEDecoder } from './sse-parser'

const encode = (text: string) => new TextEncoder().encode(text)

describe('createSSEDecoder', () => {
  it('parses a simple event', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data: hello\n\n')).toEqual([
      { event: undefined, data: 'hello', id: undefined, retry: undefined },
    ])
  })

  it('reassembles a line split across chunks', () => {
    const decoder = createSSEDecoder()
    // The whole point of the decoder: TCP splits wherever it likes.
    expect(decoder.push('data: hel')).toEqual([])
    expect(decoder.push('lo world\n\n')).toEqual([expect.objectContaining({ data: 'hello world' })])
  })

  it('reassembles an event split mid-terminator', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data: one\n')).toEqual([])
    expect(decoder.push('\ndata: two\n\n')).toEqual([
      expect.objectContaining({ data: 'one' }),
      expect.objectContaining({ data: 'two' }),
    ])
  })

  it('joins multiple data lines with a newline', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data: line1\ndata: line2\n\n')).toEqual([
      expect.objectContaining({ data: 'line1\nline2' }),
    ])
  })

  it('keeps the event name and id', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('event: ping\nid: 42\ndata: {}\n\n')).toEqual([
      { event: 'ping', data: '{}', id: '42', retry: undefined },
    ])
  })

  it('strips exactly one leading space after the colon', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data:  padded\n\n')).toEqual([
      expect.objectContaining({ data: ' padded' }),
    ])
  })

  it('ignores comments and heartbeats', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push(': keep-alive\n\ndata: real\n\n')).toEqual([
      expect.objectContaining({ data: 'real' }),
    ])
  })

  it('normalises CRLF line endings', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data: crlf\r\n\r\n')).toEqual([expect.objectContaining({ data: 'crlf' })])
  })

  it('handles a multi-byte character split across chunks', () => {
    const decoder = createSSEDecoder()
    const bytes = encode('data: 思考\n\n')
    // Split inside the UTF-8 encoding of 思, which is where a naive decoder emits U+FFFD.
    expect(decoder.push(bytes.slice(0, 8))).toEqual([])
    expect(decoder.push(bytes.slice(8))).toEqual([expect.objectContaining({ data: '思考' })])
  })

  it('emits a trailing event with no blank line on flush', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data: trailing')).toEqual([])
    expect(decoder.flush()).toEqual([expect.objectContaining({ data: 'trailing' })])
  })

  it('does not dispatch an event that has no data lines', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('event: lonely\n\n')).toEqual([])
  })

  it('preserves an empty data line', () => {
    const decoder = createSSEDecoder()
    expect(decoder.push('data:\n\n')).toEqual([expect.objectContaining({ data: '' })])
  })
})
