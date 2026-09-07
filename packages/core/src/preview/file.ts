/**
 * What the side panel is asked to preview.
 *
 * Three ways to supply the bytes, and a host gives whichever it already has:
 *
 * - `content` — already in memory. An editor that just wrote the file, a tool result that
 *   came back inline.
 * - `url` — fetched on demand.
 * - `load` — anything else: a signed URL that has to be minted first, a file handle, an
 *   IndexedDB read. Called at most once per mount, and only when the tab is actually shown.
 *
 * None of them is required. A file with only a `name` is still a legitimate thing to open —
 * it renders the fallback page, which is exactly what should happen when an agent mentions
 * a file the host cannot produce.
 */
export type PreviewFile = {
  name: string
  /** Takes precedence over the extension when deciding who renders this. */
  mediaType?: string
  /** Bytes, when known. Used to refuse an over-large file *before* downloading it. */
  size?: number
  url?: string
  content?: string | ArrayBuffer | Blob
  load?: () => Promise<string | ArrayBuffer | Blob>
  /**
   * A stand-in produced somewhere else, for a format nothing in the browser renders
   * faithfully. In practice: a .pptx that a server turned into a PDF or into one image per
   * slide.
   *
   * It is on the file rather than on the renderer because the conversion is the host's
   * business — where it happens, what it costs, whether it is cached — and all this library
   * needs to know is whether the result exists.
   */
  converted?: ConvertedArtifact
}

/** What a host-side conversion produced. */
export type ConvertedArtifact =
  | { kind: 'pdf'; file: PreviewFile }
  /** One entry per page or slide, in order. */
  | { kind: 'images'; pages: PreviewFile[] }

/**
 * A coarse bucket, for the things that need a family rather than a renderer: which icon the
 * file tree draws, and how the fallback page words itself.
 *
 * Deliberately *not* what picks the renderer — that is `resolvePreview` against the
 * registry, so a host can add a format without this union having to learn about it.
 */
export type FileClass =
  | 'pdf'
  | 'image'
  | 'markdown'
  | 'html'
  | 'text'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'archive'
  | 'audio'
  | 'video'
  | 'unknown'

/**
 * The last extension, lower-cased and without the dot.
 *
 * `'a.tar.gz'` gives `'gz'`, not `'tar.gz'`: compound extensions are a naming convention,
 * not a format, and the registry keys on single ones. A leading dot is a hidden file rather
 * than an extension, so `'.gitignore'` gives `''`.
 */
export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  // Strip a query string or fragment: names are often just the tail of a URL.
  const clean = base.split(/[?#]/)[0] ?? ''
  const dot = clean.lastIndexOf('.')
  if (dot <= 0) return ''
  return clean.slice(dot + 1).toLowerCase()
}

/** Strips parameters and case from a MIME string: `'Text/HTML; charset=utf-8'` → `'text/html'`. */
export function normalizeMediaType(mediaType: string | undefined): string {
  return (mediaType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
}

const EXTENSION_CLASSES: Record<string, FileClass> = {
  pdf: 'pdf',

  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  bmp: 'image',
  ico: 'image',
  svg: 'image',

  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',

  html: 'html',
  htm: 'html',

  doc: 'word',
  docx: 'word',
  rtf: 'word',

  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  tsv: 'excel',

  ppt: 'ppt',
  pptx: 'ppt',

  zip: 'archive',
  gz: 'archive',
  tar: 'archive',
  rar: 'archive',
  '7z': 'archive',
}

const MEDIA_TYPE_CLASSES: Record<string, FileClass> = {
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/html': 'html',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'text/csv': 'excel',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'application/json': 'text',
  'application/xml': 'text',
  'application/zip': 'archive',
}

/**
 * Which family a file belongs to.
 *
 * `mediaType` wins over the extension when both are present. A server that bothered to
 * label its response knows more than a name that may have been chosen by a model.
 */
export function classifyFile(file: Pick<PreviewFile, 'name' | 'mediaType'>): FileClass {
  const media = normalizeMediaType(file.mediaType)
  if (media) {
    const exact = MEDIA_TYPE_CLASSES[media]
    if (exact) return exact
    if (media.startsWith('image/')) return 'image'
    if (media.startsWith('audio/')) return 'audio'
    if (media.startsWith('video/')) return 'video'
    // Everything else under `text/` is readable as text even if we have never heard of it.
    if (media.startsWith('text/')) return 'text'
  }

  const extension = fileExtension(file.name)
  const byExtension = EXTENSION_CLASSES[extension]
  if (byExtension) return byExtension

  /* Unknown rather than a guess at text. Deciding that an unrecognised extension is text
   * here would mean handing a 40MB binary to a syntax highlighter; the code preview claims
   * its own extensions through the registry, where the highlighter's language list already
   * lives. */
  return 'unknown'
}

/**
 * Why a preview is not showing the file.
 *
 * Kept as a closed union because the fallback page says something different for each one,
 * and "无法预览" with no reason is the least useful thing a viewer can print. None of these
 * is an agent error — see `UnsupportedPreview`, they are all drawn in neutral grey.
 */
export type PreviewFailure =
  /** Nothing in the registry claims this extension or media type. */
  | 'unsupported-type'
  /** A renderer exists but its optional peer dependency is not installed. */
  | 'renderer-missing'
  /** The renderer needs something from the host that was not supplied — a PDF worker URL. */
  | 'needs-config'
  /** Over the byte cap, refused before or after download. */
  | 'too-large'
  /** The bytes could not be obtained: network, 404, aborted. */
  | 'fetch-failed'
  /** The bytes arrived but the renderer could not make sense of them. */
  | 'render-failed'
  /** A ppt with no host-converted PDF or page images to show. */
  | 'converted-artifact-missing'
