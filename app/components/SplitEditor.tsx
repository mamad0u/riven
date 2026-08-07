'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { FileItem } from '@/electron.d'
import EditorPane, { type EditorPaneHandle } from './EditorPane'
import { isRivenFileDrag, parseFileDragData } from '../lib/fileDrag'

export type SplitPaneId = 'left' | 'right'

export interface SplitPaneModel {
  tabId: string
  content: string
  fileName: string
  onChange: (content: string) => void
}

export interface SplitEditorHandle {
  left: EditorPaneHandle | null
  right: EditorPaneHandle | null
  focused: () => EditorPaneHandle | null
}

interface SplitEditorProps {
  left: SplitPaneModel
  right: SplitPaneModel | null
  focusedPane: SplitPaneId
  onFocusPane: (pane: SplitPaneId) => void
  onDropFile: (file: FileItem, side: SplitPaneId) => void
}

function dropSideFromEvent(e: React.DragEvent, el: HTMLElement): SplitPaneId {
  const rect = el.getBoundingClientRect()
  return e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
}

const SplitEditor = forwardRef<SplitEditorHandle, SplitEditorProps>(function SplitEditor(
  { left, right, focusedPane, onFocusPane, onDropFile },
  ref
) {
  const leftRef = useRef<EditorPaneHandle>(null)
  const rightRef = useRef<EditorPaneHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [dragOverSide, setDragOverSide] = useState<SplitPaneId | null>(null)
  const dragDepth = useRef(0)

  useImperativeHandle(
    ref,
    () => ({
      get left() {
        return leftRef.current
      },
      get right() {
        return rightRef.current
      },
      focused() {
        return focusedPane === 'right' ? rightRef.current : leftRef.current
      },
    }),
    [focusedPane]
  )

  const handleDragEnter = (e: React.DragEvent) => {
    if (!isRivenFileDrag(e.dataTransfer)) return
    e.preventDefault()
    dragDepth.current += 1
    if (rootRef.current) setDragOverSide(dropSideFromEvent(e, rootRef.current))
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isRivenFileDrag(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (rootRef.current) setDragOverSide(dropSideFromEvent(e, rootRef.current))
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isRivenFileDrag(e.dataTransfer)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOverSide(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragOverSide(null)
    if (!rootRef.current) return
    const file = parseFileDragData(e.dataTransfer)
    if (!file) return
    const side = dropSideFromEvent(e, rootRef.current)
    onDropFile(file, side)
  }

  const paneShell = (
    pane: SplitPaneId,
    model: SplitPaneModel,
    editorRef: React.RefObject<EditorPaneHandle | null>
  ) => (
    <div
      className="app-no-drag relative flex min-w-0 flex-1 flex-col overflow-hidden"
      onMouseDown={() => onFocusPane(pane)}
    >
      {right && (
        <div className="flex h-7 shrink-0 items-center border-b border-riven-border px-3">
          <span className="truncate text-xs text-riven-text-secondary">
            {model.fileName.replace(/\.[^.]+$/, '')}
          </span>
        </div>
      )}
      <EditorPane
        key={model.tabId}
        ref={editorRef}
        content={model.content}
        onChange={model.onChange}
      />
    </div>
  )

  return (
    <div
      ref={rootRef}
      className="app-no-drag relative flex min-h-0 flex-1 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {paneShell('left', left, leftRef)}

      {right && (
        <>
          <div className="w-px shrink-0 bg-riven-border" />
          {paneShell('right', right, rightRef)}
        </>
      )}

      {dragOverSide && (
        <div className="pointer-events-none absolute inset-0 z-20 flex">
          <div
            className={`h-full w-1/2 transition-colors ${
              dragOverSide === 'left' ? 'bg-riven-accent/20' : 'bg-transparent'
            }`}
          />
          <div
            className={`h-full w-1/2 transition-colors ${
              dragOverSide === 'right' ? 'bg-riven-accent/20' : 'bg-transparent'
            }`}
          />
        </div>
      )}
    </div>
  )
})

export default SplitEditor
