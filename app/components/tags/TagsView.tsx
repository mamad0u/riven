'use client'

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTagStore } from '@/app/hooks/useTagStore'
import { GroupId, TagId } from '@/app/lib/tagStore'
import TagGroupPanel from './TagGroupPanel'
import TagListPanel from './TagListPanel'

export interface TagsViewHandle {
  focusSearch: () => void
}

interface TagsViewProps {
  filePaths: string[]
  onFilterByTag: (tagId: TagId, tagName: string) => void
  onTagsChanged?: () => void
}

const TagsView = forwardRef<TagsViewHandle, TagsViewProps>(function TagsView(
  { filePaths, onFilterByTag, onTagsChanged },
  ref
) {
  const store = useTagStore(filePaths)
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<GroupId | 'all'>('all')
  const [selectedTagId, setSelectedTagId] = useState<TagId | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<TagId>>(new Set())
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchRef.current?.focus()
      searchRef.current?.select()
    },
  }))

  const notify = useCallback(() => {
    onTagsChanged?.()
  }, [onTagsChanged])

  const visibleTags = useMemo(
    () => store.filterTags(searchQuery, selectedGroupId),
    [store, searchQuery, selectedGroupId]
  )

  const title =
    selectedGroupId === 'all'
      ? 'Tous'
      : store.groups.find((g) => g.id === selectedGroupId)?.name ?? 'Tous'

  const handleSearchSubmit = (q: string) => {
    const name = q.trim()
    if (!name) return
    const groupId = selectedGroupId === 'all' ? null : selectedGroupId
    const tag = store.addTag(name, groupId)
    if (tag) {
      setSearchQuery('')
      setSelectedTagId(tag.id)
      notify()
    }
  }

  const handleCreateGroup = () => {
    let name = 'Nouveau groupe'
    let n = 2
    const existing = new Set(store.groups.map((g) => g.name.toLowerCase()))
    while (existing.has(name.toLowerCase())) {
      name = `Nouveau groupe ${n++}`
    }
    const group = store.addGroup(name)
    if (group) {
      setSelectedGroupId(group.id)
      setRenamingGroupId(group.id)
      notify()
    }
  }

  const handleCreateTag = () => {
    const groupId = selectedGroupId === 'all' ? null : selectedGroupId
    let name = 'Nouveau tag'
    let n = 2
    const existing = new Set(store.tags.map((t) => t.name.toLowerCase()))
    while (existing.has(name.toLowerCase())) {
      name = `Nouveau tag ${n++}`
    }
    const tag = store.addTag(name, groupId)
    if (tag) {
      setSelectedTagId(tag.id)
      setRenamingTagId(tag.id)
      notify()
    }
  }

  const toggleCheck = (id: TagId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      <TagGroupPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchRef={searchRef}
        totalTagCount={store.tagCount}
        groups={store.groups}
        groupCounts={store.groupCounts}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(id) => {
          setSelectedGroupId(id)
          setSelectedTagId(null)
          setCheckedIds(new Set())
        }}
        onCreateGroup={handleCreateGroup}
        renamingGroupId={renamingGroupId}
        onRenameGroupSubmit={(id, name) => {
          store.updateGroupName(id, name)
          setRenamingGroupId(null)
          notify()
        }}
        onRenameGroupCancel={() => setRenamingGroupId(null)}
        onStartRenameGroup={setRenamingGroupId}
        onDeleteGroup={(id) => {
          if (!confirm('Supprimer ce groupe ? Les tags seront détachés, pas effacés.')) return
          store.removeGroup(id)
          if (selectedGroupId === id) setSelectedGroupId('all')
          notify()
        }}
      />
      <div className="mx-3 my-4 hidden w-px shrink-0 self-stretch bg-riven-border md:block" aria-hidden />
      <TagListPanel
        title={title}
        tags={visibleTags}
        usageCounts={store.usageCounts}
        groups={store.groups}
        selectedTagId={selectedTagId}
        checkedIds={checkedIds}
        onSelectTag={setSelectedTagId}
        onToggleCheck={toggleCheck}
        onCreateTag={handleCreateTag}
        renamingTagId={renamingTagId}
        onRenameTagSubmit={(id, name) => {
          store.updateTagName(id, name)
          setRenamingTagId(null)
          notify()
        }}
        onRenameTagCancel={() => setRenamingTagId(null)}
        onStartRenameTag={setRenamingTagId}
        onDeleteTag={(id) => {
          if (!confirm('Supprimer ce tag ?')) return
          store.removeTag(id)
          setCheckedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
          if (selectedTagId === id) setSelectedTagId(null)
          notify()
        }}
        onDeleteChecked={() => {
          if (!confirm(`Supprimer ${checkedIds.size} tag(s) ?`)) return
          store.removeTags([...checkedIds])
          setCheckedIds(new Set())
          setSelectedTagId(null)
          notify()
        }}
        onMoveChecked={(groupId) => {
          store.moveTags([...checkedIds], groupId)
          setCheckedIds(new Set())
          notify()
        }}
        onFilterByTag={(id) => {
          const tag = store.tags.find((t) => t.id === id)
          if (tag) onFilterByTag(id, tag.name)
        }}
      />
    </div>
  )
})

export default TagsView
