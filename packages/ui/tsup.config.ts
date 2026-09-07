import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'a2ui-registry': 'src/a2ui-registry/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  /* No `treeshake`: tsup's Rollup pass strips the `"use client"` banner below. */
  /* The optional peers are listed here so their dynamic imports stay imports in the output:
   * a consumer who never installs `pdfjs-dist` never resolves it either, and the preview
   * falls back to its "install this to preview PDFs" page instead of failing to build. */
  external: [
    'react',
    'react-dom',
    'mermaid',
    'pdfjs-dist',
    'docx-preview',
    'exceljs',
    '@xinjiyuan97/chat-core',
    '@xinjiyuan97/chat-a2ui',
  ],
  // Everything renders interactively; marking the whole bundle keeps Next.js App Router
  // consumers from having to wrap each import themselves.
  banner: { js: '"use client";' },
})
