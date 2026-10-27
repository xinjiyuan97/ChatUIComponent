'use client'

import { useEffect, useRef, useState } from 'react'
import {
  readAgentGraphFile,
  type AgentGraphDefinition,
  type AgentGraphParseIssue,
} from '@xinjiyuan97/chat-core'
import { DiagramIcon, UploadIcon } from '../icons'
import { cn } from '../lib/cn'
import { useLocale } from '../provider/ChatThemeProvider'
import { AgentGraph, type AgentGraphProps } from './AgentGraph'
import { graphLocales } from './locale'

export type AgentGraphFileProps = Omit<AgentGraphProps, 'definition'> & {
  /** Controlled definition. Update it in onImport if supplied. */
  definition?: AgentGraphDefinition
  defaultDefinition?: AgentGraphDefinition
  /** Called only after successful parsing. Reject to keep the previous graph. */
  onImport?: (definition: AgentGraphDefinition, file: File) => void | Promise<void>
}

/** Local YAML/JSON file input plus graph preview. Invalid imports retain the current graph. */
export function AgentGraphFile({
  definition,
  defaultDefinition,
  onImport,
  className,
  style,
  labels: overrides,
  ...graphProps
}: AgentGraphFileProps) {
  const locale = useLocale()
  const labels = { ...graphLocales[locale.code.startsWith('zh') ? 'zh-CN' : 'en-US'], ...overrides }
  const [imported, setImported] = useState(defaultDefinition)
  const [filename, setFilename] = useState('')
  const [issues, setIssues] = useState<AgentGraphParseIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const depth = useRef(0)
  const current = definition ?? imported
  useEffect(
    () => () => {
      request.current++
    },
    [],
  )

  const load = async (files: File[]) => {
    const id = ++request.current
    setIssues([])
    setLoading(false)
    if (files.length !== 1) {
      setIssues([{ path: '$', message: labels.oneFile }])
      return
    }
    const file = files[0]!
    if (!/\.(ya?ml|json)$/i.test(file.name)) {
      setIssues([{ path: '$', message: labels.fileType }])
      return
    }
    setLoading(true)
    try {
      const result = await readAgentGraphFile(file)
      if (request.current !== id) return
      if (!result.ok) {
        setIssues(result.issues)
        return
      }
      await onImport?.(result.definition, file)
      if (request.current !== id) return
      setImported(result.definition)
      setFilename(file.name)
    } catch (error) {
      if (request.current === id)
        setIssues([
          { path: '$', message: error instanceof Error ? error.message : labels.importFailed },
        ])
    } finally {
      if (request.current === id) setLoading(false)
    }
  }

  return (
    <section
      className={cn('cc-graph-file h-[680px]', className)}
      style={style}
      aria-label={labels.importTitle}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        depth.current++
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDragLeave={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        if (--depth.current <= 0) {
          depth.current = 0
          setDragging(false)
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        depth.current = 0
        setDragging(false)
        void load(Array.from(event.dataTransfer.files))
      }}
    >
      <header className="cc-graph-file-toolbar">
        <div>
          <strong>{labels.importTitle}</strong>
          <span role="status">{loading ? labels.readingFile : filename || labels.importHint}</span>
        </div>
        <input
          ref={input}
          type="file"
          accept=".yaml,.yml,.json"
          aria-label={labels.chooseFile}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length) void load(files)
          }}
        />
        <button
          type="button"
          className="cc-graph-file-choose"
          onClick={() => input.current?.click()}
        >
          <UploadIcon size={16} />
          {labels.chooseFile}
        </button>
      </header>
      {issues.length > 0 && (
        <div className="cc-graph-file-error" role="alert">
          <strong>{labels.importFailed}</strong>
          <ul>
            {issues.slice(0, 20).map((issue, index) => (
              <li key={index}>
                <code>{issue.line ? `${issue.line}:${issue.column ?? 1}` : issue.path}</code>{' '}
                {issue.message}
              </li>
            ))}
          </ul>
          {issues.length > 20 && <span>+{issues.length - 20}</span>}
        </div>
      )}
      <div className="cc-graph-file-preview" aria-busy={loading}>
        {current ? (
          <AgentGraph {...graphProps} labels={overrides} definition={current} className="h-full" />
        ) : (
          <div className="cc-graph-file-empty">
            <DiagramIcon size={32} />
            <h3>{labels.dropFile}</h3>
            <p>{labels.importHint}</p>
            <p>{labels.importLocal}</p>
          </div>
        )}
      </div>
      {dragging && (
        <div className="cc-graph-file-drop">
          <UploadIcon size={32} />
          <strong>{labels.dropFile}</strong>
        </div>
      )}
    </section>
  )
}
