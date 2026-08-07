'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { FileItem } from '@/electron.d'
import { NavFilter } from '../lib/navFilters'
import { getTagsForPath, getTagIdsForPath, isFavorite } from '../lib/promptMetadata'
import { getTag } from '../lib/tagStore'
import { fileToPromptItem, sortByRecent, PromptItem } from '../lib/promptItems'
import type { BrowseBy, DateFilterPreset } from '../components/MainHeader'
import type { LayoutSortBy } from '../components/LayoutSettingsPopover'
import type { TagFilterSelection } from '../components/HeaderFilterSystem'

export interface UseDashboardFiltersParams {
  allFiles: FileItem[]
  navFilter: NavFilter
}

export interface UseDashboardFiltersResult {
  viewMode: 'list' | 'grid'
  setViewMode: Dispatch<SetStateAction<'list' | 'grid'>>
  browseBy: BrowseBy
  setBrowseBy: Dispatch<SetStateAction<BrowseBy>>
  sortBy: LayoutSortBy
  setSortBy: Dispatch<SetStateAction<LayoutSortBy>>
  sortAsc: boolean
  setSortAsc: Dispatch<SetStateAction<boolean>>
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  activeTagFilters: TagFilterSelection[]
  setActiveTagFilters: Dispatch<SetStateAction<TagFilterSelection[]>>
  folderFilter: string | null
  setFolderFilter: Dispatch<SetStateAction<string | null>>
  dateFilter: DateFilterPreset
  setDateFilter: Dispatch<SetStateAction<DateFilterPreset>>
  filePaths: string[]
  folderOptions: { name: string; path: string }[]
  filteredFiles: FileItem[]
  promptItems: PromptItem[]
  syncedTagFilters: TagFilterSelection[]
}

/**
 * Regroupe tout l'état de filtrage/tri du dashboard (recherche, tags, dossier,
 * date, tri, mode d'affichage) ainsi que les listes dérivées (fichiers filtrés,
 * items de prompt prêts à afficher). Ne gère pas la navigation (navFilter) ni le
 * mode "vue dashboard" : ces états restent dans page.tsx car ils pilotent aussi
 * la sélection de fichier/dossier et le routage entre les différentes vues.
 */
export function useDashboardFilters({
  allFiles,
  navFilter,
}: UseDashboardFiltersParams): UseDashboardFiltersResult {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [browseBy, setBrowseBy] = useState<BrowseBy>('file')
  const [sortBy, setSortBy] = useState<LayoutSortBy>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTagFilters, setActiveTagFilters] = useState<TagFilterSelection[]>([])
  const [folderFilter, setFolderFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all')

  const filePaths = useMemo(() => allFiles.map((f) => f.path), [allFiles])

  const folderOptions = useMemo(() => {
    const map = new Map<string, { name: string; path: string }>()
    for (const f of allFiles) {
      const norm = f.path.replace(/\\/g, '/')
      const parts = norm.split('/').filter(Boolean)
      if (parts.length < 2) continue
      const folderPath = parts.slice(0, -1).join('/')
      const folderName = parts[parts.length - 2]
      if (!map.has(folderPath)) map.set(folderPath, { name: folderName, path: folderPath })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [allFiles])

  const filteredFiles = (() => {
    let files = allFiles
    if (navFilter === 'favorites') {
      files = files.filter((f) => isFavorite(f.path))
    }
    if (folderFilter) {
      const prefix = folderFilter.replace(/\\/g, '/').replace(/\/$/, '')
      files = files.filter((f) => {
        const norm = f.path.replace(/\\/g, '/')
        const parent = norm.split('/').slice(0, -1).join('/')
        return parent === prefix || parent.startsWith(prefix + '/')
      })
    }
    if (activeTagFilters.length > 0) {
      const includes = activeTagFilters.filter((t) => t.mode !== 'exclude')
      const excludes = activeTagFilters.filter((t) => t.mode === 'exclude')
      files = files.filter((f) => {
        const tagIds = getTagIdsForPath(f.path)
        if (includes.length > 0 && !includes.some((t) => tagIds.includes(t.id))) {
          return false
        }
        if (excludes.some((t) => tagIds.includes(t.id))) return false
        return true
      })
    }
    if (dateFilter !== 'all') {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekAgo = new Date(startOfToday)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date(startOfToday)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      files = files.filter((f) => {
        const m = new Date(f.modified).getTime()
        if (dateFilter === 'today') return m >= startOfToday.getTime()
        if (dateFilter === 'week') return m >= weekAgo.getTime()
        if (dateFilter === 'month') return m >= monthAgo.getTime()
        if (dateFilter === 'older') return m < monthAgo.getTime()
        return true
      })
    }
    return files
  })()

  let promptItems: PromptItem[] = filteredFiles.map((f, i) =>
    fileToPromptItem(f, i, getTagsForPath)
  )
  const effectiveSort: LayoutSortBy =
    browseBy === 'date' || navFilter === 'recent' ? 'date' : sortBy
  if (effectiveSort === 'date') {
    promptItems = sortByRecent(promptItems)
    if (sortAsc) promptItems = [...promptItems].reverse()
  } else {
    promptItems = [...promptItems].sort((a, b) =>
      a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    )
    if (!sortAsc) promptItems = promptItems.reverse()
  }
  promptItems = promptItems.filter(
    (p) => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const syncedTagFilters = activeTagFilters.map((tag) => {
    const t = getTag(tag.id)
    return t ? { id: t.id, name: t.name, mode: tag.mode } : tag
  })

  return {
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
    activeTagFilters,
    setActiveTagFilters,
    folderFilter,
    setFolderFilter,
    dateFilter,
    setDateFilter,
    filePaths,
    folderOptions,
    filteredFiles,
    promptItems,
    syncedTagFilters,
  }
}
