import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  /* No `treeshake`: tsup's Rollup pass strips the `"use client"` banner below. */
  external: ['react', 'react-dom', '@agent-chat/core'],
  banner: { js: '"use client";' },
})
