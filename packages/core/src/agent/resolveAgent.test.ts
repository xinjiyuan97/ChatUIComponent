import { describe, expect, it } from 'vitest'

import { resolveAgent } from './resolveAgent'

describe('resolveAgent', () => {
  const agents = [{ id: 'a', name: 'Alpha', metadata: { model: 'fast' } }]

  it('resolves an agent and its optional model label', () => {
    expect(resolveAgent('a', agents)).toEqual({
      found: true,
      id: 'a',
      name: 'Alpha',
      model: 'fast',
    })
  })

  it('returns a neutral result for missing or unknown ids', () => {
    expect(resolveAgent(undefined, agents)).toEqual({ found: false })
    expect(resolveAgent('missing', agents)).toEqual({ found: false })
  })
})
