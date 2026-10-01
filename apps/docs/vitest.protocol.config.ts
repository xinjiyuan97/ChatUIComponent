import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vitest/config'
import base from '../../vitest.config'

export default mergeConfig(base, {
  resolve: {
    alias: {
      '@storybook/test': createRequire(import.meta.url).resolve('@storybook/test', {
        paths: [fileURLToPath(new URL('./node_modules/@storybook/react', import.meta.url))],
      }),
      '@xinjiyuan97/chat-ui': fileURLToPath(
        new URL('../../packages/ui/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['apps/docs/src/stories/Protocol.play.test.tsx'],
  },
})
