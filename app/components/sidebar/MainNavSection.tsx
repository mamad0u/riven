'use client'

import { LayoutGrid, Clock, Star, Tag, Trash2, LucideIcon } from 'lucide-react'
import { NavFilter, NAV_FILTERS, NavCounts } from '../../lib/navFilters'

const ICONS: Record<NavFilter, LucideIcon> = {
  all: LayoutGrid,
  recent: Clock,
  favorites: Star,
  tags: Tag,
  trash: Trash2,
}

interface MainNavSectionProps {
  activeFilter: NavFilter | null
  counts: NavCounts
  onFilterChange: (filter: NavFilter) => void
  collapsed?: boolean
}

export default function MainNavSection({
  activeFilter,
  counts,
  onFilterChange,
  collapsed = false,
}: MainNavSectionProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        {NAV_FILTERS.map((item) => {
          const Icon = ICONS[item.id]
          const isActive = activeFilter === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              title={item.label}
              className="sidebar-row-icon"
              data-selected={isActive ? 'true' : 'false'}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="border-b border-riven-border py-2">
      {NAV_FILTERS.map((item) => {
        const Icon = ICONS[item.id]
        const isActive = activeFilter === item.id
        const count = counts[item.id]
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className="sidebar-row gap-3"
            data-selected={isActive ? 'true' : 'false'}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <span className="text-xs text-riven-text-secondary">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
