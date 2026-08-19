import { describe, expect, it } from 'vitest'

import { isActionDescriptor, sanitizeProps, sanitizeUrl } from './sanitize'

describe('sanitizeProps', () => {
  it('passes ordinary props through untouched', () => {
    expect(sanitizeProps({ label: 'Confirm', count: 3, nested: { a: 1 } })).toEqual({
      label: 'Confirm',
      count: 3,
      nested: { a: 1 },
    })
  })

  it('drops dangerouslySetInnerHTML', () => {
    expect(sanitizeProps({ dangerouslySetInnerHTML: { __html: '<script>x</script>' } })).toEqual({})
  })

  it('drops ref and key', () => {
    expect(sanitizeProps({ ref: 'x', key: 'y', label: 'ok' })).toEqual({ label: 'ok' })
  })

  it('drops prototype-pollution keys', () => {
    const result = sanitizeProps(
      JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1, "prototype": 2, "ok": 3}'),
    )
    expect(result).toEqual({ ok: 3 })
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('drops keys starting with a double underscore', () => {
    expect(sanitizeProps({ __html: 'x', __internal: 1, fine: 2 })).toEqual({ fine: 2 })
  })

  it('drops a string handler', () => {
    // The injection this exists to stop: a component spreading props onto a DOM element.
    expect(sanitizeProps({ onClick: 'alert(1)' })).toEqual({})
  })

  it('drops a function handler', () => {
    expect(sanitizeProps({ onClick: () => undefined })).toEqual({})
  })

  it('keeps a well-formed action descriptor', () => {
    const descriptor = { action: 'confirm', payload: { id: 42 } }
    expect(sanitizeProps({ onClick: descriptor })).toEqual({ onClick: descriptor })
  })

  it('drops an object handler with no action string', () => {
    expect(sanitizeProps({ onSubmit: { payload: 1 } })).toEqual({})
  })

  it('leaves non-handler props starting with "on" alone', () => {
    // `once` and `online` must not be caught by the `on[A-Z]` rule.
    expect(sanitizeProps({ once: true, online: 'yes' })).toEqual({ once: true, online: 'yes' })
  })

  it('strips a javascript: href', () => {
    expect(sanitizeProps({ href: 'javascript:alert(1)' })).toEqual({})
  })

  it('strips a src with an obfuscated scheme', () => {
    expect(sanitizeProps({ src: 'java\nscript:alert(1)' })).toEqual({})
  })

  it('keeps a safe href', () => {
    expect(sanitizeProps({ href: 'https://example.com' })).toEqual({ href: 'https://example.com' })
  })
})

describe('sanitizeUrl', () => {
  it.each([
    'https://example.com',
    'http://example.com/a?b=1',
    'mailto:a@b.com',
    'tel:+1234',
    '/relative',
    './sibling',
    '../parent',
    '#anchor',
  ])('allows %s', (url) => {
    expect(sanitizeUrl(url)).toBe(url)
  })

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox',
    'file:///etc/passwd',
  ])('rejects %s', (url) => {
    expect(sanitizeUrl(url)).toBeUndefined()
  })

  it('rejects a scheme hidden behind control characters', () => {
    // Browsers strip these themselves, which makes a naive prefix test bypassable.
    expect(sanitizeUrl('java\tscript:alert(1)')).toBeUndefined()
    expect(sanitizeUrl(' javascript:alert(1)')).toBeUndefined()
  })

  it('allows a base64 image data URL', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeUrl(url)).toBe(url)
  })

  it('rejects an SVG data URL that is not base64', () => {
    expect(sanitizeUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBeUndefined()
  })

  it('rejects non-strings', () => {
    expect(sanitizeUrl(42)).toBeUndefined()
    expect(sanitizeUrl(null)).toBeUndefined()
    expect(sanitizeUrl(undefined)).toBeUndefined()
  })
})

describe('isActionDescriptor', () => {
  it('accepts an object with a string action', () => {
    expect(isActionDescriptor({ action: 'go' })).toBe(true)
  })

  it.each([[null], [undefined], ['go'], [42], [['go']], [{ action: 1 }], [{}]])(
    'rejects %s',
    (value) => {
      expect(isActionDescriptor(value)).toBe(false)
    },
  )
})
