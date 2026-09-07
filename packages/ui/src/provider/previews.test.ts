import { describe, expect, it } from 'vitest'

import { definePreview, resolvePreview, type PreviewRegistry } from './previews'

/** The component is never rendered here; only which definition comes back matters. */
const render = () => null

function preview(fields: Partial<Parameters<typeof definePreview>[0]>) {
  return definePreview({ render, ...fields })
}

const builtin: PreviewRegistry = {
  markdown: preview({ extensions: ['md'], mediaTypes: ['text/markdown'] }),
  image: preview({ extensions: ['png'], mediaTypes: ['image/*'] }),
  text: preview({ extensions: ['txt'] }),
}

describe('resolvePreview', () => {
  it('matches on extension', () => {
    expect(resolvePreview({ name: 'notes.md' }, {}, builtin)).toBe(builtin.markdown)
  })

  it('matches case-insensitively and ignores query strings', () => {
    expect(resolvePreview({ name: 'NOTES.MD?v=2' }, {}, builtin)).toBe(builtin.markdown)
  })

  it('prefers an exact media type over the extension', () => {
    const host: PreviewRegistry = {
      byMedia: preview({ mediaTypes: ['text/markdown'] }),
      byExtension: preview({ extensions: ['md'] }),
    }
    expect(resolvePreview({ name: 'a.md', mediaType: 'text/markdown' }, host, {})).toBe(
      host.byMedia,
    )
  })

  it('normalizes media type parameters and case', () => {
    expect(
      resolvePreview({ name: 'blob', mediaType: 'Text/Markdown; charset=utf-8' }, {}, builtin),
    ).toBe(builtin.markdown)
  })

  it('falls back to a wildcard media type only after extensions', () => {
    const host: PreviewRegistry = {
      wildcard: preview({ mediaTypes: ['image/*'] }),
      exact: preview({ extensions: ['webp'] }),
    }
    expect(resolvePreview({ name: 'a.webp', mediaType: 'image/webp' }, host, {})).toBe(host.exact)
    expect(resolvePreview({ name: 'a.avif', mediaType: 'image/avif' }, host, {})).toBe(
      host.wildcard,
    )
  })

  /* The contract that makes requirement 1 a one-liner: a host entry wins without the host
   * having to remove ours first. */
  it('lets a host entry override a built-in for the same extension', () => {
    const host: PreviewRegistry = { md: preview({ extensions: ['md'] }) }
    expect(resolvePreview({ name: 'a.md' }, host, builtin)).toBe(host.md)
  })

  it('lets a host extension beat a built-in exact media type', () => {
    const host: PreviewRegistry = { mine: preview({ extensions: ['md'] }) }
    expect(resolvePreview({ name: 'a.md', mediaType: 'text/markdown' }, host, builtin)).toBe(
      host.mine,
    )
  })

  it('lets a host wildcard beat a built-in extension match', () => {
    const host: PreviewRegistry = { anyImage: preview({ mediaTypes: ['image/*'] }) }
    expect(resolvePreview({ name: 'a.png', mediaType: 'image/png' }, host, builtin)).toBe(
      host.anyImage,
    )
  })

  it('falls through to the built-ins when the host claims nothing', () => {
    const host: PreviewRegistry = { pdf: preview({ extensions: ['pdf'] }) }
    expect(resolvePreview({ name: 'a.txt' }, host, builtin)).toBe(builtin.text)
  })

  it('returns undefined for a type nobody claims', () => {
    expect(resolvePreview({ name: 'design.psd' }, {}, builtin)).toBeUndefined()
    expect(resolvePreview({ name: 'LICENSE' }, {}, builtin)).toBeUndefined()
  })

  it('does not treat an unknown media type as a wildcard match', () => {
    expect(
      resolvePreview({ name: 'a.bin', mediaType: 'application/octet-stream' }, {}, builtin),
    ).toBeUndefined()
  })
})
