import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@storybook/test': createRequire(import.meta.url).resolve('@storybook/test', {
        paths: [fileURLToPath(new URL('./node_modules/@storybook/react', import.meta.url))],
      }),
      '@xinjiyuan97/chat-ui/a2ui-registry': resolve('../../packages/ui/src/a2ui-registry/index.ts'),
      '@xinjiyuan97/chat-ui': fileURLToPath(
        new URL('../../packages/ui/src/index.ts', import.meta.url),
      ),
      '@xinjiyuan97/chat-core': resolve('../../packages/core/src/index.ts'),
      '@xinjiyuan97/chat-a2ui': resolve('../../packages/a2ui/src/index.ts'),
    },
  },
  test: {
    include: ['apps/docs/src/stories/Protocol.play.test.tsx'],
    environment: 'jsdom',
    globals: false,
    setupFiles: [resolve('../../vitest.setup.ts')],
    css: false,
    restoreMocks: true,
  },
})
