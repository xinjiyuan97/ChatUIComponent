'use client'

import type { PreviewFile } from '@xinjiyuan97/chat-core'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { FileIcon } from '../icons'
import { definePanel } from '../provider/panels'
import { usePreviewDefinition } from './registry'
import { UnsupportedPreview } from './UnsupportedPreview'

export type FilePreviewProps = {
  file: PreviewFile
  /** Passed to the renderer so it can close its own tab. Defaults to a no-op. */
  close?: () => void
  className?: string
}

/**
 * The second registry's entry point: a file in, the right renderer out.
 *
 * Everything below the panel shell hangs off this one component. `SidePanel` dispatches on an
 * opaque `kind` and knows nothing about files; the `file` kind lands here, and here is where
 * the file *type* is finally looked at. Two registries rather than one is what lets the right
 * column also hold a diff, a run log or a settings pane without any of them meeting the word
 * "extension".
 */
export function FilePreview({ file, close, className }: FilePreviewProps) {
  const definition = usePreviewDefinition(file)

  if (!definition) {
    return <UnsupportedPreview file={file} reason="unsupported-type" className={className} />
  }

  const Render = definition.render

  return (
    <PreviewErrorBoundary file={file} className={className}>
      <Render file={file} close={close ?? noop} />
    </PreviewErrorBoundary>
  )
}

/**
 * A ready-made `PanelDefinition`, so wiring the first registry to the second is one line:
 *
 * ```tsx
 * <ChatThemeProvider panels={{ file: filePreviewPanel }}>
 * panel.open({ id: path, kind: 'file', title: name, data: { file } })
 * ```
 *
 * `padded: false` because every viewer brings its own toolbar and wants the panel's full
 * width for the document.
 */
export const filePreviewPanel = definePanel<{ file: PreviewFile }>({
  icon: FileIcon,
  padded: false,
  render: ({ item, close }) =>
    item.data ? <FilePreview file={item.data.file} close={close} /> : null,
})

function noop() {}

type BoundaryProps = { file: PreviewFile; className?: string; children: ReactNode }

/**
 * Catches a throw from a viewer and turns it into the fallback page.
 *
 * These parsers are handed files produced by a model or by a pipeline nobody is watching, and
 * a malformed one reaching React's error handling would unmount the entire chat — losing the
 * conversation to a broken spreadsheet. The blast radius belongs inside the panel.
 */
class PreviewErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged, not swallowed: the fallback page is for the user, the console is for whoever
    // has to work out why this file will not open.
    console.error('[chat-ui] preview failed', error, info.componentStack)
  }

  override componentDidUpdate(previous: BoundaryProps) {
    // A new file deserves a fresh attempt; without this the panel stays broken for every
    // file opened after the bad one.
    if (previous.file !== this.props.file && this.state.error) this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return (
        <UnsupportedPreview
          file={this.props.file}
          reason="render-failed"
          detail={this.state.error.message}
          className={this.props.className}
        />
      )
    }
    return this.props.children
  }
}
