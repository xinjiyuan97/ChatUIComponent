import { isMap, isScalar, parseDocument, visit } from 'yaml'
import { buildAgentGraph, type AgentGraphDefinition } from './graph'

export const AGENT_GRAPH_MAX_FILE_BYTES = 1024 * 1024
export type AgentGraphParseIssue = {
  path: string
  message: string
  line?: number
  column?: number
}
export type AgentGraphParseResult =
  { ok: true; definition: AgentGraphDefinition } | { ok: false; issues: AgentGraphParseIssue[] }

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Checks the serializable format and references, not host resource or operator schemas. */
export function validateAgentGraphDefinition(value: unknown): AgentGraphParseResult {
  const issues: AgentGraphParseIssue[] = []
  const add = (path: string, message: string) => {
    issues.push({ path, message })
  }
  // YAML aliases may create cycles or share subtrees. Bound expansion before rendering or
  // serializing the definition, and reject non-JSON values such as Infinity and Date.
  const active = new WeakSet<object>()
  let count = 0
  const json = (item: unknown, path: string, depth: number): boolean => {
    if (++count > 50000 || depth > 64) {
      add(path, 'Structure is too large or too deeply nested')
      return false
    }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return true
    if (typeof item === 'number' && Number.isFinite(item)) return true
    if (
      typeof item !== 'object' ||
      item === null ||
      (!Array.isArray(item) &&
        Object.getPrototypeOf(item) !== Object.prototype &&
        Object.getPrototypeOf(item) !== null)
    ) {
      add(path, 'Expected a JSON-compatible value')
      return false
    }
    if (active.has(item)) {
      add(path, 'Cyclic aliases are not supported')
      return false
    }
    active.add(item)
    for (const [key, child] of Object.entries(item)) {
      if (!json(child, `${path}.${key}`, depth + 1)) return false
    }
    active.delete(item)
    return true
  }
  if (!json(value, '$', 0)) return { ok: false, issues }
  const object = (
    item: unknown,
    path: string,
    keys?: string[],
  ): item is Record<string, unknown> => {
    if (!record(item)) {
      add(path, 'Expected an object')
      return false
    }
    if (keys)
      for (const key of Object.keys(item))
        if (!keys.includes(key)) add(`${path}.${key}`, 'Unknown field')
    return true
  }
  const string = (item: unknown, path: string) => {
    if (typeof item !== 'string' || !item.trim()) add(path, 'Expected a non-empty string')
  }
  const positive = (item: unknown, path: string) => {
    if (typeof item !== 'number' || !Number.isSafeInteger(item) || item <= 0)
      add(path, 'Expected a positive safe integer')
  }
  if (!object(value, '$')) return { ok: false, issues }
  const version = value.schema_version
  if (version !== 1 && version !== 2) add('schema_version', 'Expected schema version 1 or 2')
  object(value, '$', [
    'schema_version',
    'name',
    'operators',
    'subscriptions',
    'lifecycle',
    'limits',
    ...(version === 2 ? ['triggers'] : []),
  ])
  string(value.name, 'name')
  const instances = (item: unknown, path: 'operators' | 'triggers') => {
    if (!object(item, path)) return
    if (!Object.keys(item).length) add(path, 'Expected at least one instance')
    for (const [id, descriptor] of Object.entries(item)) {
      const prefix = `${path}.${id}`
      if (
        !object(descriptor, prefix, [
          'type',
          'version',
          'config',
          ...(path === 'triggers' ? ['event'] : []),
        ])
      )
        continue
      string(descriptor.type, `${prefix}.type`)
      positive(descriptor.version, `${prefix}.version`)
      object(descriptor.config, `${prefix}.config`)
      if (path === 'triggers') string(descriptor.event, `${prefix}.event`)
    }
  }
  instances(value.operators, 'operators')
  if (version === 2) instances(value.triggers, 'triggers')
  if (!Array.isArray(value.subscriptions)) add('subscriptions', 'Expected an array')
  else
    value.subscriptions.forEach((subscription, index) => {
      const path = `subscriptions[${index}]`
      if (!object(subscription, path, ['id', 'from', 'subscriber', 'events'])) return
      for (const field of ['id', 'from', 'subscriber'])
        string(subscription[field], `${path}.${field}`)
      if (!Array.isArray(subscription.events) || !subscription.events.length)
        add(`${path}.events`, 'Expected a non-empty array')
      else subscription.events.forEach((event, index) => string(event, `${path}.events[${index}]`))
    })
  if (object(value.lifecycle, 'lifecycle', ['start', 'terminal'])) {
    const startKey = version === 2 ? 'trigger' : 'event'
    if (object(value.lifecycle.start, 'lifecycle.start', [startKey]))
      string(value.lifecycle.start[startKey], `lifecycle.start.${startKey}`)
    if (
      object(value.lifecycle.terminal, 'lifecycle.terminal', [
        'from',
        'completed',
        'failed',
        'cancelled',
      ])
    ) {
      for (const key of ['from', 'completed', 'failed', 'cancelled'])
        string(value.lifecycle.terminal[key], `lifecycle.terminal.${key}`)
      const terminal = value.lifecycle.terminal
      if (new Set([terminal.completed, terminal.failed, terminal.cancelled]).size !== 3)
        add('lifecycle.terminal', 'Terminal event types must be distinct')
    }
  }
  if (object(value.limits, 'limits', ['timeout_ms', 'max_deliveries'])) {
    positive(value.limits.timeout_ms, 'limits.timeout_ms')
    positive(value.limits.max_deliveries, 'limits.max_deliveries')
  }
  if (issues.length) return { ok: false, issues }
  // All fields accessed by buildAgentGraph have been narrowed above.
  const definition = value as AgentGraphDefinition
  issues.push(...buildAgentGraph(definition).issues)
  return issues.length ? { ok: false, issues } : { ok: true, definition }
}

/** Parse one YAML (or JSON) document. Errors are data, with line/column for YAML syntax. */
export function parseAgentGraphYaml(source: string): AgentGraphParseResult {
  if (new TextEncoder().encode(source).byteLength > AGENT_GRAPH_MAX_FILE_BYTES) {
    return { ok: false, issues: [{ path: '$', message: 'File exceeds the 1 MiB limit' }] }
  }
  try {
    const document = parseDocument(source, {
      schema: 'core',
      uniqueKeys: true,
      merge: false,
      strict: true,
    })
    const issues: AgentGraphParseIssue[] = [...document.errors, ...document.warnings].map(
      (error) => ({
        path: '$',
        message: error.message,
        line: error.linePos?.[0]?.line,
        column: error.linePos?.[0]?.col,
      }),
    )
    visit(document, (_, node) => {
      if (isMap(node))
        for (const pair of node.items) {
          if (!isScalar(pair.key) || typeof pair.key.value !== 'string')
            issues.push({ path: '$', message: 'Mapping keys must be strings' })
        }
    })
    if (issues.length) return { ok: false, issues }
    return validateAgentGraphDefinition(document.toJS({ maxAliasCount: 50 }))
  } catch (error) {
    return {
      ok: false,
      issues: [
        { path: '$', message: error instanceof Error ? error.message : 'Could not parse YAML' },
      ],
    }
  }
}

/** Reads a browser File/Blob without sending its contents to a server. */
export async function readAgentGraphFile(
  file: Pick<Blob, 'size' | 'text'>,
): Promise<AgentGraphParseResult> {
  if (file.size > AGENT_GRAPH_MAX_FILE_BYTES)
    return { ok: false, issues: [{ path: '$', message: 'File exceeds the 1 MiB limit' }] }
  try {
    return parseAgentGraphYaml(await file.text())
  } catch (error) {
    return {
      ok: false,
      issues: [
        { path: '$', message: error instanceof Error ? error.message : 'Could not read file' },
      ],
    }
  }
}
