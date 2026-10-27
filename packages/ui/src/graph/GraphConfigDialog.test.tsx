import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentGraphNode } from '@xinjiyuan97/chat-core'
import { GraphConfigDialog } from './GraphConfigDialog'
import { graphLocales } from './locale'

const node: AgentGraphNode = {
  id: 'llm',
  kind: 'operator',
  operator: { type: 'agent.model', version: 1, config: { model: 'primary', timeout_ms: 60000 } },
}
const labels = graphLocales['zh-CN']
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open')
    },
  })
})
afterAll(() => {
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

describe('GraphConfigDialog', () => {
  it('shows read-only config when no save callback is supplied', () => {
    render(<GraphConfigDialog node={node} labels={labels} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('配置 · llm')
    expect(screen.getByText('primary')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存配置' })).not.toBeInTheDocument()
  })
  it.each(['{', '[]', 'null', '42'])(
    'rejects invalid config %s before calling the host',
    async (value) => {
      const onSave = vi.fn()
      render(<GraphConfigDialog node={node} labels={labels} onSave={onSave} onClose={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value } })
      await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
      expect(screen.getByRole('alert')).toHaveTextContent(
        value === '{' ? labels.invalidJson : labels.configObject,
      )
      expect(onSave).not.toHaveBeenCalled()
    },
  )
  it('waits for host persistence, blocks duplicate saves and dismissal, then closes', async () => {
    let finish!: () => void
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const onClose = vi.fn()
    render(<GraphConfigDialog node={node} labels={labels} onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"model":"other"}' } })
    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith({
      nodeId: 'llm',
      kind: 'operator',
      config: { model: 'other' },
    })
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onClose).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(node.operator?.config.model).toBe('primary')
  })
  it('keeps the draft on host failure and allows retry', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('Host validation failed'))
      .mockResolvedValueOnce(undefined)
    const onClose = vi.fn()
    render(<GraphConfigDialog node={node} labels={labels} onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"timeout_ms":1000}' } })
    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Host validation failed')
    expect(screen.getByRole('textbox')).toHaveValue('{"timeout_ms":1000}')
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
  it('identifies trigger updates and restores focus when unmounted', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onSave = vi.fn()
    const { unmount } = render(
      <GraphConfigDialog
        node={{
          id: 'start',
          kind: 'trigger',
          trigger: { type: 'manual', version: 1, event: 'agent.start.v1', config: {} },
        }}
        labels={labels}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"key":true}' } })
    await userEvent.click(screen.getByRole('button', { name: '保存配置' }))
    expect(onSave).toHaveBeenCalledWith({ nodeId: 'start', kind: 'trigger', config: { key: true } })
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
