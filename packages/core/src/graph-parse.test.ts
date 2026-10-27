import { describe, expect, it, vi } from 'vitest'
import { stringify } from 'yaml'
import {
  AGENT_GRAPH_MAX_FILE_BYTES,
  parseAgentGraphYaml,
  readAgentGraphFile,
  validateAgentGraphDefinition,
} from './graph-parse'

const definition = {
  schema_version: 2,
  name: 'yaml-assistant',
  triggers: { start: { type: 'manual', version: 1, event: 'agent.start.v1', config: {} } },
  operators: {
    llm: {
      type: 'app.model',
      version: 1,
      config: { prompt: '你好\n第二行', enabled: true, values: [1, null] },
    },
  },
  subscriptions: [{ id: 'start', from: 'start', subscriber: 'llm', events: ['agent.start.v1'] }],
  lifecycle: {
    start: { trigger: 'start' },
    terminal: {
      from: 'llm',
      completed: 'stop.completed.v1',
      failed: 'stop.failed.v1',
      cancelled: 'stop.cancelled.v1',
    },
  },
  limits: { timeout_ms: 1000, max_deliveries: 100 },
}
const yaml = stringify(definition)

describe('parseAgentGraphYaml', () => {
  it('reads v2 YAML with comments, multiline text and JSON-compatible configuration', () => {
    expect(parseAgentGraphYaml(`# example\n${yaml}`)).toEqual({ ok: true, definition })
  })
  it('also accepts JSON and v1 snapshots', () => {
    expect(parseAgentGraphYaml(JSON.stringify(definition))).toEqual({ ok: true, definition })
    const { triggers: _, ...rest } = definition
    const v1 = {
      ...rest,
      schema_version: 1,
      lifecycle: { ...rest.lifecycle, start: { event: 'agent.start.v1' } },
      subscriptions: [{ ...rest.subscriptions[0], from: '$input' }],
    }
    expect(parseAgentGraphYaml(stringify(v1))).toEqual({ ok: true, definition: v1 })
  })
  it.each(['', 'null', '[]', 'hello', 'schema_version: 3', 'operators: []'])(
    'reports invalid root/shape without throwing (%s)',
    (source) => {
      expect(parseAgentGraphYaml(source).ok).toBe(false)
    },
  )
  it('provides line and column on malformed YAML and duplicate keys', () => {
    for (const source of ['name: [broken', `${yaml}\nname: duplicate`]) {
      const result = parseAgentGraphYaml(source)
      expect(result.ok).toBe(false)
      if (!result.ok)
        expect(result.issues[0]).toMatchObject({
          line: expect.any(Number),
          column: expect.any(Number),
        })
    }
  })
  it.each([
    'config: !custom {}',
    'config: { value: .inf }',
    'config: { 1: number-key }',
    'config: &cycle { again: *cycle }',
    'config: !!set { a: null }',
  ])('rejects unsupported YAML values (%s)', (config) => {
    const source = yaml.replace(/ {4}config:\n[\s\S]*?(?=subscriptions:)/, `    ${config}\n`)
    expect(parseAgentGraphYaml(source).ok).toBe(false)
  })
  it('rejects multi-document input instead of silently reading one document', () => {
    expect(parseAgentGraphYaml(`${yaml}\n---\n${yaml}`).ok).toBe(false)
  })
  it('allows ordinary shared aliases but rejects excessive expansion', () => {
    const shared = yaml.replace(
      / {4}config:\n[\s\S]*?(?=subscriptions:)/,
      '    config:\n      shared: &args { a: 1 }\n      repeated: *args\n',
    )
    expect(parseAgentGraphYaml(shared).ok).toBe(true)
    const source = yaml.replace(
      / {4}config:\n[\s\S]*?(?=subscriptions:)/,
      '    config:\n      a: &a [1, 2, 3]\n      b: &b [*a, *a, *a, *a]\n      c: [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\n',
    )
    const result = parseAgentGraphYaml(source)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.message).toMatch(/alias/i)
  })
  it('checks unknown fields, nested types and positive limits before building a topology', () => {
    const result = validateAgentGraphDefinition({
      ...definition,
      typo: true,
      operators: { llm: { type: 7, version: 0, config: [] } },
      limits: { timeout_ms: -1, max_deliveries: '100' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          '$.typo',
          'operators.llm.type',
          'operators.llm.version',
          'operators.llm.config',
          'limits.timeout_ms',
          'limits.max_deliveries',
        ]),
      )
  })
  it('checks dangling references and duplicate subscriptions', () => {
    const result = validateAgentGraphDefinition({
      ...definition,
      subscriptions: [
        definition.subscriptions[0],
        { ...definition.subscriptions[0], from: 'missing' },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.issues.map((issue) => issue.path)).toEqual([
        'subscriptions[1].id',
        'subscriptions[1].from',
      ])
  })
  it('rejects deeply nested objects before they reach the renderer', () => {
    let config: unknown = {}
    for (let i = 0; i < 70; i++) config = { child: config }
    expect(
      validateAgentGraphDefinition({
        ...definition,
        operators: { llm: { ...definition.operators.llm, config } },
      }).ok,
    ).toBe(false)
  })
  it('rejects oversized content and files before reading them', async () => {
    expect(parseAgentGraphYaml('x'.repeat(AGENT_GRAPH_MAX_FILE_BYTES + 1)).ok).toBe(false)
    const text = vi.fn()
    expect((await readAgentGraphFile({ size: AGENT_GRAPH_MAX_FILE_BYTES + 1, text })).ok).toBe(
      false,
    )
    expect(text).not.toHaveBeenCalled()
  })
  it('reads file text and reports read errors', async () => {
    expect(await readAgentGraphFile({ size: yaml.length, text: async () => yaml })).toEqual({
      ok: true,
      definition,
    })
    expect(
      await readAgentGraphFile({
        size: 10,
        text: async () => {
          throw new Error('Read failed')
        },
      }),
    ).toEqual({ ok: false, issues: [{ path: '$', message: 'Read failed' }] })
  })
})
