'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { AgentGraphNode } from '@xinjiyuan97/chat-core'

import { CloseIcon } from '../icons'
import { JsonViewer } from '../parts/JsonViewer'
import { IconButton } from '../primitives/IconButton'
import type { AgentGraphLabels } from './locale'

export type AgentGraphConfigChange = {
  nodeId: string
  kind: 'operator' | 'trigger'
  config: Record<string, unknown>
}
export type AgentGraphConfigSave = (change: AgentGraphConfigChange) => void | Promise<void>

export function GraphConfigDialog({
  node,
  labels,
  onSave,
  onClose,
}: {
  node: AgentGraphNode
  labels: AgentGraphLabels
  onSave?: AgentGraphConfigSave
  onClose: () => void
}) {
  const descriptor = node.operator ?? node.trigger
  const initial = JSON.stringify(descriptor?.config ?? {}, null, 2)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const savingRef = useRef(false)
  const mounted = useRef(false)
  const backdropPointer = useRef(false)
  const titleId = useId()
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()

  useEffect(() => {
    mounted.current = true
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    return () => {
      mounted.current = false
      dialog?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const close = () => {
    if (!savingRef.current) onClose()
  }
  const save = async () => {
    if (!onSave || savingRef.current) return
    let config: unknown
    try {
      config = JSON.parse(draft)
    } catch {
      setError(labels.invalidJson)
      return
    }
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
      setError(labels.configObject)
      return
    }
    setError(null)
    savingRef.current = true
    setSaving(true)
    try {
      await onSave({
        nodeId: node.id,
        kind: node.trigger ? 'trigger' : 'operator',
        config: config as Record<string, unknown>,
      })
      if (mounted.current) onClose()
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error && cause.message ? cause.message : labels.saveFailed)
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="cc-graph-config-dialog"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.nativeEvent.isComposing && event.key === 'Escape') event.preventDefault()
      }}
      onPointerDown={(event) => {
        backdropPointer.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && backdropPointer.current) close()
        backdropPointer.current = false
      }}
    >
      <div className="cc-graph-config-shell">
        <header className="cc-graph-config-heading">
          <div>
            <h2 id={titleId}>
              {labels.configuration} · {node.id}
            </h2>
            <p>
              {descriptor?.type}@{descriptor?.version}
            </p>
          </div>
          <IconButton
            label={labels.closeConfig}
            icon={<CloseIcon />}
            disabled={saving}
            onClick={close}
            className="size-9"
            tooltip={false}
          />
        </header>
        <div className="cc-graph-config-body">
          <p id={hintId} className="cc-graph-config-hint">
            {onSave ? labels.configEditHint : labels.configReadOnly}
          </p>
          {onSave ? (
            <>
              <label htmlFor={inputId} className="cc-graph-config-label">
                {labels.configuration} JSON
              </label>
              <textarea
                id={inputId}
                value={draft}
                spellCheck={false}
                readOnly={saving}
                className="cc-graph-config-editor"
                aria-invalid={!!error}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                onChange={(event) => {
                  setDraft(event.target.value)
                  setError(null)
                }}
              />
            </>
          ) : (
            <div className="cc-graph-config-view">
              <JsonViewer value={descriptor?.config ?? {}} defaultExpandedDepth={3} />
            </div>
          )}
          {error && (
            <p className="cc-graph-config-error" id={errorId} role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="cc-graph-config-footer">
          <span role="status">{saving ? labels.savingConfig : ''}</span>
          <button type="button" onClick={close} disabled={saving}>
            {onSave ? labels.cancelConfig : labels.closeConfig}
          </button>
          {onSave && (
            <button
              type="button"
              className="cc-graph-config-save"
              disabled={saving || draft === initial}
              onClick={() => void save()}
            >
              {saving ? labels.savingConfig : labels.saveConfig}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  )
}
