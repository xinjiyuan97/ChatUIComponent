'use client'

import { fileExtension, normalizeMediaType, type PreviewFile } from '@xinjiyuan97/chat-core'
import type { ComponentType } from 'react'

import type { PanelGlyph } from './panels'

export type PreviewRenderProps = {
  file: PreviewFile
  /** Closes the surrounding panel tab, for a preview that finds its file is gone. */
  close: () => void
}

/**
 * How one family of files is drawn.
 *
 * This is the *second* registry, layered under `panels`. `panels` is keyed by an opaque
 * `kind` and knows nothing about files; one of those kinds is the file preview, and this is
 * what it dispatches on. Keeping them apart is what lets the right-hand column hold a diff
 * or a run log without either concept leaking into the other.
 */
export type PreviewDefinition = {
  /** Extensions claimed, lower-case and without the dot. */
  extensions?: string[]
  /** Media types claimed. `'image/*'` matches a whole family. */
  mediaTypes?: string[]
  /** Shown on the panel tab and in the file tree. */
  icon?: PanelGlyph
  render: ComponentType<PreviewRenderProps>
  /**
   * Padding around the content. Off by default here, the opposite of `PanelDefinition`:
   * a viewer normally brings its own toolbar and wants the full width for the document.
   */
  padded?: boolean
}

/** What the provider holds. Keys are arbitrary names, used only for overriding an entry. */
export type PreviewRegistry = Record<string, PreviewDefinition>

/**
 * Identity, for the same reason `defineTool` and `definePanel` exist: it pins the object's
 * type where it is written, so a typo lands on the offending field instead of at the
 * registration site.
 */
export function definePreview(definition: PreviewDefinition): PreviewDefinition {
  return definition
}

/**
 * Picks the renderer for a file.
 *
 * The order is the whole contract, and it exists so that "how do I add my own preview type"
 * has a one-line answer:
 *
 * 1. a host entry claiming this exact media type
 * 2. a host entry claiming this extension
 * 3. a host entry claiming this media type by wildcard
 * 4. the built-ins, in the same three passes
 *
 * **A host registration always beats a built-in.** Replacing our markdown viewer with your
 * own is `previews={{ md: definePreview({ extensions: ['md'], render: Yours }) }}` — there
 * is nothing to unregister first.
 *
 * Matching is declarative — `extensions` and `mediaTypes`, not `match(file) => boolean` —
 * because a predicate cannot be ordered, cannot explain why it won, and cannot be turned
 * into the table of supported formats in the README.
 */
export function resolvePreview(
  file: Pick<PreviewFile, 'name' | 'mediaType'>,
  host: PreviewRegistry,
  builtin: PreviewRegistry,
): PreviewDefinition | undefined {
  const media = normalizeMediaType(file.mediaType)
  const extension = fileExtension(file.name)

  for (const registry of [host, builtin]) {
    const entries = Object.values(registry)

    if (media) {
      const exact = entries.find((entry) => entry.mediaTypes?.includes(media))
      if (exact) return exact
    }

    if (extension) {
      const byExtension = entries.find((entry) => entry.extensions?.includes(extension))
      if (byExtension) return byExtension
    }

    if (media) {
      const family = `${media.split('/')[0]}/*`
      const wildcard = entries.find((entry) => entry.mediaTypes?.includes(family))
      if (wildcard) return wildcard
    }
  }

  return undefined
}
