import { useEffect, type ReactNode } from 'react'
import type { Decorator, Preview } from '@storybook/react'

import { ChatThemeProvider } from '@agent-chat/ui'
import { defaultA2UIRegistry } from '@agent-chat/ui/a2ui-registry'

import '../src/styles.css'

/**
 * The theme is a single class on `<html>` — that is the whole dark-mode story for this
 * library, and the toolbar exercises exactly the switch a consumer would write.
 */
function ThemeSync({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return children
}

const withTheme: Decorator = (Story, context) => (
  <ThemeSync theme={context.globals['theme'] as 'light' | 'dark'}>
    <Story />
  </ThemeSync>
)

const withChatTheme: Decorator = (Story, context) => (
  <ChatThemeProvider
    locale={context.globals['locale'] as 'zh-CN' | 'en-US'}
    density={context.globals['density'] as 'comfortable' | 'compact'}
    a2uiRegistry={defaultA2UIRegistry}
    asFragment
  >
    <Story />
  </ChatThemeProvider>
)

const preview: Preview = {
  parameters: {
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    backgrounds: { disable: true },
    layout: 'padded',
    a11y: { config: { rules: [] } },
    options: {
      storySort: {
        order: [
          'Overview',
          'Chat',
          [
            'End to End',
            'Message',
            'Parts',
            'Permission',
            'Todo',
            'Markdown',
            'Composer',
            'Reactions',
          ],
          'Conversations',
          'A2UI',
          'Foundations',
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Vertical rhythm',
      defaultValue: 'comfortable',
      toolbar: {
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Interface language',
      defaultValue: 'zh-CN',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'zh-CN', title: '中文' },
          { value: 'en-US', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withChatTheme, withTheme],
}

export default preview
