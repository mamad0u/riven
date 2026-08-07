'use client'

import { useState } from 'react'
import { Plus, BookmarkPlus, Trash2, FolderInput, Check } from 'lucide-react'
import { TagRecord, TagGroup, TagId, GroupId } from '@/app/lib/tagStore'
import InlineRename from '../InlineRename'
import ContextMenu, { ContextMenuItem } from '../ContextMenu'
import Button from '../ui/Button'

interface TagListPanelProps {
  title: string
  tags: TagRecord[]
  usageCounts: Record<string, number>
  groups: TagGroup[]
  selectedTagId: TagId | null
  checkedIds: Set<TagId>
  onSelectTag: (id: TagId) => void
  onToggleCheck: (id: TagId) => void
  onCreateTag: () => void
  renamingTagId: string | null
  onRenameTagSubmit: (id: string, name: string) => void
  onRenameTagCancel: () => void
  onStartRenameTag: (id: string) => void
  onDeleteTag: (id: string) => void
  onDeleteChecked: () => void
  onMoveChecked: (groupId: GroupId | null) => void
  onFilterByTag: (id: TagId) => void
}

export default function TagListPanel({
  title,
  tags,
  usageCounts,
  groups,
  selectedTagId,
  checkedIds,
  onSelectTag,
  onToggleCheck,
  onCreateTag,
  renamingTagId,
  onRenameTagSubmit,
  onRenameTagCancel,
  onStartRenameTag,
  onDeleteTag,
  onDeleteChecked,
  onMoveChecked,
  onFilterByTag,
}: TagListPanelProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)

  const menuItems: ContextMenuItem[] = [
    { id: 'filter', label: 'Voir les prompts' },
    { id: 'rename', label: 'Renommer' },
    { id: 'sep', label: '', separator: true },
    { id: 'delete', label: 'Supprimer', danger: true },
  ]

  const hasChecked = checkedIds.size > 0

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col pl-2">
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="truncate text-sm font-medium text-riven-text-primary">{title}</h2>
        <button
          type="button"
          onClick={onCreateTag}
          className="flex h-7 w-7 items-center justify-center rounded-riven text-riven-text-secondary transition-colors hover:bg-riven-selected hover:text-riven-text-primary"
          title="Nouveau tag"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {hasChecked && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2">
          <span className="text-xs text-riven-text-secondary">{checkedIds.size} sélectionné(s)</span>
          <div className="relative">
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => setMoveOpen((v) => !v)}
            >
              <FolderInput className="mr-1 h-3.5 w-3.5" />
              Déplacer
            </Button>
            {moveOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-riven border border-riven-border bg-riven-card py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-riven-selected"
                  onClick={() => {
                    onMoveChecked(null)
                    setMoveOpen(false)
                  }}
                >
                  Sans groupe
                </button>
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-riven-selected"
                    onClick={() => {
                      onMoveChecked(g.id)
                      setMoveOpen(false)
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" className="px-2 py-1 text-xs text-red-400" onClick={onDeleteChecked}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Supprimer
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tags.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-riven-text-secondary">Aucun tag</p>
        ) : (
          tags.map((tag) => {
            const isSelected = selectedTagId === tag.id
            const isRenaming = renamingTagId === tag.id
            const checked = checkedIds.has(tag.id)
            return (
              <div
                key={tag.id}
                className={`flex items-center gap-2.5 px-5 py-2 transition-colors ${
                  isSelected ? 'bg-riven-selected' : 'hover:bg-riven-selected/60'
                }`}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, id: tag.id })
                }}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleCheck(tag.id)
                  }}
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                    checked
                      ? 'border-riven-text-primary bg-riven-text-primary text-riven-main'
                      : 'border-riven-text-secondary/70 bg-transparent hover:border-riven-text-primary'
                  }`}
                >
                  {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </button>

                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onClick={() => onSelectTag(tag.id)}
                  onDoubleClick={() => onFilterByTag(tag.id)}
                >
                  <BookmarkPlus
                    className="h-4 w-4 shrink-0 text-riven-text-secondary"
                    strokeWidth={1.75}
                  />
                  {isRenaming ? (
                    <InlineRename
                      value={tag.name}
                      onSubmit={(name) => onRenameTagSubmit(tag.id, name)}
                      onCancel={onRenameTagCancel}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-riven-text-primary">
                      {tag.name}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-riven-text-secondary">
                    {usageCounts[tag.id] ?? 0}
                  </span>
                </button>
              </div>
            )
          })
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onSelect={(id) => {
            if (id === 'filter') onFilterByTag(menu.id)
            if (id === 'rename') onStartRenameTag(menu.id)
            if (id === 'delete') onDeleteTag(menu.id)
            setMenu(null)
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
