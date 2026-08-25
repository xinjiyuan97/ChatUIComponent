import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    /* Tests run against sources, matching the tsconfig `paths` mapping, so a change in
     * core is picked up by ui's tests without an intervening build. */
    alias: {
      '@xinjiyuan97/core': resolve('./packages/core/src/index.ts'),
      '@xinjiyuan97/a2ui': resolve('./packages/a2ui/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: [resolve('./vitest.setup.ts')],
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
})
