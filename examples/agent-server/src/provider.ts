import type { ChatEvent, ChatInput } from '@xinjiyuan97/chat-core'
import type { Scenario } from './scenarios.ts'

export type AgentRequest = {
  scenario: Scenario
  input: ChatInput[]
  text: string
  resumed: boolean
}
export type AgentProvider = (request: AgentRequest) => AsyncIterable<ChatEvent>

const card = { type: 'Card', props: { title: '参考 Agent', subtitle: 'A2UI 事件' }, children: [] }

export async function* scriptedProvider(request: AgentRequest): AsyncIterable<ChatEvent> {
  const { scenario } = request
  yield {
    type: 'server-hello',
    protocol: 'agent-chat/1',
    capabilities:
      scenario === 'minimal-capabilities'
        ? { blockIds: false, resume: false, clientTools: false, permissions: false, a2ui: false }
        : { blockIds: true, resume: true, clientTools: true, permissions: true, a2ui: true },
    limits: {
      disconnectGracePeriodMs: 10000,
      maxAttachmentBytes: 1024,
      maxAttachmentCount: 2,
      resumeWindowEvents: 256,
    },
  }
  yield { type: 'message-start', id: `assistant-${scenario}` }
  if (scenario === 'disconnect') {
    yield { type: 'text-delta', delta: '断流前的片段' }
    return
  }
  if (scenario === 'cancel') {
    yield { type: 'text-start' }
    yield { type: 'text-delta', delta: '取消前的片段' }
    await new Promise((resolve) => setTimeout(resolve, 100))
    yield {
      type: 'message-end',
      finishReason: 'cancelled',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }
    return
  }
  if (scenario === 'cancelled') {
    yield { type: 'text-delta', delta: '已取消' }
    yield {
      type: 'message-end',
      finishReason: 'cancelled',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }
    return
  }
  if (scenario === 'error' || scenario === 'structured-error') {
    yield {
      type: 'error',
      error: scenario === 'structured-error' ? '服务暂时不可用' : '不可重试的请求错误',
      scope: 'server',
      code: scenario,
      retryAfterMs: scenario === 'structured-error' ? 250 : undefined,
      retryable: scenario === 'structured-error',
    }
    yield {
      type: 'message-end',
      finishReason: 'error',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }
    return
  }
  if (scenario === 'awaiting-permission' || (scenario === 'permission' && !request.resumed)) {
    yield {
      type: 'permission-request',
      request: {
        id: 'permission-1',
        toolName: 'read_file',
        title: '读取文件',
        detail: 'README.md',
        options: [
          { value: 'allow-once', decision: 'allow-once' },
          { value: 'deny', decision: 'deny' },
        ],
      },
    }
    yield {
      type: 'message-end',
      finishReason: 'awaiting-permission',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }
    return
  }
  if (scenario === 'client-tool' && !request.input.some((input) => input.type === 'tool-result')) {
    yield {
      type: 'tool-input-start',
      toolCallId: 'client-1',
      name: 'browser_context',
      execution: 'client',
    }
    yield { type: 'tool-input-available', toolCallId: 'client-1', input: { page: 'current' } }
    yield {
      type: 'message-end',
      finishReason: 'tool-calls',
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    }
    return
  }
  if (scenario === 'block-ids') {
    yield { type: 'text-start', blockId: 'a' }
    yield { type: 'text-start', blockId: 'b' }
    yield { type: 'text-delta', blockId: 'a', delta: '甲1' }
    yield { type: 'text-delta', blockId: 'b', delta: '乙1' }
    yield { type: 'text-delta', blockId: 'a', delta: '甲2' }
    yield { type: 'text-delta', blockId: 'b', delta: '乙2' }
    yield { type: 'text-end', blockId: 'a' }
    yield { type: 'text-end', blockId: 'b' }
  } else if (scenario === 'unknown-event') {
    yield { type: 'custom', name: 'future.event', data: { ignored: true } }
    yield { type: 'text-delta', delta: '未知事件后仍可继续' }
  } else {
    yield { type: 'reasoning-start', blockId: 'reasoning-1' }
    yield { type: 'reasoning-delta', blockId: 'reasoning-1', delta: '正在执行' }
    yield { type: 'reasoning-end', blockId: 'reasoning-1' }
    yield { type: 'text-delta', delta: request.text || '协议联调成功' }
  }
  if (scenario === 'usage') {
    yield {
      type: 'custom',
      name: 'usage-snapshot',
      data: { usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } },
    }
    yield {
      type: 'message-end',
      finishReason: 'stop',
      usage: { inputTokens: 2, outputTokens: 6, totalTokens: 8 },
    }
    return
  }
  if (scenario === 'tool-calls') {
    yield { type: 'tool-input-start', toolCallId: 'server-1', name: 'lookup' }
    yield { type: 'tool-input-available', toolCallId: 'server-1', input: { q: request.text } }
    yield { type: 'tool-executing', toolCallId: 'server-1' }
  }
  if (scenario === 'permission' && request.resumed)
    yield {
      type: 'permission-resolved',
      requestId: 'permission-1',
      resolution: { requestId: 'permission-1', option: 'allow-once', decision: 'allow-once' },
    }
  if (scenario !== 'minimal-capabilities')
    yield { type: 'a2ui', surfaceId: 'surface-1', spec: card }
  yield {
    type: 'message-end',
    finishReason:
      scenario === 'length' ? 'length' : scenario === 'tool-calls' ? 'tool-calls' : 'stop',
    usage: { inputTokens: 1, outputTokens: 4, totalTokens: 5 },
  }
}
