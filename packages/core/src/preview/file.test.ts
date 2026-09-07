import { describe, expect, it } from 'vitest'

import { classifyFile, fileExtension, normalizeMediaType } from './file'

describe('fileExtension', () => {
  it('lower-cases and drops the dot', () => {
    expect(fileExtension('Report.PDF')).toBe('pdf')
  })

  it('takes only the last segment of a compound extension', () => {
    expect(fileExtension('archive.tar.gz')).toBe('gz')
  })

  it('ignores directories in the path', () => {
    expect(fileExtension('src/components/Button.tsx')).toBe('tsx')
    expect(fileExtension('C:\\docs\\notes.txt')).toBe('txt')
  })

  it('strips a query string, since names are often the tail of a URL', () => {
    expect(fileExtension('logo.svg?v=2')).toBe('svg')
    expect(fileExtension('page.html#top')).toBe('html')
  })

  it('treats a leading dot as a hidden file, not an extension', () => {
    expect(fileExtension('.gitignore')).toBe('')
  })

  it('returns empty for a name with no extension', () => {
    expect(fileExtension('Makefile')).toBe('')
    expect(fileExtension('')).toBe('')
  })
})

describe('normalizeMediaType', () => {
  it('drops parameters and case', () => {
    expect(normalizeMediaType('Text/HTML; charset=utf-8')).toBe('text/html')
  })

  it('is empty for undefined', () => {
    expect(normalizeMediaType(undefined)).toBe('')
  })
})

describe('classifyFile', () => {
  it('classifies by extension', () => {
    expect(classifyFile({ name: 'a.pdf' })).toBe('pdf')
    expect(classifyFile({ name: 'a.docx' })).toBe('word')
    expect(classifyFile({ name: 'a.xlsx' })).toBe('excel')
    expect(classifyFile({ name: 'a.pptx' })).toBe('ppt')
    expect(classifyFile({ name: 'a.md' })).toBe('markdown')
    expect(classifyFile({ name: 'a.png' })).toBe('image')
  })

  it('prefers the media type over the extension', () => {
    // A server that bothered to label its response knows more than a model-chosen name.
    expect(classifyFile({ name: 'download.bin', mediaType: 'application/pdf' })).toBe('pdf')
    expect(classifyFile({ name: 'a.png', mediaType: 'text/plain' })).toBe('text')
  })

  it('falls back to media type families', () => {
    expect(classifyFile({ name: 'x', mediaType: 'image/heic' })).toBe('image')
    expect(classifyFile({ name: 'x', mediaType: 'text/x-lua' })).toBe('text')
    expect(classifyFile({ name: 'x', mediaType: 'audio/ogg' })).toBe('audio')
  })

  it('does not guess text for an unknown extension', () => {
    // Guessing here would hand a 40MB binary to a syntax highlighter.
    expect(classifyFile({ name: 'core.dump' })).toBe('unknown')
    expect(classifyFile({ name: 'Makefile' })).toBe('unknown')
  })
})
