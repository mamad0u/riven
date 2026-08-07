'use client'

import { useEffect, useRef } from 'react'
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react'

export type LayoutViewMode = 'list' | 'grid'
export type LayoutSortBy = 'date' | 'name' | 'file'

export interface LayoutDisplayPrefs {
  showName: boolean
  showDossier: boolean
  showTags: boolean
  showFavoris: boolean
  showSidebar: boolean
  showSearchBar: boolean
}

export const DEFAULT_LAYOUT_DISPLAY: LayoutDisplayPrefs = {
  showName: true,
  showDossier: true,
  showTags: true,
  showFavoris: true,
  showSidebar: true,
  showSearchBar: true,
}

interface LayoutSettingsPopoverProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  viewMode: LayoutViewMode
  onViewModeChange: (mode: LayoutViewMode) => void
  sortBy: LayoutSortBy
  onSortByChange: (sort: LayoutSortBy) => void
  sortAsc: boolean
  onSortAscChange: (asc: boolean) => void
  display: LayoutDisplayPrefs
  onDisplayChange: (next: LayoutDisplayPrefs) => void
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-riven-text-primary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-riven-border'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'left-4' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  )
}

export default function LayoutSettingsPopover({
  open,
  onClose,
  anchorRef,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  sortAsc,
  onSortAscChange,
  display,
  onDisplayChange,
}: LayoutSettingsPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  const setDisplay = <K extends keyof LayoutDisplayPrefs>(key: K, value: LayoutDisplayPrefs[K]) => {
    onDisplayChange({ ...display, [key]: value })
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-riven border border-riven-border bg-riven-card p-3 shadow-xl"
      role="dialog"
      aria-label="Paramètres de layout"
    >
      <div className="mb-3">
        <label className="mb-1 block text-xs text-riven-text-secondary">Layout</label>
        <select
          value={viewMode}
          onChange={(e) => onViewModeChange(e.target.value as LayoutViewMode)}
          className="w-full rounded-riven border border-riven-border bg-riven-input px-2 py-1.5 text-sm text-riven-text-primary focus:border-riven-accent focus:outline-none"
        >
          <option value="list">Liste</option>
          <option value="grid">Grille</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-riven-text-secondary">Sort by</label>
        <div className="flex items-center gap-1.5">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as LayoutSortBy)}
            className="min-w-0 flex-1 rounded-riven border border-riven-border bg-riven-input px-2 py-1.5 text-sm text-riven-text-primary focus:border-riven-accent focus:outline-none"
          >
            <option value="date">Par date</option>
            <option value="name">Par nom</option>
            <option value="file">Par fichier</option>
          </select>
          <button
            type="button"
            title={sortAsc ? 'Croissant' : 'Décroissant'}
            onClick={() => onSortAscChange(!sortAsc)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-riven border border-riven-border text-riven-text-secondary hover:border-riven-accent hover:text-riven-text-primary"
          >
            {sortAsc ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="space-y-0.5 border-t border-riven-border pt-2">
        <ToggleRow
          label="Show Name"
          checked={display.showName}
          onChange={(v) => setDisplay('showName', v)}
        />
        <ToggleRow
          label="Show Dossier"
          checked={display.showDossier}
          onChange={(v) => setDisplay('showDossier', v)}
        />
        <ToggleRow
          label="Show Tags"
          checked={display.showTags}
          onChange={(v) => setDisplay('showTags', v)}
        />
        <ToggleRow
          label="Favoris"
          checked={display.showFavoris}
          onChange={(v) => setDisplay('showFavoris', v)}
        />
        <ToggleRow
          label="Show Sidebar"
          checked={display.showSidebar}
          onChange={(v) => setDisplay('showSidebar', v)}
        />
        <ToggleRow
          label="Show Search barre"
          checked={display.showSearchBar}
          onChange={(v) => setDisplay('showSearchBar', v)}
        />
      </div>
    </div>
  )
}
