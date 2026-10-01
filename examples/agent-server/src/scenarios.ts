export const SCENARIOS = [
  'stop',
  'length',
  'tool-calls',
  'awaiting-permission',
  'cancelled',
  'error',
  'disconnect',
  'cancel',
  'duplicate-out-of-order',
  'structured-error',
  'unknown-event',
  'block-ids',
  'client-tool',
  'permission',
  'minimal-capabilities',
  'usage',
  'attachment-limit',
] as const

export type Scenario = (typeof SCENARIOS)[number]

const aliases: Record<string, Scenario> = {
  default: 'stop',
  duplicate: 'duplicate-out-of-order',
  blockId: 'block-ids',
  client_tool: 'client-tool',
  'permission-roundtrip': 'permission',
  minimal: 'minimal-capabilities',
  'usage-override': 'usage',
  attachment: 'attachment-limit',
}

export function scenarioOf(value: unknown): Scenario {
  const name = typeof value === 'string' ? value : 'stop'
  return (SCENARIOS as readonly string[]).includes(name)
    ? (name as Scenario)
    : (aliases[name] ?? 'stop')
}
