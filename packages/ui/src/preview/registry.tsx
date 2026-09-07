'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'

import { DocumentIcon, FileIcon, ImageIcon, SlidesIcon, TableIcon } from '../icons'
import { useChatTheme } from '../provider/ChatThemeProvider'
import {
  definePreview,
  resolvePreview,
  type PreviewDefinition,
  type PreviewRegistry,
} from '../provider/previews'
import { ExcelPreview } from './ExcelPreview'
import { HtmlFilePreview } from './HtmlPreview'
import { ImageFilePreview } from './ImagePreview'
import { MarkdownFilePreview } from './MarkdownPreview'
import { PdfPreview } from './PdfPreview'
import { SlidesPreview } from './SlidesPreview'
import { TextFilePreview } from './TextPreview'
import { WordPreview } from './WordPreview'

/**
 * Extensions the text viewer claims.
 *
 * Long, and deliberately so — this list is the difference between "the panel opens your
 * source files" and "the panel opens the six extensions we happened to think of". It is not
 * the same list as the highlighter's: claiming a file only decides that it is *text*, and
 * one without a grammar renders uncoloured rather than falling through to the fallback page.
 */
const TEXT_EXTENSIONS = [
  // plain
  'txt',
  'log',
  'text',
  'csv',
  'tsv',
  // web
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'mts',
  'cts',
  'css',
  'scss',
  'less',
  'vue',
  'svelte',
  // data and config
  'json',
  'jsonc',
  'json5',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'cfg',
  'env',
  'properties',
  'xml',
  'svg',
  'graphql',
  'gql',
  'proto',
  'lock',
  // languages
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'lua',
  'r',
  'scala',
  'dart',
  'sql',
  'pl',
  'ex',
  'exs',
  'erl',
  'hs',
  'clj',
  'zig',
  // shells and tooling
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'make',
  'mk',
  'dockerfile',
  'diff',
  'patch',
]

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']

/**
 * What this library previews out of the box.
 *
 * A host reaches these through the provider and never has to import them by hand; the reason
 * they are exported is so a host can pick one out (`BUILTIN_PREVIEWS.markdown.render`) to
 * reuse inside its own definition, or replace the whole map.
 *
 * Every entry that needs an optional peer degrades to the fallback page when it is not
 * installed, so this map is safe to ship whole regardless of what the host has.
 */
export const BUILTIN_PREVIEWS: PreviewRegistry = {
  pdf: definePreview({
    extensions: ['pdf'],
    mediaTypes: ['application/pdf'],
    icon: DocumentIcon,
    render: ({ file }) => <PdfPreview file={file} />,
  }),

  image: definePreview({
    extensions: IMAGE_EXTENSIONS,
    mediaTypes: ['image/*'],
    icon: ImageIcon,
    render: ({ file }) => <ImageFilePreview file={file} />,
  }),

  markdown: definePreview({
    extensions: ['md', 'markdown', 'mdx'],
    mediaTypes: ['text/markdown'],
    icon: FileIcon,
    render: ({ file }) => <MarkdownFilePreview file={file} />,
  }),

  html: definePreview({
    extensions: ['html', 'htm'],
    mediaTypes: ['text/html'],
    icon: FileIcon,
    render: ({ file }) => <HtmlFilePreview file={file} />,
  }),

  word: definePreview({
    extensions: ['docx'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    icon: DocumentIcon,
    render: ({ file }) => <WordPreview file={file} />,
  }),

  excel: definePreview({
    extensions: ['xlsx', 'xlsm'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    icon: TableIcon,
    render: ({ file }) => <ExcelPreview file={file} />,
  }),

  slides: definePreview({
    extensions: ['pptx', 'ppt'],
    mediaTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    icon: SlidesIcon,
    render: ({ file }) => <SlidesPreview file={file} />,
  }),

  /* The catch-all. Its `text/*` cannot swallow `text/markdown` or `text/html`, because
   * `resolvePreview` runs every exact media type and every extension before it looks at a
   * wildcard — which is the reason the wildcard pass is last rather than a matter of where
   * this entry sits in the map. */
  text: definePreview({
    extensions: TEXT_EXTENSIONS,
    mediaTypes: ['text/*', 'application/json', 'application/xml', 'application/x-yaml'],
    icon: FileIcon,
    render: ({ file }) => <TextFilePreview file={file} />,
  }),
}

/** The merged view: what the host registered, with the built-ins behind it. */
export function usePreviewRegistry(): { host: PreviewRegistry; builtin: PreviewRegistry } {
  const { previews } = useChatTheme()
  return { host: previews, builtin: BUILTIN_PREVIEWS }
}

/**
 * The definition that will render `file`, or `undefined` for the fallback page.
 *
 * Lives here rather than beside `usePanelDefinition` in the provider because the built-in
 * map imports the viewers, and the viewers import the provider — putting this in
 * `ChatThemeProvider` would close that loop.
 */
export function usePreviewDefinition(
  file: Pick<PreviewFile, 'name' | 'mediaType'> | undefined,
): PreviewDefinition | undefined {
  const { host, builtin } = usePreviewRegistry()
  return file ? resolvePreview(file, host, builtin) : undefined
}
