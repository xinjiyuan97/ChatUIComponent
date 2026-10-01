import type { ChatEvent } from '@xinjiyuan97/chat-core'

export type StoredFrame = { id: number; event: ChatEvent }

export function sseFrame(frame: StoredFrame): string {
  return `id: ${frame.id}\ndata: ${JSON.stringify(frame.event)}\n\n`
}

export function heartbeat(): string {
  return ': heartbeat\n\n'
}
