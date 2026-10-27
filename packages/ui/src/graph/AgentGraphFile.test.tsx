import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentGraphDefinition } from '@xinjiyuan97/chat-core'
import { AgentGraphFile } from './AgentGraphFile'

vi.mock('./AgentGraph', () => ({
  AgentGraph: ({ definition }: { definition: AgentGraphDefinition }) => (
    <div data-testid="graph">{definition.name}</div>
  ),
}))
const definition: AgentGraphDefinition = {
  schema_version: 1,
  name: 'imported',
  operators: { llm: { type: 'app.model', version: 1, config: {} } },
  subscriptions: [{ id: 'start', from: '$input', subscriber: 'llm', events: ['agent.start.v1'] }],
  lifecycle: {
    start: { event: 'agent.start.v1' },
    terminal: { from: 'llm', completed: 'done.v1', failed: 'failed.v1', cancelled: 'cancelled.v1' },
  },
  limits: { timeout_ms: 1000, max_deliveries: 10 },
}
function file(name: string, text: () => Promise<string>) {
  const result = new File(['source'], name, { type: 'application/yaml' })
  Object.defineProperty(result, 'text', { value: text })
  return result
}
const choose = (files: File[]) =>
  fireEvent.change(screen.getByLabelText('选择文件', { selector: 'input' }), { target: { files } })

describe('AgentGraphFile', () => {
  it('renders parsed files and notifies the host', async () => {
    const onImport = vi.fn()
    render(<AgentGraphFile onImport={onImport} />)
    const source = file('graph.yaml', async () => JSON.stringify(definition))
    choose([source])
    expect(await screen.findByTestId('graph')).toHaveTextContent('imported')
    expect(onImport).toHaveBeenCalledWith(definition, source)
    expect(screen.getByRole('status')).toHaveTextContent('graph.yaml')
  })
  it('retains the existing graph on invalid input and accepts a corrected retry', async () => {
    render(<AgentGraphFile defaultDefinition={definition} />)
    choose([file('bad.yaml', async () => 'name: [broken')])
    expect(await screen.findByRole('alert')).toHaveTextContent('导入失败')
    expect(screen.getByTestId('graph')).toHaveTextContent('imported')
    choose([file('bad.yaml', async () => JSON.stringify({ ...definition, name: 'fixed' }))])
    await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('fixed'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('only applies the newest file read', async () => {
    let resolve!: (text: string) => void
    render(<AgentGraphFile />)
    choose([
      file(
        'slow.yaml',
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    ])
    choose([file('new.yaml', async () => JSON.stringify({ ...definition, name: 'newest' }))])
    expect(await screen.findByTestId('graph')).toHaveTextContent('newest')
    resolve(JSON.stringify({ ...definition, name: 'stale' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('new.yaml'))
    expect(screen.getByTestId('graph')).toHaveTextContent('newest')
  })
  it('keeps the controlled definition until the host updates it', async () => {
    const onImport = vi.fn()
    const { rerender } = render(<AgentGraphFile definition={definition} onImport={onImport} />)
    const next = { ...definition, name: 'next' }
    choose([file('next.json', async () => JSON.stringify(next))])
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(screen.getByTestId('graph')).toHaveTextContent('imported')
    rerender(<AgentGraphFile definition={next} onImport={onImport} />)
    expect(screen.getByTestId('graph')).toHaveTextContent('next')
  })
  it('rejects multiple files or unsupported extensions without reading them', async () => {
    const text = vi.fn(async () => '')
    render(<AgentGraphFile />)
    choose([file('a.yaml', text), file('b.yaml', text)])
    expect(screen.getByRole('alert')).toHaveTextContent('一次导入一个')
    choose([file('a.exe', text)])
    expect(screen.getByRole('alert')).toHaveTextContent('.yaml')
    expect(text).not.toHaveBeenCalled()
  })
  it('reports a rejected import callback without replacing the graph', async () => {
    render(
      <AgentGraphFile
        defaultDefinition={definition}
        onImport={() => {
          throw new Error('Import rejected')
        }}
      />,
    )
    choose([file('next.yaml', async () => JSON.stringify({ ...definition, name: 'next' }))])
    expect(await screen.findByRole('alert')).toHaveTextContent('Import rejected')
    expect(screen.getByTestId('graph')).toHaveTextContent('imported')
  })
})
