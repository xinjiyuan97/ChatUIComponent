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
  /* `mermaid` is an optional peer: listing it here keeps the dynamic import in the output
   * as an import, so a consumer who never installs it never resolves it either. */
  external: ['react', 'react-dom', 'mermaid', '@xinjiyuan97/core', '@xinjiyuan97/a2ui'],
  // Everything renders interactively; marking the whole bundle keeps Next.js App Router
  // consumers from having to wrap each import themselves.
  banner: { js: '"use client";' },
})
