import { createElement, type ComponentType } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, it } from 'vitest'
import * as stories from './Protocol.stories'

afterEach(cleanup)

describe('Protocol story play functions', () => {
  for (const [name, story] of Object.entries(stories)) {
    if (!('render' in story) || !('play' in story) || !story.render || !story.play) continue
    it(name, async () => {
      const { container } = render(createElement(story.render as ComponentType))
      await story.play?.({ canvasElement: container } as never)
    })
  }
})
