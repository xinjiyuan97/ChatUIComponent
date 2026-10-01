// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSSETransport, createChatStore } from '@xinjiyuan97/chat-core'
import { createAgentServer } from './server.ts'

let server: ReturnType<typeof createAgentServer>
let base = ''

beforeAll(async () => {
  server = createAgentServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('temporary port was not assigned')
  base = `http://127.0.0.1:${address.port}/agent/chat`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

async function runScenario(scenario: string, extra: Record<string, unknown> = {}) {
  const transport = createSSETransport({ url: base })
  const store = createChatStore({ transport })
  await store
    .getState()
    .send(`scenario:${scenario}`, { body: { metadata: { scenario }, ...extra } })
  return store.getState()
}

describe('agent-chat/1 HTTP conformance', () => {
  it.each([
    ['stop', 'complete'],
    ['length', 'complete'],
    ['tool-calls', 'complete'],
    ['awaiting-permission', 'complete'],
    ['error', 'error'],
    ['cancelled', 'aborted'],
  ])('%s reaches a terminal state', async (scenario, status) => {
    const state = await runScenario(scenario)
    expect(state.messages.at(-1)?.status).toBe(status)
  })

  it('reports a disconnect as an incomplete stream error', async () => {
    const state = await runScenario('disconnect')
    expect(state.messages.at(-1)?.status).toBe('error')
    expect(state.messages.at(-1)?.status).not.toBe('complete')
  })

  it('cancels an active run without treating permission as approved', async () => {
    const transport = createSSETransport({ url: base })
    const store = createChatStore({ transport })
    const pending = store.getState().send('slow', { body: { metadata: { scenario: 'cancel' } } })
    await new Promise((resolve) => setTimeout(resolve, 10))
    store.getState().stop()
    await pending
    expect(store.getState().messages.at(-1)?.status).toBe('aborted')
    expect(store.getState().status).toBe('idle')
    const permission = await runScenario('awaiting-permission')
    expect(permission.messages.at(-1)?.parts.some((part) => part.type === 'permission')).toBe(true)
  })

  it('does not apply duplicate or out-of-order event effects twice', async () => {
    const state = await runScenario('duplicate-out-of-order')
    const text = state.messages
      .at(-1)
      ?.parts.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    expect(text).toBe('scenario:duplicate-out-of-order')
  })

  it('returns structured retryable and non-retryable errors', async () => {
    const retryable = await runScenario('structured-error')
    expect(retryable.messages.at(-1)?.status).toBe('error')
    expect(
      retryable.messages
        .at(-1)
        ?.parts.some((part) => part.type === 'error' && part.retryAfterMs === 250),
    ).toBe(true)
    const permanent = await runScenario('error')
    expect(
      permanent.messages
        .at(-1)
        ?.parts.some((part) => part.type === 'error' && part.retryable === false),
    ).toBe(true)
  })

  it('ignores an unknown custom event and continues', async () => {
    const state = await runScenario('unknown-event')
    expect(
      state.messages
        .at(-1)
        ?.parts.some((part) => part.type === 'text' && part.text.includes('仍可继续')),
    ).toBe(true)
  })

  it('keeps interleaved block text in separate parts', async () => {
    const state = await runScenario('block-ids')
    const texts = state.messages.at(-1)?.parts.filter((part) => part.type === 'text')
    expect(texts).toEqual(
      expect.arrayContaining([
        { type: 'text', text: '甲1甲2', blockId: 'a' },
        { type: 'text', text: '乙1乙2', blockId: 'b' },
      ]),
    )
  })

  it('supports client tool and permission round trips on one turn', async () => {
    const tool = await runScenario('client-tool')
    expect(
      tool.messages
        .at(-1)
        ?.parts.some((part) => part.type === 'tool' && part.execution === 'client'),
    ).toBe(true)
    const permission = await runScenario('permission')
    expect(permission.messages.at(-1)?.parts.some((part) => part.type === 'permission')).toBe(true)
  })

  it('advertises the minimum capability set for graceful downgrade', async () => {
    const state = await runScenario('minimal-capabilities')
    expect(state.serverHello.capabilities).toEqual({
      blockIds: false,
      resume: false,
      clientTools: false,
      permissions: false,
      a2ui: false,
    })
  })

  it('keeps usage as a snapshot and rejects oversized attachments', async () => {
    const usage = await runScenario('usage')
    const last = usage.messages.at(-1)
    expect(last?.status).toBe('complete')
    const response = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        metadata: { scenario: 'attachment-limit' },
        messages: [],
        input: [
          {
            type: 'message',
            inputId: 'large',
            parts: [{ type: 'file', mediaType: 'text/plain', size: 2048 }],
          },
        ],
      }),
    })
    expect(response.status).toBe(413)
    expect((await response.json()).error.code).toBe('attachment_limit')
  })
})
