'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { getTagUsageCounts, searchTags, type TagId, type TagRecord } from '../lib/tagStore'

export interface TagFilterSelection {
  id: string
  name: string
}

interface TagFilterPopoverProps {
  open: boolean
  onClose: () => void
  filePaths: string[]
  selected: TagFilterSelection[]
  onChange: (tags: TagFilterSelection[]) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export default function TagFilterPopover({
  open,
  onClose,
  filePaths,
  selected,
  onChange,
  anchorRef,
}: TagFilterPopoverProps) {
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const usage = useMemo(() => getTagUsageCounts(filePaths), [filePaths, open])
  const tags = useMemo(() => searchTags(query), [query, open])
  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

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

  const toggleTag = (tag: TagRecord) => {
    if (selectedIds.has(tag.id)) {
      onChange(selected.filter((t) => t.id !== tag.id))
    } else {
      onChange([...selected, { id: tag.id, name: tag.name }])
    }
  }

  const removeTag = (id: TagId) => {
    onChange(selected.filter((t) => t.id !== id))
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[22rem] rounded-riven border border-riven-border bg-riven-card shadow-xl"
      role="dialog"
      aria-label="Filtrer par tags"
    >
      <div className="border-b border-riven-border p-3">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-riven-text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Tags"
            className="w-full rounded-riven border border-riven-border bg-riven-input py-2 pl-9 pr-3 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-accent focus:outline-none"
          />
        </div>
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full border border-riven-border bg-riven-selected px-2 py-0.5 text-xs text-riven-text-primary"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="text-riven-text-secondary hover:text-riven-text-primary"
                  title="Retirer"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto py-1">
        {tags.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-riven-text-secondary">Aucun tag</p>
        ) : (
          tags.map((tag) => {
            const active = selectedIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'bg-riven-selected text-riven-text-primary'
                    : 'text-riven-text-primary hover:bg-riven-main'
                }`}
              >
                <span className="truncate">{tag.name}</span>
                <span className="ml-3 shrink-0 text-xs text-riven-text-secondary">
                  {usage[tag.id] ?? 0}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
