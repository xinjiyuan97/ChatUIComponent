import type { SourcePart } from '@agent-chat/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { Cited, CitationProvider } from './Citation'

const SOURCES: SourcePart[] = [
  { type: 'source', url: 'https://example.com/a', title: 'RFC 6749' },
  { type: 'source', url: 'https://example.com/b', title: 'OWASP' },
]

function setup(children: ReactNode, sources: SourcePart[] = SOURCES) {
  return render(
    <CitationProvider sources={sources}>
      <p>
        <Cited>{children}</Cited>
      </p>
    </CitationProvider>,
  )
}

/** The rendered markers, in document order. */
function markers(): string[] {
  return screen.queryAllByRole('button').map((button) => button.textContent ?? '')
}

describe('Cited', () => {
  it('turns a marker into a button and keeps the surrounding text', () => {
    const { container } = setup('Tokens expire [1] by default.')
    expect(markers()).toEqual(['1'])
    expect(container.textContent).toBe('Tokens expire 1 by default.')
  })

  it('splits a grouped marker into one button per source', () => {
    setup('Both agree [1, 2] on this.')
    expect(markers()).toEqual(['1', '2'])
  })

  it('accepts the footnote form', () => {
    setup('As noted [^2].')
    expect(markers()).toEqual(['2'])
  })

  it('leaves an out-of-range number as prose', () => {
    const { container } = setup('See section [9] for details.')
    expect(markers()).toEqual([])
    expect(container.textContent).toBe('See section [9] for details.')
  })

  it('drops only the out-of-range members of a group', () => {
    setup('Mixed [2, 9] group.')
    expect(markers()).toEqual(['2'])
  })

  it('is the identity when the message cites nothing', () => {
    const { container } = setup('Still literal [1].', [])
    expect(markers()).toEqual([])
    expect(container.textContent).toBe('Still literal [1].')
  })

  it('is the identity outside a provider', () => {
    const { container } = render(<Cited>{'Still literal [1].'}</Cited>)
    expect(markers()).toEqual([])
    expect(container.textContent).toBe('Still literal [1].')
  })

  // Descending into elements would rewrite `tokens[1]` inside an inline code span, where
  // the brackets are code rather than a citation.
  it('does not rewrite text nested in an element', () => {
    setup(<code>{'tokens[1]'}</code>)
    expect(markers()).toEqual([])
  })

  it('walks the string children of an array', () => {
    setup(['Leading [1] text ', <em key="e">emphasis</em>, ' and [2].'])
    expect(markers()).toEqual(['1', '2'])
  })

  it('names the source it points at', () => {
    setup('Per the spec [1].')
    expect(screen.getByRole('button')).toHaveAccessibleName('来源 1: RFC 6749')
  })

  it('marks the clicked marker as the active one', () => {
    setup('Compare [1] with [2].')
    const first = screen.getByRole('button', { name: '来源 1: RFC 6749' })
    const second = screen.getByRole('button', { name: '来源 2: OWASP' })

    fireEvent.click(second)

    // `bg-cc-accent` is the filled, active state; the idle one is `bg-cc-subtle`.
    expect(second).toHaveClass('bg-cc-accent')
    expect(first).not.toHaveClass('bg-cc-accent')
  })
})
