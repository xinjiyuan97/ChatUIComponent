import { describe, expect, it } from 'vitest'

import { completeMarkdown, splitMarkdownBlocks } from './complete-markdown'

describe('completeMarkdown', () => {
  it('leaves empty input alone', () => {
    expect(completeMarkdown('')).toBe('')
  })

  it('closes an unterminated fence', () => {
    expect(completeMarkdown('```ts\nconst a = 1')).toBe('```ts\nconst a = 1\n```')
  })

  it('does not double-close a terminated fence', () => {
    const text = '```ts\nconst a = 1\n```'
    expect(completeMarkdown(text)).toBe(text)
  })

  it('matches the fence length that opened the block', () => {
    expect(completeMarkdown('````\n```\ninner')).toBe('````\n```\ninner\n````')
  })

  it('preserves the opening fence indentation', () => {
    expect(completeMarkdown('  ```\ncode')).toBe('  ```\ncode\n  ```')
  })

  it('supports tilde fences', () => {
    expect(completeMarkdown('~~~py\nx = 1')).toBe('~~~py\nx = 1\n~~~')
  })

  it('does not add a blank line when the text already ends with one', () => {
    expect(completeMarkdown('```\ncode\n')).toBe('```\ncode\n```')
  })

  it('closes an open inline code span', () => {
    expect(completeMarkdown('call `useChat')).toBe('call `useChat`')
  })

  it('closes open bold', () => {
    expect(completeMarkdown('this is **important')).toBe('this is **important**')
  })

  it('closes open italic', () => {
    expect(completeMarkdown('a *word')).toBe('a *word*')
  })

  it('closes open strikethrough', () => {
    expect(completeMarkdown('~~gone')).toBe('~~gone~~')
  })

  it('leaves balanced emphasis alone', () => {
    expect(completeMarkdown('this is **done** already')).toBe('this is **done** already')
  })

  it('does not treat arithmetic asterisks as emphasis', () => {
    // The case an odd-count parity check gets wrong: three asterisks, zero emphasis.
    expect(completeMarkdown('2 * 3 * 4 * 5')).toBe('2 * 3 * 4 * 5')
  })

  it('ignores a trailing asterisk that cannot open', () => {
    expect(completeMarkdown('a footnote *')).toBe('a footnote *')
  })

  it('ignores asterisks inside an inline code span', () => {
    expect(completeMarkdown('use `a * b` here')).toBe('use `a * b` here')
  })

  it('ignores escaped markers', () => {
    expect(completeMarkdown('literal \\*asterisk')).toBe('literal \\*asterisk')
  })

  it('does not read `***` as `**` plus `*`', () => {
    expect(completeMarkdown('***loud')).toBe('***loud***')
  })

  it('closes a half-written link destination', () => {
    expect(completeMarkdown('see [the docs](https://exa')).toBe('see [the docs](https://exa)')
  })

  it('leaves a complete link alone', () => {
    const text = 'see [the docs](https://example.com) now'
    expect(completeMarkdown(text)).toBe(text)
  })

  it('only closes the fence when inside one, ignoring inline markers', () => {
    // Inside code, `**` is literal — appending a partner would corrupt the source.
    expect(completeMarkdown('```\nx **y')).toBe('```\nx **y\n```')
  })

  it('skips inline repair when inline is false', () => {
    expect(completeMarkdown('unfinished **bold', { inline: false })).toBe('unfinished **bold')
  })

  it('still closes a fence when inline is false', () => {
    expect(completeMarkdown('```\ncode', { inline: false })).toBe('```\ncode\n```')
  })

  it('handles a fence opened immediately after a closed one', () => {
    expect(completeMarkdown('```\na\n```\n```\nb')).toBe('```\na\n```\n```\nb\n```')
  })
})

describe('splitMarkdownBlocks', () => {
  it('splits paragraphs on blank lines', () => {
    expect(splitMarkdownBlocks('first\n\nsecond')).toEqual(['first', 'second'])
  })

  it('drops runs of blank lines', () => {
    expect(splitMarkdownBlocks('a\n\n\n\nb')).toEqual(['a', 'b'])
  })

  it('keeps a fenced block whole even when it contains blank lines', () => {
    const text = '```ts\nconst a = 1\n\nconst b = 2\n```'
    expect(splitMarkdownBlocks(text)).toEqual([text])
  })

  it('separates a fence from surrounding prose', () => {
    expect(splitMarkdownBlocks('intro\n```\ncode\n```\noutro')).toEqual([
      'intro',
      '```\ncode\n```',
      'outro',
    ])
  })

  it('keeps a loose ordered list in one block', () => {
    // Splitting here would restart numbering at 1. for every item.
    const text = '1. one\n\n2. two\n\n3. three'
    expect(splitMarkdownBlocks(text)).toEqual([text])
  })

  it('keeps a loose bullet list in one block', () => {
    expect(splitMarkdownBlocks('- a\n\n- b')).toEqual(['- a\n\n- b'])
  })

  it('keeps an indented list continuation with its list', () => {
    expect(splitMarkdownBlocks('- item\n\n  continued')).toEqual(['- item\n\n  continued'])
  })

  it('ends a list when a paragraph follows', () => {
    expect(splitMarkdownBlocks('- a\n- b\n\nAfter the list.')).toEqual([
      '- a\n- b',
      'After the list.',
    ])
  })

  it('keeps a block quote broken by a blank line together', () => {
    expect(splitMarkdownBlocks('> one\n\n> two')).toEqual(['> one\n\n> two'])
  })

  it('returns an empty array for whitespace-only input', () => {
    expect(splitMarkdownBlocks('\n\n   \n')).toEqual([])
  })

  it('handles an unterminated fence at the end of a stream', () => {
    expect(splitMarkdownBlocks('intro\n```ts\nconst a =')).toEqual(['intro', '```ts\nconst a ='])
  })

  it('round-trips the content it splits', () => {
    const text = 'para one\n\n```js\nlet x\n```\n\n- a\n- b\n\npara two'
    expect(splitMarkdownBlocks(text).join('\n\n')).toBe(text)
  })
})
