import {
  ensureMigrated,
  getTagsCountFromStore,
  resolveTagLabels,
} from './tagStore'

export interface PromptMetadata {
  path: string
  favorite: boolean
  tags: string[]
  trashed: boolean
  /** Couleur hex du dossier (chemins de dossiers uniquement) */
  folderColor?: string
}

const STORAGE_KEY = 'riven-prompt-metadata'

function loadAll(): Record<string, PromptMetadata> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, PromptMetadata>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getPromptMetadata(path: string): PromptMetadata {
  const all = loadAll()
  return all[path] ?? { path, favorite: false, tags: [], trashed: false }
}

export function setPromptMetadata(path: string, meta: Partial<PromptMetadata>) {
  const all = loadAll()
  all[path] = { ...getPromptMetadata(path), ...meta, path }
  saveAll(all)
}

export function isFavorite(path: string): boolean {
  return getPromptMetadata(path).favorite
}

export function toggleFavorite(path: string): boolean {
  const next = !isFavorite(path)
  setPromptMetadata(path, { favorite: next })
  return next
}

export function getFavoritePaths(): string[] {
  return Object.values(loadAll())
    .filter((m) => m.favorite)
    .map((m) => m.path)
}

export function renameMetadataPath(oldPath: string, newPath: string) {
  if (oldPath === newPath) return
  const all = loadAll()
  const existing = all[oldPath]
  if (!existing) return
  delete all[oldPath]
  all[newPath] = { ...existing, path: newPath }
  // Also remap nested paths if a folder was renamed
  const prefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`
  const newPrefix = newPath.endsWith('/') ? newPath : `${newPath}/`
  for (const key of Object.keys(all)) {
    if (key.startsWith(prefix)) {
      const meta = all[key]
      const remapped = newPrefix + key.slice(prefix.length)
      delete all[key]
      all[remapped] = { ...meta, path: remapped }
    }
  }
  saveAll(all)
}

export function removeMetadataPath(path: string) {
  const all = loadAll()
  delete all[path]
  const prefix = path.endsWith('/') ? path : `${path}/`
  for (const key of Object.keys(all)) {
    if (key.startsWith(prefix)) delete all[key]
  }
  saveAll(all)
}

export function getFavoritesCount(): number {
  return Object.values(loadAll()).filter((m) => m.favorite).length
}

export function getTagsCount(): number {
  ensureMigrated()
  return getTagsCountFromStore()
}

/** @deprecated Trash is FS-based; keep for compatibility, always returns 0. */
export function getTrashCount(): number {
  return 0
}

export function getTagsForPath(path: string, index?: number): { label: string; variant: 'green' | 'purple' }[] {
  const meta = getPromptMetadata(path)
  ensureMigrated()
  return resolveTagLabels(meta.tags, index ?? 0).map(({ label, variant }) => ({ label, variant }))
}

export function getTagIdsForPath(path: string): string[] {
  return getPromptMetadata(path).tags
}

export function setTagIdsForPath(path: string, tagIds: string[]) {
  setPromptMetadata(path, { tags: [...new Set(tagIds)] })
}

export function removeTagIdFromAllMetadata(tagId: string) {
  const all = loadAll()
  let changed = false
  for (const path of Object.keys(all)) {
    if (!all[path].tags.includes(tagId)) continue
    all[path] = { ...all[path], tags: all[path].tags.filter((t) => t !== tagId) }
    changed = true
  }
  if (changed) saveAll(all)
}
