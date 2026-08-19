import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  /* No `treeshake`: tsup's Rollup pass strips the `"use client"` banner below ("Module level
   * directives cause errors when bundled"). esbuild's own tree-shaking is enough here. */
  external: ['react'],
  // Everything here touches hooks/state, so the whole bundle is client-only.
  banner: { js: '"use client";' },
})
