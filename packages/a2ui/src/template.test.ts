import { describe, expect, it } from 'vitest'

import { evaluateCondition, getPath, resolveTemplate } from './template'

const data = {
  user: { name: 'Ada', isAdmin: true, age: 36 },
  items: [{ label: 'first' }, { label: 'second' }],
  empty: [],
  zero: 0,
  nothing: null,
  status: 'pending',
}

describe('getPath', () => {
  it('reads a nested property', () => {
    expect(getPath(data, 'user.name')).toBe('Ada')
  })

  it('reads an array index', () => {
    expect(getPath(data, 'items.1.label')).toBe('second')
  })

  it('returns undefined for a missing path', () => {
    expect(getPath(data, 'user.email')).toBeUndefined()
    expect(getPath(data, 'nothing.deeper')).toBeUndefined()
  })

  it('refuses prototype keys', () => {
    expect(getPath(data, '__proto__')).toBeUndefined()
    expect(getPath(data, 'user.constructor.name')).toBeUndefined()
  })

  it('refuses inherited properties', () => {
    // Only own properties, so `toString` and friends are never reachable.
    expect(getPath(data, 'user.toString')).toBeUndefined()
    expect(getPath(data, 'user.hasOwnProperty')).toBeUndefined()
  })

  it('refuses a non-integer array index', () => {
    expect(getPath(data, 'items.length')).toBeUndefined()
  })
})

describe('resolveTemplate', () => {
  it('substitutes a template inside a sentence', () => {
    expect(resolveTemplate('Hello {{user.name}}!', data)).toBe('Hello Ada!')
  })

  it('preserves the value type when the string is exactly one template', () => {
    // This is what makes `{ "checked": "{{user.isAdmin}}" }` a boolean, not the string "true".
    expect(resolveTemplate('{{user.isAdmin}}', data)).toBe(true)
    expect(resolveTemplate('{{user.age}}', data)).toBe(36)
    expect(resolveTemplate('{{items}}', data)).toBe(data.items)
  })

  it('tolerates whitespace inside the braces', () => {
    expect(resolveTemplate('{{  user.name  }}', data)).toBe('Ada')
  })

  it('renders a missing value as an empty string when interpolating', () => {
    expect(resolveTemplate('x={{user.email}}', data)).toBe('x=')
  })

  it('returns undefined for a whole-string template that misses', () => {
    expect(resolveTemplate('{{user.email}}', data)).toBeUndefined()
  })

  it('leaves plain strings untouched', () => {
    expect(resolveTemplate('no templates here', data)).toBe('no templates here')
  })

  it('recurses through objects and arrays', () => {
    expect(
      resolveTemplate({ title: '{{user.name}}', tags: ['{{status}}', 'static'] }, data),
    ).toEqual({ title: 'Ada', tags: ['pending', 'static'] })
  })

  it('strips prototype keys while recursing', () => {
    expect(
      resolveTemplate(JSON.parse('{"__proto__": {"x": 1}, "ok": "{{status}}"}'), data),
    ).toEqual({ ok: 'pending' })
  })

  it('passes non-string primitives through', () => {
    expect(resolveTemplate(42, data)).toBe(42)
    expect(resolveTemplate(null, data)).toBe(null)
  })
})

describe('evaluateCondition', () => {
  it('renders the node when there is no condition', () => {
    expect(evaluateCondition(undefined, data)).toBe(true)
    expect(evaluateCondition('   ', data)).toBe(true)
  })

  it('evaluates a truthy path', () => {
    expect(evaluateCondition('user.isAdmin', data)).toBe(true)
    expect(evaluateCondition('user.email', data)).toBe(false)
    expect(evaluateCondition('zero', data)).toBe(false)
  })

  it('treats an empty array as falsy', () => {
    expect(evaluateCondition('empty', data)).toBe(false)
    expect(evaluateCondition('items', data)).toBe(true)
  })

  it('evaluates negation', () => {
    expect(evaluateCondition('!user.isAdmin', data)).toBe(false)
    expect(evaluateCondition('!user.email', data)).toBe(true)
  })

  it('compares against a quoted literal', () => {
    expect(evaluateCondition("status == 'pending'", data)).toBe(true)
    expect(evaluateCondition("status == 'done'", data)).toBe(false)
    expect(evaluateCondition('status != "done"', data)).toBe(true)
  })

  it('accepts strict operators too', () => {
    expect(evaluateCondition("status === 'pending'", data)).toBe(true)
    expect(evaluateCondition("status !== 'pending'", data)).toBe(false)
  })

  it('compares numbers written as strings', () => {
    expect(evaluateCondition("user.age == '36'", data)).toBe(true)
    expect(evaluateCondition('user.age == 36', data)).toBe(true)
  })

  it('compares against boolean and null literals', () => {
    expect(evaluateCondition('user.isAdmin == true', data)).toBe(true)
    expect(evaluateCondition('nothing == null', data)).toBe(true)
  })

  it('fails closed on anything it does not understand', () => {
    // Hiding a node beats rendering UI the agent did not intend — and there is no eval
    // here to reach in the first place.
    expect(evaluateCondition('user.age > 18', data)).toBe(false)
    expect(evaluateCondition('alert(1)', data)).toBe(false)
    expect(evaluateCondition('user.isAdmin && true', data)).toBe(false)
    expect(evaluateCondition('constructor', data)).toBe(false)
  })
})
