'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TrashItem } from '../../electron.d'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import PurgeConfirmModal from './PurgeConfirmModal'
import Button from './ui/Button'

interface TrashListViewProps {
  items: TrashItem[]
  onRestore: (ids: string[]) => void
  onPurge: (ids: string[]) => void
}

export default function TrashListView({ items, onRestore, onPurge }: TrashListViewProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; item: TrashItem } | null>(null)
  const [purgeIds, setPurgeIds] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const draggingRef = useRef(false)
  const dragAdditiveRef = useRef(false)
  const dragBaseRef = useRef<Set<string>>(new Set())

  // Nettoyer la sélection si la liste change
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => items.some((i) => i.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  useEffect(() => {
    const endDrag = () => {
      draggingRef.current = false
    }
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [])

  const toggleId = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(id)
    else next.delete(id)
    return next
  }

  const beginDragSelect = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return
    // Ne pas démarrer un drag depuis les boutons d'action
    if ((e.target as HTMLElement).closest('button')) return

    e.preventDefault()
    draggingRef.current = true
    dragAdditiveRef.current = e.ctrlKey || e.metaKey
    dragBaseRef.current = dragAdditiveRef.current ? new Set(selectedIds) : new Set()

    if (dragAdditiveRef.current) {
      const already = selectedIds.has(id)
      setSelectedIds(toggleId(dragBaseRef.current, id, !already))
    } else {
      setSelectedIds(new Set([id]))
    }
  }

  const dragOverItem = (id: string) => {
    if (!draggingRef.current) return
    if (dragAdditiveRef.current) {
      setSelectedIds(toggleId(dragBaseRef.current, id, true))
    } else {
      setSelectedIds((prev) => {
        if (prev.has(id) && prev.size === 1) return prev
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)))
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAll()
      }
      if (e.key === 'Escape') clearSelection()
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        e.preventDefault()
        setPurgeIds([...selectedIds])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectAll, clearSelection, selectedIds])

  const menuItems: ContextMenuItem[] = [
    { id: 'restore', label: selectedIds.size > 1 && selectedIds.has(menu?.item.id ?? '') ? `Restaurer (${selectedIds.size})` : 'Restaurer' },
    { id: 'sep1', label: '', separator: true },
    {
      id: 'purge',
      label:
        selectedIds.size > 1 && selectedIds.has(menu?.item.id ?? '')
          ? `Supprimer définitivement (${selectedIds.size})`
          : 'Supprimer définitivement',
      danger: true,
    },
  ]

  const selectedCount = selectedIds.size
  const purgeTargetName =
    purgeIds && purgeIds.length === 1
      ? items.find((i) => i.id === purgeIds[0])?.name ?? 'élément'
      : 'éléments'

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-riven-main text-riven-text-secondary">
        <p>La poubelle est vide</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-riven-main">
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-xs text-riven-text-secondary">
            {selectedCount} sélectionné(s)
          </span>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => {
              onRestore([...selectedIds])
              clearSelection()
            }}
          >
            Restaurer ({selectedCount})
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs text-red-400"
            onClick={() => setPurgeIds([...selectedIds])}
          >
            Purger ({selectedCount})
          </Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={clearSelection}>
            Annuler
          </Button>
        </div>
      )}

      <div
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 select-none"
        onMouseLeave={() => {
          if (draggingRef.current) draggingRef.current = false
        }}
      >
        {items.map((item) => {
          const selected = selectedIds.has(item.id)
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={selected}
              onMouseDown={(e) => beginDragSelect(e, item.id)}
              onMouseEnter={() => dragOverItem(item.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (!selectedIds.has(item.id)) {
                  setSelectedIds(new Set([item.id]))
                }
                setMenu({ x: e.clientX, y: e.clientY, item })
              }}
              className={`group flex items-center justify-between gap-3 rounded-riven border px-5 py-4 transition-colors ${
                selected
                  ? 'border-riven-accent bg-riven-selected'
                  : 'border-riven-border bg-riven-card hover:border-riven-accent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-riven-text-primary">
                  {item.isDirectory ? `[dossier] ${item.name}` : item.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-riven-text-secondary">
                  {item.originalPath}
                  {item.deletedAt ? ` · ${new Date(item.deletedAt).toLocaleString()}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRestore([item.id])
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      next.delete(item.id)
                      return next
                    })
                  }}
                >
                  Restaurer
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs text-red-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPurgeIds([item.id])
                  }}
                >
                  Purger
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onSelect={(id) => {
            const ids =
              selectedIds.has(menu.item.id) && selectedIds.size > 1
                ? [...selectedIds]
                : [menu.item.id]
            if (id === 'restore') {
              onRestore(ids)
              clearSelection()
            }
            if (id === 'purge') setPurgeIds(ids)
            setMenu(null)
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {purgeIds && purgeIds.length > 0 && (
        <PurgeConfirmModal
          fileName={purgeTargetName}
          count={purgeIds.length}
          onCancel={() => setPurgeIds(null)}
          onConfirm={() => {
            onPurge(purgeIds)
            setPurgeIds(null)
            clearSelection()
          }}
        />
      )}
    </div>
  )
}
