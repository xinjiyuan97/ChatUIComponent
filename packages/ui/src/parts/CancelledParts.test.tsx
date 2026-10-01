import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatThemeProvider } from '../provider/ChatThemeProvider'
import { ReasoningPart } from './ReasoningPart'
import { ToolCallPart } from './ToolCallPart'
import { FilePart } from './FilePart'
import { ImagePart } from './ImagePart'

describe('cancelled parts', () => {
  it.each(['zh-CN', 'en-US'] as const)(
    'shows cancellation without progress or failure in %s',
    (locale) => {
      const { container } = render(
        <ChatThemeProvider locale={locale}>
          <ReasoningPart part={{ type: 'reasoning', text: '', cancelled: true }} streaming />
          <ToolCallPart
            part={{
              type: 'tool',
              toolCallId: 'flag',
              name: 'flag',
              state: 'executing',
              cancelled: true,
            }}
            message={{ id: 'm', role: 'assistant', parts: [] }}
          />
          <ToolCallPart
            part={{ type: 'tool', toolCallId: 'state', name: 'state', state: 'cancelled' }}
            message={{ id: 'm', role: 'assistant', parts: [] }}
          />
          <FilePart part={{ type: 'file', mediaType: 'text/plain', status: 'cancelled' }} />
          <FilePart
            part={{ type: 'file', mediaType: 'image/png', status: 'generating', cancelled: true }}
          />
          <ImagePart part={{ type: 'file', mediaType: 'image/png', status: 'cancelled' }} />
        </ChatThemeProvider>,
      )
      expect(screen.getAllByText(locale === 'zh-CN' ? '已取消' : 'Cancelled')).toHaveLength(6)
      expect(
        container.querySelector('[aria-busy="true"], .animate-cc-spin, .animate-cc-pulse'),
      ).toBeNull()
      expect(screen.queryByText(locale === 'zh-CN' ? '失败' : 'Failed')).toBeNull()
    },
  )
})
