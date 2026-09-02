---
'@xinjiyuan97/chat-ui': minor
---

Composer background slot, and a centred layout for new conversations.

**`background` on `PromptInput`.** A decorative layer painted inside the box, behind the
textarea and the toolbar — a watermark, a gradient, a logo. Unlike `header` and `toolbar`
it is out of the document flow, so it never changes the composer's height, and it never
takes pointer events: clicking it focuses the textarea underneath. `backgroundVisible`
defaults to `empty`, fading the layer out as soon as there is anything in the box, because
a watermark behind a paragraph the user is still writing is a legibility problem.

**`PromptBackdrop`** places content in that slot: `placement` (`top-right` by default —
the placeholder owns the top left and the toolbar owns the whole bottom row, send button
included) and `opacity`, which defaults far fainter than looks right in isolation.

**`ChatDock`.** Transcript above, composer below, plus a centred first-run state: an empty
conversation puts the greeting, the composer and the starter prompts on the centre line,
and sending the first message slides the composer down to the bottom while the intro
collapses in step. The motion is a `grid-template-rows` `1fr` → `0fr` transition on a
trailing spacer row — the same technique `Collapsible` uses, so it animates to a real
layout with no measurement and no magic numbers. The collapsed intro is marked `inert`, so
starter prompts clipped to zero height stay out of the tab order.

Opt-in and additive: hosts that want the composer permanently docked keep assembling
`ChatContainer` and `ChatViewport` exactly as before.
