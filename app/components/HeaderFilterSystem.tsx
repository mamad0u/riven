'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  Folder,
  Search,
  BookmarkPlus,
  X,
} from 'lucide-react'
import {
  getTagUsageCounts,
  listGroups,
  listTags,
  type TagRecord,
} from '../lib/tagStore'
import { getFolderColor, resolveFolderColor } from '../lib/folderColors'

export type FilterCategory = 'file' | 'tags' | 'date'

export interface TagFilterSelection {
  id: string
  name: string
  /** include = doit avoir le tag ; exclude = ne doit pas l'avoir */
  mode?: 'include' | 'exclude'
}

export type DateFilterPreset = 'all' | 'today' | 'week' | 'month' | 'older'

interface HeaderFilterSystemProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePaths: string[]
  folders: { name: string; path: string }[]
  activeTagFilters: TagFilterSelection[]
  onTagFiltersChange: (tags: TagFilterSelection[]) => void
  folderFilter: string | null
  onFolderFilterChange: (path: string | null) => void
  dateFilter: DateFilterPreset
  onDateFilterChange: (preset: DateFilterPreset) => void
  /** Bouton funnel du header — pour ne pas fermer au clic dessus */
  funnelRef: React.RefObject<HTMLElement | null>
}

const CATEGORIES: {
  id: FilterCategory
  label: string
  icon: typeof Folder
}[] = [
  { id: 'file', label: 'Fichier', icon: Folder },
  { id: 'tags', label: 'Tags', icon: BookmarkPlus },
  { id: 'date', label: 'Date', icon: Calendar },
]

const DATE_OPTIONS: { id: DateFilterPreset; label: string }[] = [
  { id: 'all', label: 'Toutes les dates' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
  { id: 'older', label: 'Plus ancien' },
]

export default function HeaderFilterSystem({
  open,
  onOpenChange,
  filePaths,
  folders,
  activeTagFilters,
  onTagFiltersChange,
  folderFilter,
  onFolderFilterChange,
  dateFilter,
  onDateFilterChange,
  funnelRef,
}: HeaderFilterSystemProps) {
  const [category, setCategory] = useState<FilterCategory | null>(null)
  const [tagQuery, setTagQuery] = useState('')
  const [folderQuery, setFolderQuery] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string | 'all' | 'ungrouped'>('all')
  const panelRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const usage = useMemo(() => getTagUsageCounts(filePaths), [filePaths, open])
  const groups = useMemo(() => listGroups(), [open])
  const allTags = useMemo(() => listTags(), [open, activeTagFilters])

  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase()
    let tags = allTags
    if (selectedGroupId === 'ungrouped') {
      tags = tags.filter((t) => !t.groupId)
    } else if (selectedGroupId !== 'all') {
      tags = tags.filter((t) => t.groupId === selectedGroupId)
    }
    if (q) tags = tags.filter((t) => t.name.toLowerCase().includes(q))
    return tags
  }, [allTags, selectedGroupId, tagQuery])

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTags.length, ungrouped: 0 }
    for (const g of groups) counts[g.id] = 0
    for (const t of allTags) {
      if (!t.groupId) counts.ungrouped += 1
      else if (counts[t.groupId] !== undefined) counts[t.groupId] += 1
    }
    return counts
  }, [allTags, groups])

  const filteredFolders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    )
  }, [folders, folderQuery])

  useEffect(() => {
    if (!open) {
      setCategory(null)
      setTagQuery('')
      setFolderQuery('')
      return
    }
  }, [open])

  useEffect(() => {
    if (category === 'tags') {
      const t = window.setTimeout(() => tagInputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [category])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (barRef.current?.contains(target)) return
      if (funnelRef.current?.contains(target)) return
      setCategory(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (category) setCategory(null)
        else onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, category, onOpenChange, funnelRef])

  if (!open) return null

  const selectedMap = new Map(activeTagFilters.map((t) => [t.id, t]))

  const selectTag = (tag: TagRecord) => {
    const existing = selectedMap.get(tag.id)
    if (existing?.mode === 'include' || (existing && !existing.mode)) {
      onTagFiltersChange(activeTagFilters.filter((t) => t.id !== tag.id))
      return
    }
    const without = activeTagFilters.filter((t) => t.id !== tag.id)
    onTagFiltersChange([...without, { id: tag.id, name: tag.name, mode: 'include' }])
  }

  const excludeTag = (tag: TagRecord) => {
    const existing = selectedMap.get(tag.id)
    if (existing?.mode === 'exclude') {
      onTagFiltersChange(activeTagFilters.filter((t) => t.id !== tag.id))
      return
    }
    const without = activeTagFilters.filter((t) => t.id !== tag.id)
    onTagFiltersChange([...without, { id: tag.id, name: tag.name, mode: 'exclude' }])
  }

  return (
    <div className="app-no-drag relative bg-riven-main">
      <div
        ref={barRef}
        className="flex h-9 items-center gap-3 overflow-x-auto px-4 text-sm text-riven-text-secondary"
      >
        <span className="shrink-0 text-riven-text-primary">Ranger par</span>
        <span className="shrink-0 text-riven-border">|</span>
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = category === id
          const hasFilter =
            (id === 'tags' && activeTagFilters.length > 0) ||
            (id === 'file' && !!folderFilter) ||
            (id === 'date' && dateFilter !== 'all')
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCategory((c) => (c === id ? null : id))}
              className={`inline-flex shrink-0 items-center gap-1.5 transition-colors ${
                active || hasFilter
                  ? 'text-riven-text-primary'
                  : 'text-riven-text-secondary hover:text-riven-text-primary'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {hasFilter && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-riven-accent" />
              )}
            </button>
          )
        })}
      </div>

      {category && (
        <div
          ref={panelRef}
          className="absolute left-4 right-4 top-full z-50 mt-2 max-w-3xl overflow-hidden rounded-riven-lg border border-riven-border bg-riven-card shadow-2xl animate-capture-panel"
          role="dialog"
          aria-label={`Filtrer par ${category}`}
        >
          {category === 'tags' && (
            <>
              <div className="flex items-center gap-3 p-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-riven-text-secondary" />
                  <input
                    ref={tagInputRef}
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="Search tags"
                    className="w-full rounded-riven border border-riven-border bg-riven-input py-2 pl-9 pr-3 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none"
                  />
                </div>
                {activeTagFilters.length > 0 && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-riven-text-secondary hover:text-riven-text-primary"
                    onClick={() => onTagFiltersChange([])}
                  >
                    Tout effacer
                  </button>
                )}
              </div>

              <div className="flex max-h-80 min-h-[16rem]">
                <div className="w-44 shrink-0 overflow-y-auto border-r border-riven-border py-1">
                  {(
                    [
                      { id: 'all' as const, label: 'All Tags', count: groupCounts.all },
                      ...groups.map((g) => ({
                        id: g.id,
                        label: g.name,
                        count: groupCounts[g.id] ?? 0,
                      })),
                      {
                        id: 'ungrouped' as const,
                        label: 'autre',
                        count: groupCounts.ungrouped,
                      },
                    ] as { id: string; label: string; count: number }[]
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGroupId(g.id as typeof selectedGroupId)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                        selectedGroupId === g.id
                          ? 'bg-[#2563EB] text-white'
                          : 'text-riven-text-primary hover:bg-riven-selected'
                      }`}
                    >
                      <span className="truncate">{g.label}</span>
                      <span
                        className={`ml-2 shrink-0 ${
                          selectedGroupId === g.id ? 'text-white/80' : 'text-riven-text-secondary'
                        }`}
                      >
                        {g.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="min-w-0 flex-1 overflow-y-auto py-1">
                  {filteredTags.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-riven-text-secondary">
                      Aucun tag
                    </p>
                  ) : (
                    filteredTags.map((tag) => {
                      const sel = selectedMap.get(tag.id)
                      const included = sel && (sel.mode === 'include' || !sel.mode)
                      const excluded = sel?.mode === 'exclude'
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => selectTag(tag)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            excludeTag(tag)
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-riven-selected ${
                            included
                              ? 'bg-riven-selected'
                              : excluded
                                ? 'bg-red-950/40'
                                : ''
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                              included
                                ? 'border-riven-accent bg-riven-accent'
                                : excluded
                                  ? 'border-red-400 bg-red-400/20'
                                  : 'border-riven-border'
                            }`}
                          >
                            {included && (
                              <span className="text-[9px] font-bold text-black">✓</span>
                            )}
                            {excluded && (
                              <span className="text-[9px] font-bold text-red-300">−</span>
                            )}
                          </span>
                          <BookmarkPlus className="h-3.5 w-3.5 shrink-0 text-riven-text-secondary" />
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              excluded ? 'text-red-300 line-through' : 'text-riven-text-primary'
                            }`}
                          >
                            {tag.name}
                          </span>
                          <span className="shrink-0 text-xs text-riven-text-secondary">
                            {usage[tag.id] ?? 0}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2 text-[11px] text-riven-text-secondary">
                <div className="flex gap-3">
                  <span>
                    Select{' '}
                    <kbd className="rounded border border-riven-border bg-riven-main px-1.5 py-0.5">
                      L-Click
                    </kbd>
                  </span>
                  <span>
                    Exclude{' '}
                    <kbd className="rounded border border-riven-border bg-riven-main px-1.5 py-0.5">
                      R-Click
                    </kbd>
                  </span>
                </div>
                <span>
                  Close{' '}
                  <kbd className="rounded border border-riven-border bg-riven-main px-1.5 py-0.5">
                    ESC
                  </kbd>
                </span>
              </div>
            </>
          )}

          {category === 'file' && (
            <>
              <div className="border-b border-riven-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-riven-text-secondary" />
                  <input
                    value={folderQuery}
                    onChange={(e) => setFolderQuery(e.target.value)}
                    placeholder="Search folders"
                    className="w-full rounded-riven border border-riven-border bg-riven-input py-2 pl-9 pr-3 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => {
                    onFolderFilterChange(null)
                    setCategory(null)
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    !folderFilter
                      ? 'bg-riven-selected text-riven-text-primary'
                      : 'text-riven-text-primary hover:bg-riven-selected'
                  }`}
                >
                  <Folder className="h-3.5 w-3.5 text-riven-text-secondary" />
                  Tous les dossiers
                </button>
                {filteredFolders.map((folder, i) => {
                  const color = resolveFolderColor(folder.path, i)
                  return (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() => {
                      onFolderFilterChange(folder.path)
                      setCategory(null)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      folderFilter === folder.path
                        ? 'bg-riven-selected text-riven-text-primary'
                        : 'text-riven-text-primary hover:bg-riven-selected'
                    }`}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    <span className="truncate">{folder.name}</span>
                    <span className="ml-auto truncate text-xs text-riven-text-secondary">
                      {folder.path}
                    </span>
                  </button>
                  )
                })}
                {filteredFolders.length === 0 && (
                  <p className="px-3 py-8 text-center text-xs text-riven-text-secondary">
                    Aucun dossier
                  </p>
                )}
              </div>
            </>
          )}

          {category === 'date' && (
            <div className="py-1">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onDateFilterChange(opt.id)
                    setCategory(null)
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                    dateFilter === opt.id
                      ? 'bg-riven-selected text-riven-text-primary'
                      : 'text-riven-text-primary hover:bg-riven-selected'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5 text-riven-text-secondary" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(activeTagFilters.length > 0 || folderFilter || dateFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
          {folderFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-riven border border-riven-border bg-riven-selected px-2 py-1 text-xs text-riven-text-primary">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    getFolderColor(folderFilter) ?? 'var(--riven-folder-orange)',
                }}
                aria-hidden
              />
              Dossier : {folders.find((f) => f.path === folderFilter)?.name ?? folderFilter}
              <button
                type="button"
                className="text-riven-text-secondary hover:text-riven-text-primary"
                onClick={() => onFolderFilterChange(null)}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {dateFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-riven border border-riven-border bg-riven-selected px-2 py-1 text-xs text-riven-text-primary">
              Date : {DATE_OPTIONS.find((d) => d.id === dateFilter)?.label}
              <button
                type="button"
                className="text-riven-text-secondary hover:text-riven-text-primary"
                onClick={() => onDateFilterChange('all')}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeTagFilters.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1 rounded-riven border px-2 py-1 text-xs ${
                tag.mode === 'exclude'
                  ? 'border-red-500/40 bg-red-950/40 text-red-300'
                  : 'border-riven-border bg-riven-selected text-riven-text-primary'
              }`}
            >
              {tag.mode === 'exclude' ? 'Sans' : 'Tag'} : {tag.name}
              <button
                type="button"
                className="text-riven-text-secondary hover:text-riven-text-primary"
                onClick={() => onTagFiltersChange(activeTagFilters.filter((t) => t.id !== tag.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
