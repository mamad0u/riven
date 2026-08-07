'use client'

import { useState, useEffect } from 'react'
import { Folder, ChevronRight } from 'lucide-react'
import { FileItem } from '@/electron.d'
import FileTreeFileRow from '../FileTreeFileRow'
import InlineRename from '../InlineRename'
import { resolveFolderColor } from '@/app/lib/folderColors'

interface FolderItemProps {
  folder: FileItem
  level: number
  index: number
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onFileSelect: (file: FileItem) => void
  onDirectorySelect: (directory: FileItem) => void
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void
  renamingPath: string | null
  onRenameSubmit: (item: FileItem, newName: string) => void
  onRenameCancel: () => void
  currentFilePath: string | null
  currentDirectoryPath: string | null
  refreshKey?: number
  /** Incrémente pour forcer le re-rendu des couleurs */
  colorVersion?: number
}

export function FolderItem({
  folder,
  level,
  index,
  expandedFolders,
  onToggleFolder,
  onFileSelect,
  onDirectorySelect,
  onContextMenu,
  renamingPath,
  onRenameSubmit,
  onRenameCancel,
  currentFilePath,
  currentDirectoryPath,
  refreshKey = 0,
  colorVersion = 0,
}: FolderItemProps) {
  const [children, setChildren] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const isExpanded = expandedFolders.has(folder.path)
  const isSelected = currentDirectoryPath === folder.path
  const isRenaming = renamingPath === folder.path
  void colorVersion
  const folderColor = resolveFolderColor(folder.path, index)

  useEffect(() => {
    if (!isExpanded) return
    let cancelled = false
    ;(async () => {
      if (!window.electronAPI?.fileManager) return
      const hasCache = children.length > 0
      if (!hasCache) setLoading(true)
      try {
        const result = await window.electronAPI.fileManager.listDirectory(folder.path)
        if (!cancelled && !('error' in result)) {
          setChildren(result.items)
          setHasLoaded(true)
        }
      } catch (err) {
        console.error('Erreur chargement enfants:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // children volontairement omis : on lit le cache sans re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, refreshKey, folder.path])

  const subFolders = children.filter((i) => i.isDirectory)
  const subFiles = children.filter((i) => i.isFile)
  const showChildren = isExpanded || hasLoaded
  // N'animer l'ouverture qu'avec du contenu réel (évite le micro-flash "Chargement…")
  const isContentOpen = isExpanded && (!loading || children.length > 0)

  return (
    <div>
      <div
        className="sidebar-row gap-1"
        data-selected={isSelected ? 'true' : 'false'}
        style={level > 0 ? { paddingLeft: `${12 + level * 16}px` } : undefined}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu(e, folder)
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFolder(folder.path)
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-riven-text-secondary hover:text-riven-text-primary"
          title={isExpanded ? 'Replier' : 'Déplier'}
          aria-expanded={isExpanded}
        >
          <ChevronRight
            className="sidebar-chevron h-3.5 w-3.5"
            data-open={isExpanded ? 'true' : 'false'}
            strokeWidth={2}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            onToggleFolder(folder.path)
            onDirectorySelect(folder)
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Folder className="h-4 w-4 shrink-0" style={{ color: folderColor }} />
          {isRenaming ? (
            <InlineRename
              value={folder.name}
              onSubmit={(name) => onRenameSubmit(folder, name)}
              onCancel={onRenameCancel}
            />
          ) : (
            <span
              className={`truncate text-sm ${
                isSelected ? 'font-medium text-riven-text-primary' : 'text-riven-text-primary'
              }`}
            >
              {folder.name}
            </span>
          )}
        </button>
      </div>

      {showChildren && (
        <div className="sidebar-collapse" data-open={isContentOpen ? 'true' : 'false'}>
          <div className="sidebar-collapse-inner">
            {loading && children.length === 0 ? (
              <div
                className="py-1 text-xs text-riven-text-secondary"
                style={{ paddingLeft: `${24 + level * 16}px` }}
              >
                Chargement...
              </div>
            ) : (
              <>
                {subFolders.map((sub, i) => (
                  <FolderItem
                    key={sub.path}
                    folder={sub}
                    level={level + 1}
                    index={i}
                    expandedFolders={expandedFolders}
                    onToggleFolder={onToggleFolder}
                    onFileSelect={onFileSelect}
                    onDirectorySelect={onDirectorySelect}
                    onContextMenu={onContextMenu}
                    renamingPath={renamingPath}
                    onRenameSubmit={onRenameSubmit}
                    onRenameCancel={onRenameCancel}
                    currentFilePath={currentFilePath}
                    currentDirectoryPath={currentDirectoryPath}
                    refreshKey={refreshKey}
                    colorVersion={colorVersion}
                  />
                ))}
                {subFiles.map((file) => (
                  <FileTreeFileRow
                    key={file.path}
                    file={file}
                    level={level + 1}
                    selected={currentFilePath === file.path}
                    renaming={renamingPath === file.path}
                    onSelect={onFileSelect}
                    onContextMenu={onContextMenu}
                    onRenameSubmit={onRenameSubmit}
                    onRenameCancel={onRenameCancel}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
