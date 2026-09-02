---
'@xinjiyuan97/chat-ui': minor
---

`activeIndicator` on the sidebar, for hiding the active row's accent bar.

`activeIndicator="none"` on `ConversationSidebar`, `ConversationList`, `ConversationGroup`
or `ConversationItem` drops the 2px accent bar to the left of the selected conversation,
keeping the tinted fill and the darkened title. Nothing is lost by turning it off — the
fill already says which conversation is open — and products whose rail carries a leading
avatar or status dot read a second element on that same edge as clutter rather than as
emphasis.

Defaults to `bar`, so existing sidebars are unchanged.
