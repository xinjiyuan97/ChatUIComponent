import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Conversation } from '@xinjiyuan97/chat-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { zhCN as locale } from '../provider/locale'
import { ConversationItem, ConversationItemMenu } from './ConversationItem'

afterEach(cleanup)

const conversation: Conversation = { id: 'conversation-1', title: '测试会话', updatedAt: 0 }

function openMenu() {
  const trigger = screen.getByRole('button', { name: locale.conversationOptions })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  return within(screen.getByRole('menu'))
}

describe('ConversationItem', () => {
  it('omits the menu and its trigger when no actions are provided', () => {
    render(<ConversationItem conversation={conversation} />)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: locale.conversationOptions }),
    ).not.toBeInTheDocument()
  })

  it('opens all three actions and invokes pin without selecting the row', () => {
    const onTogglePin = vi.fn()
    const onSelect = vi.fn()
    render(
      <ConversationItem
        conversation={conversation}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={onTogglePin}
        onSelect={onSelect}
      />,
    )

    const menu = openMenu()
    expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '置顶',
      '重命名',
      '删除',
    ])
    fireEvent.click(menu.getByRole('menuitem', { name: locale.pin }))
    expect(onTogglePin).toHaveBeenCalledTimes(1)
    expect(onTogglePin).toHaveBeenCalledWith(conversation.id)
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: locale.conversationOptions })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('offers only delete and waits for confirmation before invoking it', () => {
    const onDelete = vi.fn()
    render(<ConversationItem conversation={conversation} onDelete={onDelete} />)

    const menu = openMenu()
    expect(menu.getAllByRole('menuitem')).toHaveLength(1)
    fireEvent.click(menu.getByRole('menuitem', { name: '删除' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: locale.delete }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(conversation.id)
  })

  it('offers unpin rather than pin for pinned conversations', () => {
    render(
      <ConversationItem conversation={{ ...conversation, pinned: true }} onTogglePin={vi.fn()} />,
    )

    const menu = openMenu()
    expect(menu.getByRole('menuitem', { name: '取消置顶' })).toBeInTheDocument()
    expect(menu.getAllByRole('menuitem').some((item) => item.textContent === '置顶')).toBe(false)
  })

  it('keeps inline rename functional', () => {
    const onRename = vi.fn()
    render(<ConversationItem conversation={conversation} onRename={onRename} />)

    fireEvent.click(openMenu().getByRole('menuitem', { name: locale.rename }))
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue(conversation.title)
    fireEvent.change(input, { target: { value: '新的标题' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledWith(conversation.id, '新的标题')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('ConversationItemMenu', () => {
  it('renders neither an empty menu nor an overlay when used directly without actions', () => {
    const { container } = render(<ConversationItemMenu onClose={vi.fn()} />)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
