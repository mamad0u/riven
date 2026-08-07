'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import { FileItem } from '@/electron.d'
import { NavFilter, computeNavCounts } from '../lib/navFilters'
import {
  getFavoritesCount,
  getTagsCount,
  isFavorite,
  toggleFavorite,
  renameMetadataPath,
  removeMetadataPath,
} from '../lib/promptMetadata'
import SidebarHeader from './sidebar/SidebarHeader'
import MainNavSection from './sidebar/MainNavSection'
import { FolderItem } from './sidebar/FolderItem'
import FileTreeFileRow from './FileTreeFileRow'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import FolderColorPicker from './FolderColorPicker'
import TagAssignModal from './tags/TagAssignModal'
import AppMenu from './AppMenu'
import Input from './ui/Input'
import Button from './ui/Button'
import { getFolderColor, setFolderColor } from '../lib/folderColors'

interface FileSidebarProps {
  onFileSelect: (file: FileItem | null) => void
  onDirectorySelect: (directory: FileItem | null) => void
  currentFilePath: string | null
  currentDirectoryPath: string | null
  highlightedNavFilter: NavFilter | null
  onNavFilterChange: (filter: NavFilter) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  trashCount?: number
  onTreeChanged?: () => void
  onItemTrashed?: (path: string) => void
  onItemRenamed?: (oldPath: string, newPath: string) => void
  favoritesVersion?: number
  treeVersion?: number
}

interface MenuState {
  x: number
  y: number
  item: FileItem
}

export default function FileSidebar({
  onFileSelect,
  onDirectorySelect,
  currentFilePath,
  currentDirectoryPath,
  highlightedNavFilter,
  onNavFilterChange,
  collapsed = false,
  onToggleCollapse,
  trashCount = 0,
  onTreeChanged,
  onItemTrashed,
  onItemRenamed,
  favoritesVersion = 0,
  treeVersion = 0,
}: FileSidebarProps) {
  const [folders, setFolders] = useState<FileItem[]>([])
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createType, setCreateType] = useState<'file' | 'directory'>('file')
  const [newItemName, setNewItemName] = useState('')
  const [foldersExpanded, setFoldersExpanded] = useState(true)
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [favTick, setFavTick] = useState(0)
  const [createTargetPath, setCreateTargetPath] = useState<string | null>(null)
  const [assignTagsFile, setAssignTagsFile] = useState<FileItem | null>(null)
  const [appMenuOpen, setAppMenuOpen] = useState(false)
  const [metaReady, setMetaReady] = useState(false)
  const [colorVersion, setColorVersion] = useState(0)

  const selectedParent = createTargetPath ?? currentDirectoryPath

  useEffect(() => {
    setMetaReady(true)
  }, [])

  const refreshTree = useCallback(async () => {
    if (!window.electronAPI?.fileManager) {
      setError('API Electron non disponible')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [dirResult, filesResult] = await Promise.all([
        window.electronAPI.fileManager.listDirectory(null),
        window.electronAPI.fileManager.listAllFiles(),
      ])
      if ('error' in dirResult) setError(dirResult.error)
      else setFolders(dirResult.items.filter((i) => i.isDirectory))

      if ('error' in filesResult) setError(filesResult.error)
      else setAllFiles(filesResult.items)
    } catch {
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
      setRefreshKey((k) => k + 1)
    }
  }, [])

  const notifyTreeChanged = useCallback(() => {
    onTreeChanged?.()
  }, [onTreeChanged])

  useEffect(() => {
    void refreshTree()
  }, [refreshTree, treeVersion])

  const refreshAndNotify = useCallback(async () => {
    await refreshTree()
    notifyTreeChanged()
  }, [refreshTree, notifyTreeChanged])

  const navCounts = computeNavCounts(
    allFiles.length,
    metaReady ? getFavoritesCount() : 0,
    metaReady ? getTagsCount() : 0,
    trashCount
  )
  // re-compute when favorites change
  void favTick
  void favoritesVersion

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleDirectoryClick = (item: FileItem) => {
    if (item.isDirectory) {
      setCreateTargetPath(item.path)
      onDirectorySelect(item)
    }
  }

  const openCreateDialog = (type: 'file' | 'directory', parentPath?: string | null) => {
    if (parentPath !== undefined) setCreateTargetPath(parentPath)
    setCreateType(type)
    setNewItemName('')
    setShowCreateDialog(true)
  }

  const handleCreate = async () => {
    if (!newItemName.trim() || !window.electronAPI) return
    const parent = selectedParent
    try {
      let name = newItemName.trim()
      if (createType === 'file' && !name.includes('.')) {
        name = `${name}.md`
      }
      const result =
        createType === 'directory'
          ? await window.electronAPI.fileManager.createDirectory(parent, name)
          : await window.electronAPI.fileManager.createFile(parent, name, '')

      if ('error' in result) setError(result.error)
      else {
        setShowCreateDialog(false)
        setNewItemName('')
        if (parent) {
          setExpandedFolders((prev) => new Set(prev).add(parent))
        }
        await refreshAndNotify()
        if (createType === 'file' && result.path) {
          onFileSelect({
            name,
            path: result.path,
            fullPath: result.path,
            isDirectory: false,
            isFile: true,
            size: 0,
            created: new Date(),
            modified: new Date(),
          })
        }
      }
    } catch {
      setError('Erreur lors de la création')
    }
  }

  const handleMoveToTrash = async (item: FileItem) => {
    if (!window.electronAPI || !confirm(`Mettre "${item.name}" à la poubelle ?`)) return
    try {
      const result = await window.electronAPI.fileManager.moveToTrash(item.path)
      if ('error' in result) {
        setError(result.error)
        return
      }
      removeMetadataPath(item.path)
      onItemTrashed?.(item.path)
      if (currentFilePath === item.path) onFileSelect(null)
      if (currentDirectoryPath === item.path) onDirectorySelect(null)
      await refreshAndNotify()
    } catch {
      setError('Erreur lors de la suppression')
    }
  }

  const handleRenameSubmit = async (item: FileItem, newName: string) => {
    setRenamingPath(null)
    if (!newName.trim() || newName.trim() === item.name || !window.electronAPI) return
    try {
      const result = await window.electronAPI.fileManager.renameItem(item.path, newName.trim())
      if ('error' in result) {
        setError(result.error)
        return
      }
      renameMetadataPath(item.path, result.newPath)
      onItemRenamed?.(item.path, result.newPath)
      if (currentDirectoryPath === item.path) {
        onDirectorySelect({ ...item, name: newName.trim(), path: result.newPath, fullPath: result.newPath })
      }
      await refreshAndNotify()
    } catch {
      setError('Erreur lors du renommage')
    }
  }

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    setMenu({ x: e.clientX, y: e.clientY, item })
  }

  const getMenuItems = (item: FileItem): ContextMenuItem[] => {
    if (item.isDirectory) {
      return [
        { id: 'new-file', label: 'Nouveau fichier' },
        { id: 'new-folder', label: 'Nouveau dossier' },
        { id: 'sep1', label: '', separator: true },
        { id: 'rename', label: 'Renommer' },
        { id: 'trash', label: 'Supprimer', danger: true },
      ]
    }
    const fav = isFavorite(item.path)
    return [
      { id: 'rename', label: 'Renommer' },
      { id: 'favorite', label: fav ? 'Retirer des favoris' : 'Ajouter aux favoris' },
      { id: 'manage-tags', label: 'Gérer les tags' },
      { id: 'sep1', label: '', separator: true },
      { id: 'trash', label: 'Supprimer', danger: true },
    ]
  }

  const handleMenuSelect = async (id: string) => {
    if (!menu) return
    const item = menu.item
    setMenu(null)

    if (id === 'rename') {
      setRenamingPath(item.path)
      return
    }
    if (id === 'trash') {
      await handleMoveToTrash(item)
      return
    }
    if (id === 'favorite' && item.isFile) {
      toggleFavorite(item.path)
      setFavTick((t) => t + 1)
      notifyTreeChanged()
      return
    }
    if (id === 'manage-tags' && item.isFile) {
      setAssignTagsFile(item)
      return
    }
    if (id === 'new-file' || id === 'new-folder') {
      const parent = item.isDirectory ? item.path : null
      if (parent) {
        setExpandedFolders((prev) => new Set(prev).add(parent))
      }
      openCreateDialog(id === 'new-file' ? 'file' : 'directory', parent)
    }
  }

  return (
    <div className="flex h-full flex-col bg-riven-sidebar text-riven-text-primary">
      <SidebarHeader
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenAppMenu={() => setAppMenuOpen(true)}
      />

      <div className="flex-1 overflow-y-auto">
        <MainNavSection
          activeFilter={highlightedNavFilter}
          counts={navCounts}
          onFilterChange={onNavFilterChange}
          collapsed={collapsed}
        />

        {!collapsed && (
          <>
            <div className="border-b border-riven-border">
              <div className="flex items-center justify-between px-4 py-2.5">
                <button
                  onClick={() => setFoldersExpanded(!foldersExpanded)}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                  aria-expanded={foldersExpanded}
                >
                  <ChevronRight
                    className="sidebar-chevron h-3.5 w-3.5 shrink-0 text-riven-text-secondary"
                    data-open={foldersExpanded ? 'true' : 'false'}
                    strokeWidth={2}
                  />
                  Dossiers
                </button>
                <button
                  onClick={() => openCreateDialog('directory')}
                  className="text-riven-text-secondary hover:text-riven-accent transition-colors"
                  title="Nouveau dossier"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="sidebar-collapse" data-open={foldersExpanded ? 'true' : 'false'}>
                <div className="sidebar-collapse-inner pb-2">
                  {loading ? (
                    <p className="pl-8 py-2 text-xs text-riven-text-secondary">Chargement...</p>
                  ) : folders.length === 0 ? (
                    <p className="pl-8 py-2 text-xs text-riven-text-secondary">Aucun dossier</p>
                  ) : (
                    folders.map((folder, i) => (
                      <FolderItem
                        key={folder.path}
                        folder={folder}
                        level={0}
                        index={i}
                        expandedFolders={expandedFolders}
                        onToggleFolder={handleToggleFolder}
                        onFileSelect={onFileSelect}
                        onDirectorySelect={handleDirectoryClick}
                        onContextMenu={handleContextMenu}
                        renamingPath={renamingPath}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setRenamingPath(null)}
                        currentFilePath={currentFilePath}
                        currentDirectoryPath={currentDirectoryPath}
                        refreshKey={refreshKey}
                        colorVersion={colorVersion}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <button
                  onClick={() => setFilesExpanded(!filesExpanded)}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                  aria-expanded={filesExpanded}
                >
                  <ChevronRight
                    className="sidebar-chevron h-3.5 w-3.5 shrink-0 text-riven-text-secondary"
                    data-open={filesExpanded ? 'true' : 'false'}
                    strokeWidth={2}
                  />
                  Fichiers
                </button>
                <button
                  onClick={() => openCreateDialog('file')}
                  className="text-riven-text-secondary hover:text-riven-accent transition-colors"
                  title="Nouveau fichier"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="sidebar-collapse" data-open={filesExpanded ? 'true' : 'false'}>
                <div className="sidebar-collapse-inner px-0 pb-2">
                  {loading ? (
                    <p className="pl-4 py-2 text-xs text-riven-text-secondary">Chargement...</p>
                  ) : error ? (
                    <p className="pl-4 py-2 text-xs text-red-400">{error}</p>
                  ) : allFiles.length === 0 ? (
                    <p className="pl-4 py-2 text-xs text-riven-text-secondary">Aucun fichier</p>
                  ) : (
                    allFiles.map((item) => (
                      <FileTreeFileRow
                        key={item.path}
                        file={item}
                        selected={filesExpanded && currentFilePath === item.path}
                        renaming={renamingPath === item.path}
                        onSelect={onFileSelect}
                        onContextMenu={handleContextMenu}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setRenamingPath(null)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreateDialog && (
        <div className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="mx-4 w-full max-w-md rounded-riven-lg border border-riven-border bg-riven-card p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">
              Créer un {createType === 'directory' ? 'dossier' : 'fichier'}
            </h2>
            <p className="mb-4 text-xs text-riven-text-secondary">
              Emplacement : {selectedParent || '(racine)'}
            </p>
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Nom du ${createType === 'directory' ? 'dossier' : 'fichier'}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setShowCreateDialog(false)
              }}
              className="app-no-drag mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewItemName('')
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate}>Créer</Button>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={getMenuItems(menu.item)}
          onSelect={handleMenuSelect}
          onClose={() => setMenu(null)}
          insertBeforeId={menu.item.isDirectory ? 'trash' : undefined}
          insertContent={
            menu.item.isDirectory ? (
              <FolderColorPicker
                value={getFolderColor(menu.item.path)}
                onChange={(color) => {
                  setFolderColor(menu.item.path, color)
                  setColorVersion((v) => v + 1)
                  notifyTreeChanged()
                  setMenu(null)
                }}
              />
            ) : undefined
          }
        />
      )}

      {assignTagsFile && (
        <TagAssignModal
          filePath={assignTagsFile.path}
          fileName={assignTagsFile.name}
          onClose={() => setAssignTagsFile(null)}
          onSaved={() => {
            setFavTick((t) => t + 1)
            notifyTreeChanged()
          }}
        />
      )}

      <AppMenu
        open={appMenuOpen}
        onClose={() => setAppMenuOpen(false)}
        sidebarWidth={256}
        currentFilePath={currentFilePath}
        onTreeChanged={notifyTreeChanged}
        onImportedFile={onFileSelect}
      />
    </div>
  )
}
