'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  TagRecord,
  TagGroup,
  TagId,
  GroupId,
  listTags,
  listGroups,
  createTag,
  renameTag,
  deleteTag,
  deleteTags,
  createGroup,
  renameGroup,
  deleteGroup,
  moveTagsToGroup,
  getTagUsageCounts,
  getGroupTagCount,
  ensureMigrated,
  searchTags,
  getTagsCountFromStore,
} from '../lib/tagStore'

export function useTagStore(filePaths: string[] = []) {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    ensureMigrated()
    setTick((t) => t + 1)
  }, [])

  const tags = useMemo(() => {
    void tick
    return listTags()
  }, [tick])

  const groups = useMemo(() => {
    void tick
    return listGroups()
  }, [tick])

  const tagCount = useMemo(() => {
    void tick
    return getTagsCountFromStore()
  }, [tick])

  const usageCounts = useMemo(() => {
    void tick
    return getTagUsageCounts(filePaths)
  }, [tick, filePaths])

  const groupCounts = useMemo(() => {
    void tick
    const counts: Record<string, number> = {}
    for (const g of listGroups()) {
      counts[g.id] = getGroupTagCount(g.id)
    }
    return counts
  }, [tick])

  const filterTags = useCallback(
    (query: string, groupId: GroupId | null | 'all') => {
      void tick
      let result = query.trim() ? searchTags(query) : listTags()
      if (groupId !== 'all') {
        result = result.filter((t) => t.groupId === groupId)
      }
      return result
    },
    [tick]
  )

  const addTag = useCallback(
    (name: string, groupId: GroupId | null = null): TagRecord | null => {
      const tag = createTag(name, groupId)
      refresh()
      return tag
    },
    [refresh]
  )

  const updateTagName = useCallback(
    (id: TagId, name: string) => {
      renameTag(id, name)
      refresh()
    },
    [refresh]
  )

  const removeTag = useCallback(
    (id: TagId) => {
      deleteTag(id)
      refresh()
    },
    [refresh]
  )

  const removeTags = useCallback(
    (ids: TagId[]) => {
      deleteTags(ids)
      refresh()
    },
    [refresh]
  )

  const addGroup = useCallback(
    (name: string): TagGroup | null => {
      const group = createGroup(name)
      refresh()
      return group
    },
    [refresh]
  )

  const updateGroupName = useCallback(
    (id: GroupId, name: string) => {
      renameGroup(id, name)
      refresh()
    },
    [refresh]
  )

  const removeGroup = useCallback(
    (id: GroupId) => {
      deleteGroup(id)
      refresh()
    },
    [refresh]
  )

  const moveTags = useCallback(
    (ids: TagId[], groupId: GroupId | null) => {
      moveTagsToGroup(ids, groupId)
      refresh()
    },
    [refresh]
  )

  return {
    tick,
    refresh,
    tags,
    groups,
    tagCount,
    usageCounts,
    groupCounts,
    filterTags,
    addTag,
    updateTagName,
    removeTag,
    removeTags,
    addGroup,
    updateGroupName,
    removeGroup,
    moveTags,
  }
}
