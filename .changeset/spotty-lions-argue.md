---
'@xinjiyuan97/chat-ui': patch
---

Stop the conversation item's ⋯ trigger from rendering when the host supplies none of the menu
callbacks (`onRename` / `onDelete` / `onTogglePin`). The trigger used to appear regardless and open
a `role="menu"` with no items — a visible empty box — leaving a control that does nothing.
`ConversationItemMenu` now also returns `null` for an empty item list, as a backstop.
