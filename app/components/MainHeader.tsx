'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Pin, Funnel, LayoutGrid, Search } from 'lucide-react'
import IconButton from './ui/IconButton'
import WindowControls from './WindowControls'
import HeaderFilterSystem, {
  type DateFilterPreset,
  type TagFilterSelection,
} from './HeaderFilterSystem'
import LayoutSettingsPopover, {
  type LayoutDisplayPrefs,
  type LayoutSortBy,
  type LayoutViewMode,
} from './LayoutSettingsPopover'

export type BrowseBy = 'file' | 'tags' | 'date'
export type { TagFilterSelection, DateFilterPreset }

interface MainHeaderProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  viewMode: LayoutViewMode
  onViewModeChange: (mode: LayoutViewMode) => void
  activeTagFilters?: TagFilterSelection[]
  onTagFiltersChange?: (tags: TagFilterSelection[]) => void
  filePaths?: string[]
  folders?: { name: string; path: string }[]
  folderFilter?: string | null
  onFolderFilterChange?: (path: string | null) => void
  dateFilter?: DateFilterPreset
  onDateFilterChange?: (preset: DateFilterPreset) => void
  sortBy: LayoutSortBy
  onSortByChange: (sort: LayoutSortBy) => void
  sortAsc: boolean
  onSortAscChange: (asc: boolean) => void
  displayPrefs: LayoutDisplayPrefs
  onDisplayPrefsChange: (prefs: LayoutDisplayPrefs) => void
  showWindowControls?: boolean
  leading?: ReactNode
}

const HEADER_ICON_BTN = '!h-8 !w-8 !min-h-8 !min-w-8 shrink-0 p-0'

export default function MainHeader({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  activeTagFilters = [],
  onTagFiltersChange,
  filePaths = [],
  folders = [],
  folderFilter = null,
  onFolderFilterChange,
  dateFilter = 'all',
  onDateFilterChange,
  sortBy,
  onSortByChange,
  sortAsc,
  onSortAscChange,
  displayPrefs,
  onDisplayPrefsChange,
  showWindowControls = true,
  leading,
}: MainHeaderProps) {
  const [pinned, setPinned] = useState(false)
  const [filterBarOpen, setFilterBarOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const layoutBtnRef = useRef<HTMLButtonElement>(null)

  const hasActiveFilters = useMemo(
    () =>
      activeTagFilters.length > 0 ||
      !!folderFilter ||
      (dateFilter !== 'all' && dateFilter != null),
    [activeTagFilters, folderFilter, dateFilter]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const api = window.electronAPI?.windowControls
      if (!api?.isAlwaysOnTop) return
      const value = await api.isAlwaysOnTop()
      if (!cancelled) setPinned(value)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handlePin = async () => {
    const api = window.electronAPI?.windowControls
    if (!api?.toggleAlwaysOnTop) {
      setPinned((v) => !v)
      return
    }
    const next = await api.toggleAlwaysOnTop()
    setPinned(next)
  }

  return (
    <div className="app-drag flex flex-col bg-riven-main">
      <div className="flex h-12 items-center gap-2 pr-0">
        {leading ?? <div className="min-w-0 flex-1" />}

        <div className="app-no-drag flex shrink-0 items-center gap-2">
          <IconButton
            size="sm"
            className={HEADER_ICON_BTN}
            active={pinned}
            onClick={handlePin}
            title="L'app est priorisé par rapport au autre page présente sur l'écrans"
          >
            <Pin className="h-3.5 w-3.5 shrink-0" />
          </IconButton>

          <IconButton
            ref={filterBtnRef}
            size="sm"
            className={HEADER_ICON_BTN}
            active={filterBarOpen || hasActiveFilters}
            onClick={() => {
              setLayoutOpen(false)
              setFilterBarOpen((v) => !v)
            }}
            title="Filtrer les fichiers"
          >
            <Funnel className="h-3.5 w-3.5 shrink-0" />
          </IconButton>

          <div className="relative shrink-0">
            <IconButton
              ref={layoutBtnRef}
              size="sm"
              className={HEADER_ICON_BTN}
              active={layoutOpen}
              onClick={() => {
                setFilterBarOpen(false)
                setLayoutOpen((v) => !v)
              }}
              title="Te permet de choisir le type de layout de la liste"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
            </IconButton>
            <LayoutSettingsPopover
              open={layoutOpen}
              onClose={() => setLayoutOpen(false)}
              anchorRef={layoutBtnRef}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              sortBy={sortBy}
              onSortByChange={onSortByChange}
              sortAsc={sortAsc}
              onSortAscChange={onSortAscChange}
              display={displayPrefs}
              onDisplayChange={onDisplayPrefsChange}
            />
          </div>

          {displayPrefs.showSearchBar && (
            <div className="relative w-full min-w-0 max-w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-riven-text-secondary" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search prompts..."
                className="w-full rounded-md border border-riven-border bg-riven-input py-1.5 pl-8 pr-3 text-xs text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        {showWindowControls && <WindowControls />}
      </div>

      {onTagFiltersChange && onFolderFilterChange && onDateFilterChange && (
        <HeaderFilterSystem
          open={filterBarOpen}
          onOpenChange={setFilterBarOpen}
          filePaths={filePaths}
          folders={folders}
          activeTagFilters={activeTagFilters}
          onTagFiltersChange={onTagFiltersChange}
          folderFilter={folderFilter}
          onFolderFilterChange={onFolderFilterChange}
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
          funnelRef={filterBtnRef}
        />
      )}
    </div>
  )
}
