---
'@xinjiyuan97/chat-core': minor
'@xinjiyuan97/chat-ui': minor
---

Tool registry, generated-image lifecycle, silent reasoning, and inline-code wrapping.

**`tools` registry on `ChatThemeProvider`.** Per-tool presentation without reimplementing
the row: `label`, `icon`, `runningIcon`, `runningMotion`, `tone`, `compact`, `summary`,
`renderBody`, or `render` for a full takeover. `defineTool()` pins the type at the
declaration site. `toolRenderers` still works and is folded into the same registry; it is
now deprecated in favour of `tools: { name: { render } }`.

**Compact tool calls.** `toolVariant="compact"` on the provider, `compact` on a tool
definition, or `variant="compact"` on `ToolCallPart` renders one log-style line with no
card and no disclosure — the difference between a skimmable list and twenty cards in a
tool-heavy turn.

**Generated media.** `FilePart` gains `id`, `status`, `width`, `height`, `progress` and
`error`; a `file` event carrying an `id` already in the message merges into that part
instead of appending, so a placeholder becomes the finished file in place. The new
`ImagePart` reserves the declared aspect ratio, holds a shimmer until the bitmap actually
decodes, and fades it in — no reflow when the image lands. `ImageSkeleton` is exported for
hosts that render generated images from their own tool renderer.

**Reasoning with no text.** Providers that report only that thinking happened now render a
one-line receipt instead of vanishing. `ReasoningPart` gains `redacted`, and
`reasoning-start` / `reasoning-end` accept the flag from either end of the stream.

**Inline code and long URLs wrap.** Long paths, identifiers and bare URLs no longer push
the message column past its container, and a wrapped inline-code span keeps its background
and corners on every line.

Breaking (types only): `FilePart.url` and the `file` event's `url` are now optional, since
a file being generated has no URL yet. Code reading `part.url` under `strictNullChecks`
needs a guard.
