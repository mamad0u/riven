export type TagId = string
export type GroupId = string

export interface TagRecord {
  id: TagId
  name: string
  groupId: GroupId | null
  createdAt: number
}

export interface TagGroup {
  id: GroupId
  name: string
  order: number
}

export interface TagStoreData {
  tags: Record<TagId, TagRecord>
  groups: Record<GroupId, TagGroup>
  version: 1
}

const STORAGE_KEY = 'riven-tag-store'
const META_STORAGE_KEY = 'riven-prompt-metadata'

function emptyStore(): TagStoreData {
  return { tags: {}, groups: {}, version: 1 }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadStore(): TagStoreData {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as TagStoreData
    if (!parsed || parsed.version !== 1) return emptyStore()
    return {
      tags: parsed.tags ?? {},
      groups: parsed.groups ?? {},
      version: 1,
    }
  } catch {
    return emptyStore()
  }
}

function saveStore(data: TagStoreData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadAllMetadata(): Record<string, { path: string; tags: string[]; favorite?: boolean; trashed?: boolean }> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAllMetadata(
  data: Record<string, { path: string; tags: string[]; favorite?: boolean; trashed?: boolean }>
) {
  if (typeof window === 'undefined') return
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(data))
}

let migrated = false

/** Migrate legacy string tag names in metadata to stable tag IDs. */
export function ensureMigrated(): TagStoreData {
  const store = loadStore()
  if (typeof window === 'undefined') return store
  if (migrated) return store

  const meta = loadAllMetadata()
  let changedStore = false
  let changedMeta = false

  const nameToId = new Map<string, TagId>()
  for (const tag of Object.values(store.tags)) {
    nameToId.set(tag.name.toLowerCase(), tag.id)
  }

  for (const path of Object.keys(meta)) {
    const entry = meta[path]
    if (!entry?.tags?.length) continue
    const nextIds: string[] = []
    for (const raw of entry.tags) {
      if (store.tags[raw]) {
        nextIds.push(raw)
        continue
      }
      const key = raw.toLowerCase()
      let id = nameToId.get(key)
      if (!id) {
        id = newId('tag')
        store.tags[id] = {
          id,
          name: raw,
          groupId: null,
          createdAt: Date.now(),
        }
        nameToId.set(key, id)
        changedStore = true
      }
      nextIds.push(id)
    }
    const unique = [...new Set(nextIds)]
    if (unique.join('|') !== entry.tags.join('|')) {
      meta[path] = { ...entry, tags: unique }
      changedMeta = true
    }
  }

  if (changedStore) saveStore(store)
  if (changedMeta) saveAllMetadata(meta)
  migrated = true
  return store
}

function withStore(mutator: (store: TagStoreData) => void): TagStoreData {
  const store = ensureMigrated()
  mutator(store)
  saveStore(store)
  return store
}

export function getStoreSnapshot(): TagStoreData {
  return ensureMigrated()
}

export function listTags(): TagRecord[] {
  return Object.values(ensureMigrated().tags).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  )
}

export function listGroups(): TagGroup[] {
  return Object.values(ensureMigrated().groups).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'))
}

export function getTag(id: TagId): TagRecord | null {
  return ensureMigrated().tags[id] ?? null
}

export function getGroup(id: GroupId): TagGroup | null {
  return ensureMigrated().groups[id] ?? null
}

export function getTagsCountFromStore(): number {
  return Object.keys(ensureMigrated().tags).length
}

export function searchTags(query: string): TagRecord[] {
  const q = query.trim().toLowerCase()
  const tags = listTags()
  if (!q) return tags
  return tags.filter((t) => t.name.toLowerCase().includes(q))
}

export function createTag(name: string, groupId: GroupId | null = null): TagRecord | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const store = ensureMigrated()
  const existing = Object.values(store.tags).find(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (existing) {
    if (groupId !== null && existing.groupId !== groupId) {
      existing.groupId = groupId
      saveStore(store)
    }
    return existing
  }
  const tag: TagRecord = {
    id: newId('tag'),
    name: trimmed,
    groupId,
    createdAt: Date.now(),
  }
  withStore((s) => {
    s.tags[tag.id] = tag
  })
  return tag
}

export function renameTag(id: TagId, name: string): TagRecord | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  let result: TagRecord | null = null
  withStore((s) => {
    const tag = s.tags[id]
    if (!tag) return
    tag.name = trimmed
    result = tag
  })
  return result
}

export function deleteTag(id: TagId): boolean {
  const store = ensureMigrated()
  if (!store.tags[id]) return false
  delete store.tags[id]
  saveStore(store)

  const meta = loadAllMetadata()
  let changed = false
  for (const path of Object.keys(meta)) {
    const entry = meta[path]
    if (!entry?.tags?.includes(id)) continue
    meta[path] = { ...entry, tags: entry.tags.filter((t) => t !== id) }
    changed = true
  }
  if (changed) saveAllMetadata(meta)
  return true
}

export function deleteTags(ids: TagId[]): void {
  for (const id of ids) deleteTag(id)
}

export function createGroup(name: string): TagGroup | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const groups = listGroups()
  const maxOrder = groups.reduce((m, g) => Math.max(m, g.order), -1)
  const group: TagGroup = {
    id: newId('grp'),
    name: trimmed,
    order: maxOrder + 1,
  }
  withStore((s) => {
    s.groups[group.id] = group
  })
  return group
}

export function renameGroup(id: GroupId, name: string): TagGroup | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  let result: TagGroup | null = null
  withStore((s) => {
    const group = s.groups[id]
    if (!group) return
    group.name = trimmed
    result = group
  })
  return result
}

export function deleteGroup(id: GroupId): boolean {
  let ok = false
  withStore((s) => {
    if (!s.groups[id]) return
    delete s.groups[id]
    for (const tag of Object.values(s.tags)) {
      if (tag.groupId === id) tag.groupId = null
    }
    ok = true
  })
  return ok
}

export function moveTagsToGroup(tagIds: TagId[], groupId: GroupId | null): void {
  withStore((s) => {
    for (const id of tagIds) {
      const tag = s.tags[id]
      if (tag) tag.groupId = groupId
    }
  })
}

export function getTagUsageCounts(filePaths: string[]): Record<TagId, number> {
  const meta = loadAllMetadata()
  const counts: Record<TagId, number> = {}
  for (const path of filePaths) {
    const tags = meta[path]?.tags ?? []
    for (const id of tags) {
      counts[id] = (counts[id] ?? 0) + 1
    }
  }
  return counts
}

export function getGroupTagCount(groupId: GroupId): number {
  return Object.values(ensureMigrated().tags).filter((t) => t.groupId === groupId).length
}

export function resolveTagLabels(
  tagIds: string[],
  indexOffset = 0
): { id: string; label: string; variant: 'green' | 'purple' }[] {
  const store = ensureMigrated()
  return tagIds
    .map((id, i) => {
      const tag = store.tags[id]
      if (!tag) return null
      return {
        id,
        label: tag.name,
        variant: ((i + indexOffset) % 2 === 0 ? 'green' : 'purple') as 'green' | 'purple',
      }
    })
    .filter((t): t is { id: string; label: string; variant: 'green' | 'purple' } => t !== null)
}
