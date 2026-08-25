import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import type { StorybookConfig } from '@storybook/react-vite'

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    // The prop tables come from the actual types, which is the whole point of having them.
    reactDocgen: 'react-docgen-typescript',
  },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()]

    /* Point at sources, not `dist`. Editing a component updates the story through HMR
     * without a rebuild, and Tailwind sees the class names in their original files. */
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@xinjiyuan97/core': fromHere('../../../packages/core/src/index.ts'),
        '@xinjiyuan97/a2ui': fromHere('../../../packages/a2ui/src/index.ts'),
        '@xinjiyuan97/ui/a2ui-registry': fromHere(
          '../../../packages/ui/src/a2ui-registry/index.ts',
        ),
        '@xinjiyuan97/ui': fromHere('../../../packages/ui/src/index.ts'),
      },
    }

    return viteConfig
  },
}

export default config
