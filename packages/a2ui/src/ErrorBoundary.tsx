'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

export type A2UIErrorBoundaryProps = {
  children: ReactNode
  /** Rendered instead of the surface when a registry component throws. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

type State = { error: Error | null }

/**
 * Isolates a surface from the rest of the conversation.
 *
 * A registry component is arbitrary host code driven by arbitrary model output, so it
 * will eventually throw on some prop shape nobody anticipated. Without this boundary
 * that unmounts the entire message list.
 */
export class A2UIErrorBoundary extends Component<A2UIErrorBoundaryProps, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private reset = () => this.setState({ error: null })

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.fallback?.(error, this.reset) ?? null
  }
}
