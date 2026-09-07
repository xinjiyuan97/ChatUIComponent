---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

A three-column workspace shell with a tabbed, resizable right-hand panel.

**`ChatWorkspace`** frames conversations, transcript and panel. It is deliberately thin —
the side columns own their own widths — but it carries the three details every host
otherwise rediscovers the hard way: `min-w-0` on the middle column, without which one long
code block widens the transcript and pushes the panel off screen; `relative`, the
positioning context the panel's narrow-screen overlay needs; and an unbroken `h-full
min-h-0` chain, without which the transcript scrolls the page instead of itself.

**`SidePanel` knows nothing about what it shows.** Every item carries a `kind` and a `data`
blob; a `panels` registry on `ChatThemeProvider` decides what draws that kind, exactly as
`tools` already does for tool calls. Register renderers with `definePanel`, read them back
with `usePanelDefinition`. `padded: false` lets an image or a PDF reach the panel's edges.
An unregistered `kind` renders a neutral sentence rather than throwing — what lands in the
panel is agent output, so a kind you have not seen is normal input, not a bug. This is what
lets the same column hold a file preview today and a diff, a run log or a settings pane
later without touching the component.

**`useSidePanel`** (core) is the tab state. Two behaviours are the point of it: opening an
id that is already open focuses and refreshes it **in place** rather than appending a
duplicate or dragging the tab to the end, and closing the active tab activates its **right**
neighbour, falling back to the left one — jumping back to the first tab is the most
irritating thing an editor can do here. `max` evicts the oldest tab that is neither active
nor the one arriving.

**`useResizablePanel`** (core) is a general one-dimensional drag width, not bound to the
right column. It uses pointer capture, so a fast drag out of the window or across an iframe
does not silently stop tracking; it locks `document.body`'s cursor and selection during the
drag, so dragging horizontally does not paint the transcript blue; the handle is a real
`role="separator"` with arrow keys, Shift to accelerate, Home/End and double-click to reset,
because a drag-only handle does not exist as far as a keyboard user is concerned; and
`storageKey` persistence is read in an effect rather than in the initial state — these
components are `'use client'` but Next.js still renders them on the server, and a stored
width in the first render is a guaranteed hydration mismatch.

Only the active tab is mounted, so a background tab cannot go on downloading a video or
polling a log. The trade is that switching away and back remounts; a renderer that must
survive it should hold its state above the panel or in the item's `data`.

Below `lg` the panel floats over the transcript instead of squeezing it, and the drag handle
disappears — a measure that has already given up the sidebar's width cannot also give up
360px and still hold a line of prose. No scrim: reading the document and typing the next
question are the same task.
