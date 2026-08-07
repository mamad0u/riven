'use client'

import { useEffect, type RefObject } from 'react'
import { loadShortcutMap, eventMatchesAccelerator } from '../lib/shortcutStore'
import type { NavFilter } from '../lib/navFilters'
import type { BrowseBy } from '../components/MainHeader'
import type { TagFilterSelection } from '../components/HeaderFilterSystem'
import type { TagsViewHandle } from '../components/tags/TagsView'
import { FileItem } from '@/electron.d'

export interface UseKeyboardShortcutsParams {
  navFilter: NavFilter
  setNavFilter: (filter: NavFilter) => void
  setCurrentDirectory: (directory: FileItem | null) => void
  setSidebarFocus: (focus: 'nav' | 'directory' | 'file') => void
  setViewingDashboard: (viewing: boolean) => void
  setBrowseBy: (browseBy: BrowseBy) => void
  setActiveTagFilters: (filters: TagFilterSelection[]) => void
  setFolderFilter: (folder: string | null) => void
  tagsViewRef: RefObject<TagsViewHandle | null>
  pendingFocusTagSearch: RefObject<boolean>
}

/**
 * Raccourcis clavier globaux du dashboard (capture in-app, aller au dashboard,
 * aller à la recherche de tags). Miroir exact de la logique précédemment inline
 * dans page.tsx — aucun changement de comportement.
 */
export function useKeyboardShortcuts({
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
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const run = (e: KeyboardEvent) => {
      const map = loadShortcutMap()
      const target = e.target as HTMLElement | null
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      const isTagSearch = target?.getAttribute?.('data-tag-search') === 'true'

      if (eventMatchesAccelerator(e, map.capturePrompt)) {
        if (e.ctrlKey || e.metaKey) return
        e.preventDefault()
        e.stopPropagation()
        const sel = window.getSelection()?.toString() ?? ''
        window.electronAPI?.openCaptureOverlay?.(sel)
        return
      }

      if (eventMatchesAccelerator(e, map.dashboard)) {
        if (isEditable && !isTagSearch) return
        e.preventDefault()
        setNavFilter('all')
        setCurrentDirectory(null)
        setSidebarFocus('nav')
        setViewingDashboard(true)
        setBrowseBy('file')
        setActiveTagFilters([])
        setFolderFilter(null)
        return
      }

      if (eventMatchesAccelerator(e, map.tagSearch)) {
        if (isEditable && !isTagSearch) return
        e.preventDefault()
        setNavFilter('tags')
        setCurrentDirectory(null)
        setSidebarFocus('nav')
        setViewingDashboard(true)
        setBrowseBy('tags')
        if (navFilter === 'tags') {
          tagsViewRef.current?.focusSearch()
        } else {
          pendingFocusTagSearch.current = true
        }
      }
    }

    window.addEventListener('keydown', run, true)
    const onShortcutsChanged = () => {
      /* map relu à chaque keydown via loadShortcutMap */
    }
    window.addEventListener('riven-shortcuts-changed', onShortcutsChanged)
    return () => {
      window.removeEventListener('keydown', run, true)
      window.removeEventListener('riven-shortcuts-changed', onShortcutsChanged)
    }
  }, [
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
  ])
}
