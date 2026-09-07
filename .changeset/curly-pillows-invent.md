---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

File preview for the side panel: a second registry, eight renderers, a file tree, and a
fallback page that says what is actually wrong.

**The registry is a second layer, not more entries in the first one.** `SidePanel` indexes by
`kind`; file preview is one such kind. Teaching that registry about `.xlsx` would make the
right column — which is meant to hold a diff, a run log or a settings pane later — permanently
a file viewer. So `previews` is its own registry, indexed by file type, hanging off the `file`
kind: `SidePanel` → `filePreviewPanel` → `previews` → a renderer, or `UnsupportedPreview` when
nothing matches. Hosts extend either layer independently.

Matching is declarative — `extensions` and `mediaTypes`, with `image/*` wildcards — rather than
a `match(file) => boolean` predicate. A predicate cannot be ordered, cannot explain why it won,
and cannot be turned into the supported-formats table in the README. **Host registrations beat
built-ins**, so overriding our Markdown renderer is one `definePreview` with `extensions: ['md']`
and no deregistration step. The tree takes its file icons from the same registry, so a new
format is not a second list to maintain.

**Renderers.** PDF (`pdfjs-dist`) with paging, typed page jump, zoom, fit-width, and only the
pages near the viewport rendered — a canvas that scrolls away has its backing store released,
because forty retained page bitmaps is hundreds of megabytes. Images with pointer-anchored wheel
zoom, drag pan and double-click reset. Markdown and HTML with a rendered/source switch. Text and
code through the same Shiki highlighter the message fences use, so its ~90 languages arrive for
free and stay in sync. Word (`docx-preview`) with prefixed containers so its stylesheet cannot
leak into the host. Excel (`exceljs`) parsed only — the grid is ours, drawn in tokens, with sheet
tabs, a frozen header row, `numFmt`-aware cell text and a row cap.

**We do not parse `.pptx`.** A deck is absolutely-positioned shapes, theme inheritance, embedded
fonts and SmartArt; no front-end renderer reaches acceptable fidelity, and text silently landing
outside the shape it belongs to is worse than not rendering, because the reader cannot tell which
kind of output they are looking at. The contract is explicit instead: hand us `file.converted`
(a server-converted PDF or page images) and it renders; otherwise the fallback page says a
server-side conversion is needed.

**PDF needs `pdfWorkerSrc` from the host.** Only your bundler knows where the worker file lands.
We do not guess and do not reach for a CDN: an offline deployment would fail silently, and a
version skew between worker and API produces errors nobody can self-diagnose. Missing worker is
the `needs-config` fallback with copy-pasteable Vite and Next snippets.

**HTML renders in `<iframe srcdoc sandbox="">` with no `allow-scripts`** — no scripts,
no `javascript:`, no form submission, no top-level navigation, an opaque origin. Hence no
DOMPurify: a sanitiser is a denylist that has to keep pace with new bypasses, while the sandbox
is an engine-level capability switch. The cost is that a scripted document renders as its static
version, which is the right trade for a preview pane.

**The fallback page names the cause.** Seven reasons — unsupported type, missing optional
renderer, missing PDF worker, over the size cap, fetch failed, parse failed, missing converted
artefact — each with its own sentence and its own buttons, because "cannot preview" throws away
the only useful part: one is a `pnpm add`, one is a prop, one is "download it instead". None of
them is drawn in danger red. Same call as `ImagePart`: red means the agent failed at something,
and a library that does not render Photoshop files has not failed.

**`FileTree` + `folderPanel`** put a folder in the panel and open a file on selection. One tab
stop for the whole tree with roving `tabIndex`; navigation walks the _rendered_ rows, so the
cursor cannot end up inside a subtree you just collapsed. Indentation is `padding-inline-start`
on the row rather than nested-list margins, so a long name in a deep path still gets the full row
width. Directories can load on expand.

**New in core:** `useFileContent` (one state machine over `content` / `url` / `load`, with byte
caps checked before _and_ after download, and in-flight requests aborted on file switch),
`useFileTree` (flattened visible rows plus the WAI-ARIA tree key map) and `useImageZoom`
(anchored zoom, pan, fit).

**`SidePanel` now scrolls the active tab into view.** The strip scrolls horizontally with its
scrollbar hidden, so the fourth artefact an agent opened landed past the right edge: the panel's
contents changed and nothing in the strip moved, which reads as a click that did nothing. Rect
arithmetic on the strip rather than `scrollIntoView`, which is free to scroll every scrollable
ancestor — and the transcript beside the panel is one of them.

One operational note, and it applies to `mermaid` as much as to the three new peers: the
renderers use statically analysable `import('exceljs')`, so a bundler that cannot resolve the
specifier fails the build rather than warning. If you do not install one, mark it external —
one line, documented in the README. With that line the build passes, the import fails at
runtime, and the fallback page appears with a clean console.
