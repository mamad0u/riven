'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileItem, TrashItem } from '../electron.d'
import { NavFilter } from './lib/navFilters'
import { renameMetadataPath } from './lib/promptMetadata'
import { ensureMigrated } from './lib/tagStore'
import { loadShortcutMap } from './lib/shortcutStore'
import { applyTheme, loadTheme } from './lib/themeStore'
import { PromptItem } from './lib/promptItems'
import { insertModuleToken, splitPromptContent } from './lib/moduleInsert'
import { useEditorTabs } from './hooks/useEditorTabs'
import { useDashboardFilters } from './hooks/useDashboardFilters'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import FileSidebar from './components/FileSidebar'
import TrashListView from './components/TrashListView'
import MainHeader from './components/MainHeader'
import PromptListView from './components/PromptListView'
import PromptGridView from './components/PromptGridView'
import TagsView, { type TagsViewHandle } from './components/tags/TagsView'
import TabBar from './components/TabBar'
import SplitEditor, { type SplitEditorHandle, type SplitPaneId } from './components/SplitEditor'
import FloatingActionButton from './components/FloatingActionButton'
import ActionBar from './components/ActionBar'
import WindowControls from './components/WindowControls'
import ConfirmModal from './components/ConfirmModal'
import {
  DEFAULT_LAYOUT_DISPLAY,
  type LayoutDisplayPrefs,
} from './components/LayoutSettingsPopover'
import { ModuleType } from './components/ModuleMenu'

export default function Home() {
  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateTab,
    openFile,
    closeTab,
    closeTabsForPath,
    updateTabFilePath,
    saveFile,
  } = useEditorTabs()

  const [currentDirectory, setCurrentDirectory] = useState<FileItem | null>(null)
  const [navFilter, setNavFilter] = useState<NavFilter>('all')
  const [sidebarFocus, setSidebarFocus] = useState<'nav' | 'directory' | 'file'>('nav')
  const [displayPrefs, setDisplayPrefs] = useState<LayoutDisplayPrefs>(DEFAULT_LAYOUT_DISPLAY)
  const [splitPair, setSplitPair] = useState<{ leftTabId: string; rightTabId: string } | null>(null)
  const [focusedPane, setFocusedPane] = useState<SplitPaneId>('left')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [actionBarOpen, setActionBarOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [viewingDashboard, setViewingDashboard] = useState(true)
  const [favoritesVersion, setFavoritesVersion] = useState(0)
  const [tagsVersion, setTagsVersion] = useState(0)
  const [sidebarTreeVersion, setSidebarTreeVersion] = useState(0)
  const editorRef = useRef<SplitEditorHandle>(null)
  const tagsViewRef = useRef<TagsViewHandle>(null)
  const pendingFocusTagSearch = useRef(false)
  const splitPairRef = useRef(splitPair)
  useEffect(() => {
    splitPairRef.current = splitPair
  }, [splitPair])

  const {
    viewMode,
    setViewMode,
    browseBy,
    setBrowseBy,
    sortBy,
    setSortBy,
    sortAsc,
    setSortAsc,
    searchQuery,
    setSearchQuery,
    setActiveTagFilters,
    folderFilter,
    setFolderFilter,
    dateFilter,
    setDateFilter,
    filePaths,
    folderOptions,
    promptItems,
    syncedTagFilters,
  } = useDashboardFilters({ allFiles, navFilter })

  const loadAllFiles = useCallback(async () => {
    if (!window.electronAPI?.fileManager) return
    const result = await window.electronAPI.fileManager.listAllFiles()
    if (!('error' in result)) setAllFiles(result.items)
  }, [])

  const loadTrash = useCallback(async () => {
    if (!window.electronAPI?.fileManager) return
    const result = await window.electronAPI.fileManager.listTrash()
    if (!('error' in result)) setTrashItems(result.items)
  }, [])

  const refreshLists = useCallback(async () => {
    await Promise.all([loadAllFiles(), loadTrash()])
    setFavoritesVersion((v) => v + 1)
    setTagsVersion((v) => v + 1)
  }, [loadAllFiles, loadTrash])

  useEffect(() => {
    ensureMigrated()
    applyTheme(loadTheme())
    const map = loadShortcutMap()
    void window.electronAPI?.setGlobalShortcuts?.({
      toggleSidebar: map.toggleSidebar,
      capturePrompt: map.capturePrompt,
    })
  }, [])

  // Refresh quand un prompt est sauvegardé depuis l'overlay détaché
  useEffect(() => {
    if (!window.electronAPI?.onPromptsChanged) return
    return window.electronAPI.onPromptsChanged(() => {
      void refreshLists()
      setSidebarTreeVersion((v) => v + 1)
    })
  }, [refreshLists])

  // Ouvrir un prompt depuis la recherche rapide (Shift+M)
  useEffect(() => {
    if (!window.electronAPI?.onOpenPrompt) return
    return window.electronAPI.onOpenPrompt((file) => {
      void openFile(file)
      setViewingDashboard(false)
      setSidebarFocus('file')
    })
  }, [openFile])

  // Fallback in-app capture + raccourcis renderer (tags / dashboard)
  useKeyboardShortcuts({
    navFilter,
    setNavFilter,
    setCurrentDirectory,
    setSidebarFocus,
    setViewingDashboard,
    setBrowseBy,
    setActiveTagFilters,
    setFolderFilter,
    tagsViewRef,
    pendingFocusTagSearch,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!window.electronAPI?.fileManager) return
      const [filesResult, trashResult] = await Promise.all([
        window.electronAPI.fileManager.listAllFiles(),
        window.electronAPI.fileManager.listTrash(),
      ])
      if (cancelled) return
      if (!('error' in filesResult)) setAllFiles(filesResult.items)
      if (!('error' in trashResult)) setTrashItems(trashResult.items)
      setFavoritesVersion((v) => v + 1)
      setTagsVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const showTagsView = navFilter === 'tags'
  const showPromptDashboard =
    viewingDashboard &&
    (navFilter === 'all' || navFilter === 'recent' || navFilter === 'favorites')
  const showTrashView = navFilter === 'trash'

  useEffect(() => {
    if (showTagsView && pendingFocusTagSearch.current) {
      pendingFocusTagSearch.current = false
      requestAnimationFrame(() => tagsViewRef.current?.focusSearch())
    }
  }, [showTagsView])

  void favoritesVersion
  void tagsVersion

  const handleFileSelect = useCallback(
    (file: FileItem | null) => {
      if (!file) return
      setCurrentDirectory(null)
      setSidebarFocus('file')
      setViewingDashboard(false)
      setNavFilter('all')
      setSplitPair(null)
      setFocusedPane('left')
      void openFile(file)
    },
    [openFile]
  )

  const handleDirectorySelect = useCallback((directory: FileItem | null) => {
    setCurrentDirectory(directory)
    if (directory) setSidebarFocus('directory')
  }, [])

  const handleNavFilterChange = useCallback((filter: NavFilter) => {
    setNavFilter(filter)
    setCurrentDirectory(null)
    setSidebarFocus('nav')
    if (filter === 'tags') {
      setBrowseBy('tags')
      setViewingDashboard(true)
    } else if (
      filter === 'all' ||
      filter === 'recent' ||
      filter === 'favorites' ||
      filter === 'trash'
    ) {
      setViewingDashboard(true)
      if (filter === 'recent') setBrowseBy('date')
      else setBrowseBy((prev) => (prev === 'tags' ? 'file' : prev))
    }
  }, [setBrowseBy])

  const handleFilterByTag = useCallback((tagId: string, tagName: string) => {
    setActiveTagFilters([{ id: tagId, name: tagName, mode: 'include' }])
    setNavFilter('all')
    setBrowseBy('file')
    setSidebarFocus('nav')
    setViewingDashboard(true)
  }, [setActiveTagFilters, setBrowseBy])

  const handleDisplayPrefsChange = useCallback((prefs: LayoutDisplayPrefs) => {
    setDisplayPrefs(prefs)
    if (!prefs.showSidebar) setSidebarCollapsed(true)
    else setSidebarCollapsed(false)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed
      setDisplayPrefs((prefs) => ({ ...prefs, showSidebar: true }))
      return next
    })
  }, [])

  const handlePromptSelect = useCallback(
    (item: PromptItem) => {
      handleFileSelect(item.file)
    },
    [handleFileSelect]
  )

  const handleInsertModule = useCallback(
    (moduleId: ModuleType) => {
      if (!activeTab) return
      const pane = editorRef.current?.focused()
      if (pane) {
        pane.insertModuleAtCursor(moduleId)
        return
      }
      const { content } = insertModuleToken(activeTab.content, activeTab.content.length, moduleId)
      updateTab(activeTab.id, { content, hasUnsavedChanges: true })
    },
    [activeTab, updateTab]
  )

  const applyTemplateBody = useCallback(
    (body: string) => {
      if (!activeTab) return
      updateTab(activeTab.id, { content: body, hasUnsavedChanges: true })
      setPendingTemplate(null)
      setActionBarOpen(false)
      window.setTimeout(() => {
        editorRef.current?.focused()?.replaceContent(body)
      }, 0)
    },
    [activeTab, updateTab]
  )

  const handleApplyTemplate = useCallback(
    (body: string) => {
      if (!activeTab) return
      setActionBarOpen(false)
      if (activeTab.content.trim()) {
        setPendingTemplate(body)
        return
      }
      window.setTimeout(() => applyTemplateBody(body), 0)
    },
    [activeTab, applyTemplateBody]
  )

  const handleContentChange = useCallback(
    (tabId: string, content: string) => {
      updateTab(tabId, { content, hasUnsavedChanges: true })
    },
    [updateTab]
  )

  const clearSplitKeeping = useCallback(
    (keepTabId: string | null) => {
      setSplitPair(null)
      setFocusedPane('left')
      if (keepTabId) setActiveTabId(keepTabId)
    },
    [setActiveTabId]
  )

  const handleFocusPane = useCallback(
    (pane: SplitPaneId) => {
      setFocusedPane(pane)
      const pair = splitPairRef.current
      if (!pair) return
      const tabId = pane === 'left' ? pair.leftTabId : pair.rightTabId
      setActiveTabId(tabId)
    },
    [setActiveTabId]
  )

  const handleEditorDrop = useCallback(
    async (file: FileItem, side: SplitPaneId) => {
      if (!file.isFile) return

      // Pas encore d'éditeur ouvert → ouverture simple
      if (!activeTab) {
        setCurrentDirectory(null)
        setSidebarFocus('file')
        setViewingDashboard(false)
        setNavFilter('all')
        await openFile(file)
        return
      }

      const currentId = activeTab.id
      const pair = splitPairRef.current

      // Déjà en split : remplacer le côté visé
      if (pair) {
        const targetId = side === 'left' ? pair.leftTabId : pair.rightTabId
        const targetTab = tabs.find((t) => t.id === targetId)
        if (targetTab?.file?.path && targetTab.file.path === file.path) return

        const droppedId = await openFile(file)
        if (!droppedId) return

        const next =
          side === 'left'
            ? { leftTabId: droppedId, rightTabId: pair.rightTabId }
            : { leftTabId: pair.leftTabId, rightTabId: droppedId }

        if (next.leftTabId === next.rightTabId) return

        setSplitPair(next)
        setFocusedPane(side)
        setActiveTabId(droppedId)
        setSidebarFocus('file')
        setViewingDashboard(false)
        return
      }

      // Création du split depuis un seul fichier
      const currentPath = activeTab.file?.path
      if (currentPath && currentPath === file.path) return

      const droppedId = await openFile(file)
      if (!droppedId || droppedId === currentId) return

      const next =
        side === 'left'
          ? { leftTabId: droppedId, rightTabId: currentId }
          : { leftTabId: currentId, rightTabId: droppedId }

      setSplitPair(next)
      setFocusedPane(side)
      setActiveTabId(droppedId)
      setSidebarFocus('file')
      setViewingDashboard(false)
    },
    [activeTab, openFile, setActiveTabId, tabs]
  )
  const handleItemTrashed = useCallback(
    (path: string) => {
      const pair = splitPairRef.current
      if (pair) {
        const left = tabs.find((t) => t.id === pair.leftTabId)
        const right = tabs.find((t) => t.id === pair.rightTabId)
        const leftHit = left?.file?.path === path || left?.file?.path?.startsWith(path + '/') || left?.file?.path?.startsWith(path + '\\')
        const rightHit =
          right?.file?.path === path ||
          right?.file?.path?.startsWith(path + '/') ||
          right?.file?.path?.startsWith(path + '\\')
        if (leftHit && !rightHit) clearSplitKeeping(pair.rightTabId)
        else if (rightHit && !leftHit) clearSplitKeeping(pair.leftTabId)
        else if (leftHit && rightHit) {
          setSplitPair(null)
          setFocusedPane('left')
        }
      }
      closeTabsForPath(path)
      void loadTrash()
      void loadAllFiles()
    },
    [clearSplitKeeping, closeTabsForPath, loadTrash, loadAllFiles, tabs]
  )

  const handleItemRenamed = useCallback(
    (oldPath: string, newPath: string) => {
      updateTabFilePath(oldPath, newPath)
      void loadAllFiles()
    },
    [updateTabFilePath, loadAllFiles]
  )

  const handleRestore = useCallback(
    async (ids: string[]) => {
      if (!window.electronAPI?.fileManager || ids.length === 0) return
      for (const id of ids) {
        const item = trashItems.find((t) => t.id === id)
        const result = await window.electronAPI.fileManager.restoreFromTrash(id)
        if ('error' in result) {
          alert(result.error)
          continue
        }
        if (item && item.originalPath !== result.restoredPath) {
          renameMetadataPath(item.originalPath, result.restoredPath)
        }
      }
      await refreshLists()
    },
    [trashItems, refreshLists]
  )

  const handlePurge = useCallback(
    async (ids: string[]) => {
      if (!window.electronAPI?.fileManager || ids.length === 0) return
      for (const id of ids) {
        const result = await window.electronAPI.fileManager.purgeTrashItem(id)
        if ('error' in result) {
          alert(result.error)
        }
      }
      await loadTrash()
    },
    [loadTrash]
  )

  const showEditor =
    !showPromptDashboard && !showTrashView && !showTagsView && tabs.length > 0 && !!activeTab

  useEffect(() => {
    if (!showEditor) {
      setActionBarOpen(false)
      setSplitPair(null)
      setFocusedPane('left')
    }
  }, [showEditor])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const pair = splitPairRef.current
      if (pair && (pair.leftTabId === tabId || pair.rightTabId === tabId)) {
        const keepId = pair.leftTabId === tabId ? pair.rightTabId : pair.leftTabId
        const closed = closeTab(tabId)
        if (closed) clearSplitKeeping(keepId)
        return
      }

      const isLast = tabs.length === 1 && tabs[0]?.id === tabId
      const closed = closeTab(tabId)
      if (closed && isLast) {
        setSplitPair(null)
        setFocusedPane('left')
        setViewingDashboard(true)
        setSidebarFocus('nav')
      }
    },
    [tabs, closeTab, clearSplitKeeping]
  )

  const leftTab = splitPair
    ? tabs.find((t) => t.id === splitPair.leftTabId) ?? null
    : activeTab
  const rightTab = splitPair ? tabs.find((t) => t.id === splitPair.rightTabId) ?? null : null

  // Split cassé (onglet manquant) → revenir en plein écran
  useEffect(() => {
    if (!splitPair) return
    const leftOk = tabs.some((t) => t.id === splitPair.leftTabId)
    const rightOk = tabs.some((t) => t.id === splitPair.rightTabId)
    if (leftOk && rightOk) return
    if (leftOk) clearSplitKeeping(splitPair.leftTabId)
    else if (rightOk) clearSplitKeeping(splitPair.rightTabId)
    else {
      setSplitPair(null)
      setFocusedPane('left')
    }
  }, [tabs, splitPair, clearSplitKeeping])

  const headerSharedProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    viewMode,
    onViewModeChange: setViewMode,
    activeTagFilters: syncedTagFilters,
    onTagFiltersChange: setActiveTagFilters,
    filePaths,
    folders: folderOptions,
    folderFilter,
    onFolderFilterChange: setFolderFilter,
    dateFilter,
    onDateFilterChange: setDateFilter,
    sortBy,
    onSortByChange: setSortBy,
    sortAsc,
    onSortAscChange: setSortAsc,
    displayPrefs,
    onDisplayPrefsChange: handleDisplayPrefsChange,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-riven-main">
      <div
        className={`shrink-0 transition-all duration-200 ${
          !displayPrefs.showSidebar
            ? 'w-0 overflow-hidden opacity-0'
            : sidebarCollapsed
              ? 'w-12'
              : 'w-64'
        }`}
      >
        <FileSidebar
          onFileSelect={handleFileSelect}
          onDirectorySelect={handleDirectorySelect}
          currentFilePath={sidebarFocus === 'file' ? activeTab?.file?.path || null : null}
          currentDirectoryPath={sidebarFocus === 'directory' ? currentDirectory?.path || null : null}
          highlightedNavFilter={sidebarFocus === 'nav' ? navFilter : null}
          onNavFilterChange={handleNavFilterChange}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          trashCount={trashItems.length}
          onTreeChanged={refreshLists}
          onItemTrashed={handleItemTrashed}
          onItemRenamed={handleItemRenamed}
          favoritesVersion={favoritesVersion + tagsVersion}
          treeVersion={sidebarTreeVersion}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {showTrashView ? (
          <>
            <MainHeader {...headerSharedProps} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TrashListView items={trashItems} onRestore={handleRestore} onPurge={handlePurge} />
            </div>
          </>
        ) : showTagsView ? (
          <>
            <MainHeader {...headerSharedProps} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <TagsView
                ref={tagsViewRef}
                filePaths={filePaths}
                onFilterByTag={handleFilterByTag}
                onTagsChanged={() => {
                  setTagsVersion((v) => v + 1)
                  void refreshLists()
                }}
              />
            </div>
          </>
        ) : showPromptDashboard ? (
          <>
            <MainHeader {...headerSharedProps} />
            <div className="flex-1 overflow-y-auto">
              {viewMode === 'list' ? (
                <PromptListView
                  items={promptItems}
                  selectedPath={activeTab?.file?.path}
                  useRelativeTime={navFilter === 'recent' || browseBy === 'date' || sortBy === 'date'}
                  forceFavoriteStar={navFilter === 'favorites'}
                  displayPrefs={displayPrefs}
                  onSelect={handlePromptSelect}
                />
              ) : (
                <PromptGridView
                  items={promptItems}
                  selectedPath={activeTab?.file?.path}
                  forceFavoriteStar={navFilter === 'favorites'}
                  displayPrefs={displayPrefs}
                  onSelect={handlePromptSelect}
                />
              )}
            </div>
          </>
        ) : showEditor ? (
          <>
            <MainHeader
              {...headerSharedProps}
              leading={
                <TabBar
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onSelect={(id) => {
                    setActiveTabId(id)
                    const pair = splitPairRef.current
                    if (!pair) {
                      setFocusedPane('left')
                      return
                    }
                    if (id === pair.leftTabId) setFocusedPane('left')
                    else if (id === pair.rightTabId) setFocusedPane('right')
                    else clearSplitKeeping(id)
                  }}
                  onClose={handleCloseTab}
                />
              }
            />
            <SplitEditor
              ref={editorRef}
              left={
                leftTab
                  ? {
                      tabId: leftTab.id,
                      content: leftTab.content,
                      fileName: leftTab.fileName,
                      onChange: (c) => handleContentChange(leftTab.id, c),
                    }
                  : {
                      tabId: activeTab.id,
                      content: activeTab.content,
                      fileName: activeTab.fileName,
                      onChange: (c) => handleContentChange(activeTab.id, c),
                    }
              }
              right={
                rightTab
                  ? {
                      tabId: rightTab.id,
                      content: rightTab.content,
                      fileName: rightTab.fileName,
                      onChange: (c) => handleContentChange(rightTab.id, c),
                    }
                  : null
              }
              focusedPane={splitPair ? focusedPane : 'left'}
              onFocusPane={handleFocusPane}
              onDropFile={handleEditorDrop}
            />          </>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="app-drag flex h-10 items-stretch justify-end border-b border-riven-border">
              <WindowControls />
            </div>
            <div className="flex flex-1 items-center justify-center text-riven-text-secondary">
              <p>Sélectionnez un fichier dans la sidebar</p>
            </div>
          </div>
        )}
      </div>

      {showEditor && (
        <>
          <FloatingActionButton
            isOpen={actionBarOpen}
            onClick={() => setActionBarOpen((v) => !v)}
          />
          <ActionBar
            isOpen={actionBarOpen}
            onClose={() => setActionBarOpen(false)}
            onInsertModule={handleInsertModule}
            onApplyTemplate={handleApplyTemplate}
            registry={activeTab ? splitPromptContent(activeTab.content).registry : {}}
            onDefineVariable={() => editorRef.current?.focused()?.openCreateVariable()}
            onInsertVariable={(id) => editorRef.current?.focused()?.insertVariableRef(id)}
            onEditVariable={(id) => editorRef.current?.focused()?.openEditVariable(id)}
          />
        </>
      )}

      <ConfirmModal
        open={pendingTemplate !== null}
        title="Remplacer le contenu ?"
        message="Le contenu actuel de l’éditeur sera remplacé par ce template."
        confirmLabel="Remplacer"
        cancelLabel="Annuler"
        onCancel={() => setPendingTemplate(null)}
        onConfirm={() => {
          if (pendingTemplate !== null) applyTemplateBody(pendingTemplate)
        }}
      />
    </div>
  )
}
