---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

Prompt queue, a clickable streaming status bar, and a heavier send arrow.

**`usePromptQueue`** (core) holds messages written while the agent is still answering and
releases them one at a time once it goes idle. Draining is driven by the promise `onSend`
returns rather than by watching a busy flag — `store.send` only resolves after its whole
stream finishes, which makes it an exact "previous turn is done" signal. Queued prompts
capture their attachments and quote at queue time, so an item sent minutes later still
carries the files it was written with.

**`PromptInput` gains `queue`.** Passing it changes what the composer does mid-stream: the
send button stays a send button and queues, and stopping moves to a `StreamingStatus` bar
above the box whose whole row is the click target. Send and stop are two intentions and one
slot cannot hold both. Omit `queue` and the old behaviour — send button becomes stop button
— is untouched.

**Stop holds the queue** rather than letting it fire the next message immediately.
Interrupting a turn only to have the next queued item start half a second later is not an
interruption; the queue is held, still visible and still editable, with a resume control
next to it.

**`PromptQueue`** lists the waiting prompts: click one to rewrite it in place, hover for the
remove button.

The send button's arrow goes from 16px/1.5 to 18px/2.25. The icon set's defaults are tuned
for glyphs sitting beside text; alone in the middle of a filled 32px circle the same arrow
read as a thin scratch.
