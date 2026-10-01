import type { ChatEvent } from './events'

const eventBatchId = Symbol('eventBatchId')

type BatchedChatEvent = ChatEvent & { [eventBatchId]?: symbol }

export function markEventBatch(event: ChatEvent, batchId: symbol): ChatEvent {
  const marked = { ...event } as BatchedChatEvent
  Object.defineProperty(marked, eventBatchId, { value: batchId })
  return marked
}

export function getEventBatchId(event: ChatEvent): symbol | undefined {
  return (event as BatchedChatEvent)[eventBatchId]
}
