import type { AgentGraphDefinitionV2 } from '@xinjiyuan97/chat-core'

// Mina static graph examples; triggers are sources, never executable operators.
export const toolGraph = {
  schema_version: 2,
  name: 'tool-assistant',
  triggers: {
    start: {
      type: 'manual',
      version: 1,
      event: 'agent.start.v1',
      config: {},
    },
  },
  operators: {
    context: {
      type: 'agent.context',
      version: 1,
      config: {
        system_prompt: '你是一个简洁、准确的助手。',
        max_steps: 8,
        toolset: 'workspace',
      },
    },
    llm: {
      type: 'agent.model',
      version: 1,
      config: {
        model: 'primary',
        timeout_ms: 60000,
      },
    },
    gate: {
      type: 'agent.gate',
      version: 1,
      config: {},
    },
    policy: {
      type: 'agent.tool_policy',
      version: 1,
      config: {
        toolset: 'workspace',
        approval_timeout_ms: 300000,
      },
    },
    tools: {
      type: 'agent.tools',
      version: 1,
      config: {
        toolset: 'workspace',
        timeout_ms: 30000,
      },
    },
  },
  subscriptions: [
    {
      id: 'start-agent',
      subscriber: 'context',
      from: 'start',
      events: ['agent.start.v1'],
    },
    {
      id: 'request-model',
      subscriber: 'llm',
      from: 'context',
      events: ['model.requested.v1'],
    },
    {
      id: 'context-failure',
      subscriber: 'llm',
      from: 'context',
      events: ['context.failed.v1'],
    },
    {
      id: 'start-tools',
      subscriber: 'gate',
      from: 'llm',
      events: ['stop.tool_calls.v1'],
    },
    {
      id: 'authorize-tool',
      subscriber: 'policy',
      from: 'gate',
      events: ['gate.dispatch.v1'],
    },
    {
      id: 'approval-decision',
      subscriber: 'policy',
      from: '$external',
      events: ['approval.decided.v1', 'approval.expire.v1'],
    },
    {
      id: 'request-tool',
      subscriber: 'tools',
      from: 'policy',
      events: ['tool.authorized.v1'],
    },
    {
      id: 'rejected-tool',
      subscriber: 'gate',
      from: 'policy',
      events: ['gate.result.v1'],
    },
    {
      id: 'collect-tools',
      subscriber: 'gate',
      from: 'tools',
      events: ['gate.result.v1'],
    },
    {
      id: 'update-context',
      subscriber: 'context',
      from: 'gate',
      events: ['gate.completed.v1'],
    },
  ],
  lifecycle: {
    start: {
      trigger: 'start',
    },
    terminal: {
      from: 'llm',
      completed: 'stop.completed.v1',
      failed: 'stop.failed.v1',
      cancelled: 'stop.cancelled.v1',
    },
  },
  limits: {
    timeout_ms: 900000,
    max_deliveries: 10000,
  },
} satisfies AgentGraphDefinitionV2

export const textGraph = {
  schema_version: 2,
  name: 'text-assistant',
  triggers: {
    start: {
      type: 'manual',
      version: 1,
      event: 'agent.start.v1',
      config: {},
    },
  },
  operators: {
    context: {
      type: 'agent.context',
      version: 1,
      config: {
        system_prompt: '你是一个简洁、准确的助手。',
        max_steps: 8,
      },
    },
    llm: {
      type: 'agent.model',
      version: 1,
      config: {
        model: 'primary',
        timeout_ms: 60000,
      },
    },
  },
  subscriptions: [
    {
      id: 'start-agent',
      subscriber: 'context',
      from: 'start',
      events: ['agent.start.v1'],
    },
    {
      id: 'request-model',
      subscriber: 'llm',
      from: 'context',
      events: ['model.requested.v1'],
    },
    {
      id: 'context-failure',
      subscriber: 'llm',
      from: 'context',
      events: ['context.failed.v1'],
    },
  ],
  lifecycle: {
    start: {
      trigger: 'start',
    },
    terminal: {
      from: 'llm',
      completed: 'stop.completed.v1',
      failed: 'stop.failed.v1',
      cancelled: 'stop.cancelled.v1',
    },
  },
  limits: {
    timeout_ms: 900000,
    max_deliveries: 10000,
  },
} satisfies AgentGraphDefinitionV2

export const durableGraph = {
  schema_version: 2,
  name: 'durable-tool-assistant',
  triggers: {
    start: {
      type: 'manual',
      version: 1,
      event: 'agent.start.v1',
      config: {},
    },
  },
  operators: {
    context: {
      type: 'agent.context',
      version: 1,
      config: {
        system_prompt: '你是一个简洁、准确的助手。',
        max_steps: 8,
        toolset: 'workspace',
      },
    },
    llm: {
      type: 'agent.model',
      version: 1,
      config: {
        model: 'primary',
        timeout_ms: 60000,
      },
    },
    gate: {
      type: 'agent.gate',
      version: 1,
      config: {},
    },
    policy: {
      type: 'agent.tool_policy',
      version: 1,
      config: {
        toolset: 'workspace',
        approval_timeout_ms: 300000,
      },
    },
    wait: {
      type: 'agent.wait',
      version: 1,
      config: {
        wait_service: 'durable',
      },
    },
    tools: {
      type: 'agent.tools',
      version: 1,
      config: {
        toolset: 'workspace',
        timeout_ms: 30000,
        allow_suspend: true,
      },
    },
  },
  subscriptions: [
    {
      id: 'start-agent',
      subscriber: 'context',
      from: 'start',
      events: ['agent.start.v1'],
    },
    {
      id: 'request-model',
      subscriber: 'llm',
      from: 'context',
      events: ['model.requested.v1'],
    },
    {
      id: 'context-failure',
      subscriber: 'llm',
      from: 'context',
      events: ['context.failed.v1'],
    },
    {
      id: 'start-tools',
      subscriber: 'gate',
      from: 'llm',
      events: ['stop.tool_calls.v1'],
    },
    {
      id: 'authorize-tool',
      subscriber: 'policy',
      from: 'gate',
      events: ['gate.dispatch.v1'],
    },
    {
      id: 'approval-decision',
      subscriber: 'policy',
      from: '$external',
      events: ['approval.decided.v1', 'approval.expire.v1'],
    },
    {
      id: 'request-tool',
      subscriber: 'tools',
      from: 'policy',
      events: ['tool.authorized.v1'],
    },
    {
      id: 'rejected-tool',
      subscriber: 'gate',
      from: 'policy',
      events: ['gate.result.v1'],
    },
    {
      id: 'collect-tools',
      subscriber: 'gate',
      from: 'tools',
      events: ['gate.result.v1'],
    },
    {
      id: 'update-context',
      subscriber: 'context',
      from: 'gate',
      events: ['gate.completed.v1'],
    },
    {
      id: 'register-wait',
      subscriber: 'wait',
      from: 'tools',
      events: ['wait.requested.v1'],
    },
    {
      id: 'wake-wait',
      subscriber: 'wait',
      from: '$external',
      events: ['wait.woken.v1'],
    },
    {
      id: 'wait-result',
      subscriber: 'gate',
      from: 'wait',
      events: ['gate.result.v1'],
    },
    {
      id: 'cleanup-wait',
      subscriber: 'wait',
      from: '$engine',
      events: ['engine.terminal.v1'],
    },
  ],
  lifecycle: {
    start: {
      trigger: 'start',
    },
    terminal: {
      from: 'llm',
      completed: 'stop.completed.v1',
      failed: 'stop.failed.v1',
      cancelled: 'stop.cancelled.v1',
    },
  },
  limits: {
    timeout_ms: 900000,
    max_deliveries: 10000,
  },
} satisfies AgentGraphDefinitionV2
