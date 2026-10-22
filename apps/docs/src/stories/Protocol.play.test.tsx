import { composeStories } from '@storybook/react'
import { createElement, type ComponentType } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import preview from '../../.storybook/preview'

const storyModules = import.meta.glob('./*.stories.tsx', { eager: true }) as Record<
  string,
  Record<string, unknown>
>
type ComposedStory = ComponentType & {
  play?: (context: unknown) => Promise<void> | void
}

afterEach(cleanup)

describe('Storybook story play functions', () => {
  for (const [modulePath, module] of Object.entries(storyModules)) {
    const stories = composeStories(module as never, preview) as Record<string, ComposedStory>
    const sourceName = modulePath.replace('./', '').replace('.stories.tsx', '')

    for (const [name, story] of Object.entries(stories)) {
      it(`${sourceName}/${name}`, async () => {
        const { container } = render(createElement(story as ComponentType))
        await story.play?.({ canvasElement: container } as never)
      })
    }
  }
})
