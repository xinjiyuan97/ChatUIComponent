---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
'@xinjiyuan97/chat-a2ui': minor
---

Implement the `agent-chat/1` protocol across `@xinjiyuan97/chat-core` and `@xinjiyuan97/chat-ui`:

- request envelope with a typed `input[]` (`message` / `tool-result` / `permission-decision` /
  `a2ui-action` / `cancel`), each carrying an `inputId` idempotency key
- the full identity set (`conversationId` / `turnId` / `runId` / `messageId` / `blockId` /
  `eventId` / `inputId`), per-run monotonic `eventId`, and re-delivery that is safe to drop
- six terminal `finishReason` values; `cancelled` is distinct from both `stop` and `error`
- `blockId`-based part positioning, with the order-only semantics kept as the fallback when absent
- structured errors (`scope` / `code` / `retryAfterMs` / `retryable`)
- permission round-trips: the stream ends with `awaiting-permission`, then the decision resumes the
  same turn in a new run
- client-side tools, capability negotiation, cancellation, and resume/replay

UI gains the matching states: a cancelled part renders as its own treatment — **never a spinner and
never "failed"** — consumed by the reasoning, tool, file and permission parts, with bilingual
locale strings. The sidebar's active-indicator default changes from a bar to none.
