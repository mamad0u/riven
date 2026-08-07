'use client'

import { useState } from 'react'
import { FileItem } from '../../electron.d'
import InlineRename from './InlineRename'
import { setFileDragData } from '../lib/fileDrag'

interface FileTreeFileRowProps {
  file: FileItem
  level?: number
  selected?: boolean
  showPathHint?: boolean
  renaming?: boolean
  onSelect: (file: FileItem) => void
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void
  onRenameSubmit: (file: FileItem, newName: string) => void
  onRenameCancel: () => void
}

function parentHint(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return null
  return normalized.slice(0, idx)
}

export default function FileTreeFileRow({
  file,
  level = 0,
  selected = false,
  showPathHint = false,
  renaming = false,
  onSelect,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: FileTreeFileRowProps) {
  const hint = showPathHint ? parentHint(file.path) : null
  // draggable casse :hover CSS dans Electron → data-hover pour le même fond
  const [hovered, setHovered] = useState(false)

  return (
    <div className="w-full min-w-0">
      <div
        role="button"
        tabIndex={0}
        draggable={!renaming}
        data-selected={selected ? 'true' : 'false'}
        data-hover={hovered ? 'true' : 'false'}
        onDragStart={(e) => {
          if (renaming) {
            e.preventDefault()
            return
          }
          setFileDragData(e.dataTransfer, file)
        }}
        onDragEnd={() => setHovered(false)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="app-no-drag sidebar-row gap-0"
        style={level > 0 ? { paddingLeft: `${12 + level * 16}px` } : undefined}
        onClick={() => !renaming && onSelect(file)}
        onKeyDown={(e) => {
          if (renaming) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(file)
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu(e, file)
        }}
      >
        <div className="min-w-0 flex-1">
          {renaming ? (
            <InlineRename
              value={file.name}
              onSubmit={(name) => onRenameSubmit(file, name)}
              onCancel={onRenameCancel}
            />
          ) : (
            <>
              <div
                className={`truncate ${selected ? 'font-medium text-riven-text-primary' : 'text-riven-text-primary'}`}
              >
                {file.name}
              </div>
              {hint && (
                <div className="truncate text-[10px] text-riven-text-secondary">{hint}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
