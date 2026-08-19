import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { A2UIRenderer } from './A2UIRenderer'
import type { A2UIAction, A2UIComponentProps, A2UINode, A2UIRegistry } from './types'

/** A registry small enough to reason about, exercising props, children and actions. */
const registry: A2UIRegistry = {
  Box: ({ children }: A2UIComponentProps) => <div data-testid="box">{children}</div>,
  Label: ({ props, children }: A2UIComponentProps) => (
    <span data-testid="label" data-href={String(props['href'] ?? '')}>
      {String(props['text'] ?? '')}
      {children}
    </span>
  ),
  Action: ({ props, ctx }: A2UIComponentProps) => (
    <button type="button" onClick={() => ctx.emit(props['onClick'])}>
      {String(props['label'] ?? 'go')}
    </button>
  ),
  Text: ({ props, ctx }: A2UIComponentProps) => (
    <input
      aria-label={String(props['name'])}
      value={String(ctx.values[String(props['name'])] ?? '')}
      onChange={(event) => ctx.setValue(String(props['name']), event.target.value)}
    />
  ),
}

/** Builds a linear tree `depth` levels deep. */
function nest(depth: number): A2UINode {
  let node: A2UINode = { type: 'Label', props: { text: 'leaf' } }
  for (let i = 0; i < depth; i++) node = { type: 'Box', children: [node] }
  return node
}

function setup(spec: A2UINode | null, overrides: Partial<Parameters<typeof A2UIRenderer>[0]> = {}) {
  return render(<A2UIRenderer spec={spec} registry={registry} {...overrides} />)
}

describe('A2UIRenderer', () => {
  it('renders nothing for a null spec', () => {
    const { container } = setup(null)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a nested tree', () => {
    setup({ type: 'Box', children: [{ type: 'Label', props: { text: 'hello' } }] })
    expect(screen.getByTestId('label')).toHaveTextContent('hello')
  })

  it('renders string children', () => {
    setup({ type: 'Label', children: 'inline text' })
    expect(screen.getByTestId('label')).toHaveTextContent('inline text')
  })

  it('substitutes templates from data', () => {
    setup(
      { type: 'Label', props: { text: 'Hi {{user.name}}' } },
      { data: { user: { name: 'Ada' } } },
    )
    expect(screen.getByTestId('label')).toHaveTextContent('Hi Ada')
  })

  it('hides a node whose `when` is false', () => {
    setup(
      {
        type: 'Box',
        children: [
          { type: 'Label', props: { text: 'visible' }, when: 'ok' },
          { type: 'Label', props: { text: 'hidden' }, when: '!ok' },
        ],
      },
      { data: { ok: true } },
    )
    expect(screen.getByText('visible')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('renders the fallback for an unregistered type instead of throwing', () => {
    setup({ type: 'MysteryChart' }, { renderUnknown: (node) => <em>unknown: {node.type}</em> })
    expect(screen.getByText(/unknown: MysteryChart/)).toBeInTheDocument()
  })

  it('renders nothing for an unregistered type with no fallback', () => {
    const { container } = setup({ type: 'MysteryChart' })
    expect(container).toBeEmptyDOMElement()
  })

  it('ignores a malformed node', () => {
    const { container } = setup({ notAType: true } as unknown as A2UINode)
    expect(container).toBeEmptyDOMElement()
  })

  it('stops at the node budget and reports the truncation', () => {
    const children = Array.from({ length: 20 }, (_, i) => ({
      type: 'Label' as const,
      props: { text: `item ${i}` },
    }))

    setup(
      { type: 'Box', children },
      {
        limits: { maxNodes: 5 },
        renderTruncated: (reason) => <p>truncated: {reason}</p>,
      },
    )

    // 1 Box + 4 labels, then the budget is spent.
    expect(screen.getAllByTestId('label')).toHaveLength(4)
    expect(screen.getByText('truncated: nodes')).toBeInTheDocument()
  })

  it('stops at the depth budget and reports the truncation', () => {
    setup(nest(30), {
      limits: { maxDepth: 3 },
      renderTruncated: (reason) => <p>truncated: {reason}</p>,
    })

    expect(screen.getByText('truncated: depth')).toBeInTheDocument()
    expect(screen.queryByTestId('label')).not.toBeInTheDocument()
  })

  it('renders a spec that fits inside both budgets untouched', () => {
    setup(nest(3), {
      limits: { maxNodes: 500, maxDepth: 20 },
      renderTruncated: (reason) => <p>truncated: {reason}</p>,
    })
    expect(screen.getByTestId('label')).toBeInTheDocument()
    expect(screen.queryByText(/truncated/)).not.toBeInTheDocument()
  })

  it('strips a javascript: URL before the component sees it', () => {
    setup({ type: 'Label', props: { text: 'x', href: 'javascript:alert(1)' } })
    expect(screen.getByTestId('label')).toHaveAttribute('data-href', '')
  })

  it('emits an action with the surface id', () => {
    const onAction = vi.fn()
    setup(
      {
        type: 'Action',
        props: { label: 'Confirm', onClick: { action: 'confirm', payload: { id: 7 } } },
      },
      { onAction, surfaceId: 'surface-1' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onAction).toHaveBeenCalledWith<[A2UIAction]>({
      action: 'confirm',
      payload: { id: 7 },
      formData: {},
      surfaceId: 'surface-1',
      resolve: true,
    })
  })

  it('does not emit for a string handler', () => {
    const onAction = vi.fn()
    setup({ type: 'Action', props: { onClick: 'alert(1)' } }, { onAction })

    fireEvent.click(screen.getByRole('button'))
    expect(onAction).not.toHaveBeenCalled()
  })

  it('submits the whole surface form state with an action', () => {
    const onAction = vi.fn()
    setup(
      {
        type: 'Box',
        children: [
          { type: 'Text', props: { name: 'email' } },
          { type: 'Text', props: { name: 'note' } },
          { type: 'Action', props: { label: 'Send', onClick: { action: 'submit' } } },
        ],
      },
      { onAction },
    )

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('note'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    // One round trip for the whole form is the point: the agent never syncs field by field.
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ formData: { email: 'a@b.com', note: 'hi' } }),
    )
  })

  it('omits form data when the descriptor opts out', () => {
    const onAction = vi.fn()
    setup(
      {
        type: 'Box',
        children: [
          { type: 'Text', props: { name: 'email' } },
          {
            type: 'Action',
            props: { label: 'Send', onClick: { action: 'submit', includeFormData: false } },
          },
        ],
      },
      { onAction },
    )

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ formData: {} }))
  })

  it('exposes live form values to templates', () => {
    setup({
      type: 'Box',
      children: [
        { type: 'Text', props: { name: 'email' } },
        { type: 'Label', props: { text: 'you typed {{values.email}}' } },
      ],
    })

    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x@y.z' } })
    expect(screen.getByTestId('label')).toHaveTextContent('you typed x@y.z')
  })

  it('marks the surface disabled for its components', () => {
    const Probe = ({ ctx }: A2UIComponentProps) => <span>{ctx.disabled ? 'locked' : 'open'}</span>
    render(<A2UIRenderer spec={{ type: 'Probe' }} registry={{ Probe }} disabled />)
    expect(screen.getByText('locked')).toBeInTheDocument()
  })

  it('contains a component that throws instead of losing the whole message', () => {
    const Boom = () => {
      throw new Error('render failed')
    }
    const onError = vi.fn()

    // React logs the caught error; silence it so the suite output stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <A2UIRenderer
        spec={{ type: 'Boom' }}
        registry={{ Boom }}
        onError={onError}
        renderError={(error) => <p>failed: {error.message}</p>}
      />,
    )
    spy.mockRestore()

    expect(screen.getByText(/failed: render failed/)).toBeInTheDocument()
    expect(onError).toHaveBeenCalled()
  })

  it('resolves a component type case-insensitively', () => {
    setup({ type: 'label', props: { text: 'lowercase' } })
    expect(screen.getByTestId('label')).toHaveTextContent('lowercase')
  })
})
