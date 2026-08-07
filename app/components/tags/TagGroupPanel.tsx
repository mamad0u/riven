'use client'

import { Plus, BookmarkPlus } from 'lucide-react'
import { TagGroup, GroupId } from '../../lib/tagStore'
import TagSearchInput from './TagSearchInput'
import InlineRename from '../InlineRename'
import ContextMenu, { ContextMenuItem } from '../ContextMenu'
import { useState, RefObject } from 'react'

interface TagGroupPanelProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  onSearchSubmit: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  totalTagCount: number
  groups: TagGroup[]
  groupCounts: Record<string, number>
  selectedGroupId: GroupId | 'all'
  onSelectGroup: (id: GroupId | 'all') => void
  onCreateGroup: () => void
  renamingGroupId: string | null
  onRenameGroupSubmit: (id: string, name: string) => void
  onRenameGroupCancel: () => void
  onStartRenameGroup: (id: string) => void
  onDeleteGroup: (id: string) => void
}

export default function TagGroupPanel({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchRef,
  totalTagCount,
  groups,
  groupCounts,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  renamingGroupId,
  onRenameGroupSubmit,
  onRenameGroupCancel,
  onStartRenameGroup,
  onDeleteGroup,
}: TagGroupPanelProps) {
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)

  const menuItems: ContextMenuItem[] = [
    { id: 'rename', label: 'Renommer' },
    { id: 'sep', label: '', separator: true },
    { id: 'delete', label: 'Supprimer', danger: true },
  ]

  return (
    <div className="flex h-full w-full flex-col md:w-56 md:shrink-0">
      <div className="p-3 pr-4">
        <TagSearchInput
          ref={searchRef}
          value={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <button
          type="button"
          onClick={() => onSelectGroup('all')}
          className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-riven px-3 py-2 text-sm transition-colors ${
            selectedGroupId === 'all'
              ? 'border border-riven-border bg-riven-selected text-riven-text-primary'
              : 'border border-transparent text-riven-text-secondary hover:bg-riven-card hover:text-riven-text-primary'
          }`}
        >
          <BookmarkPlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-left">Tous</span>
          <span className="text-xs text-riven-text-secondary">{totalTagCount}</span>
        </button>

        <div className="mt-3 flex items-center justify-between px-4 py-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-riven-text-secondary">
            Groupe
          </span>
          <button
            type="button"
            onClick={onCreateGroup}
            className="flex h-6 w-6 items-center justify-center rounded-riven text-riven-text-secondary transition-colors hover:bg-riven-selected hover:text-riven-text-primary"
            title="Nouveau groupe"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="px-4 py-2 text-xs text-riven-text-secondary">Aucun groupe</p>
        ) : (
          groups.map((group) => {
            const isSelected = selectedGroupId === group.id
            const isRenaming = renamingGroupId === group.id
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => !isRenaming && onSelectGroup(group.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, id: group.id })
                }}
                className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-riven px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'border border-riven-border bg-riven-selected text-riven-text-primary'
                    : 'border border-transparent text-riven-text-secondary hover:bg-riven-card hover:text-riven-text-primary'
                }`}
              >
                {isRenaming ? (
                  <InlineRename
                    value={group.name}
                    onSubmit={(name) => onRenameGroupSubmit(group.id, name)}
                    onCancel={onRenameGroupCancel}
                  />
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
                    <span className="text-xs text-riven-text-secondary">
                      {groupCounts[group.id] ?? 0}
                    </span>
                  </>
                )}
              </button>
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
            if (id === 'rename') onStartRenameGroup(menu.id)
            if (id === 'delete') onDeleteGroup(menu.id)
            setMenu(null)
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
