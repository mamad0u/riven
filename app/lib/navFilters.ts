export type NavFilter = 'all' | 'recent' | 'favorites' | 'tags' | 'trash'

export interface NavFilterItem {
  id: NavFilter
  label: string
}

export const NAV_FILTERS: NavFilterItem[] = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Récent' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'tags', label: 'Tags' },
  { id: 'trash', label: 'Poubelle' },
]

export interface NavCounts {
  all: number
  recent: number
  favorites: number
  tags: number
  trash: number
}

export function computeNavCounts(
  fileCount: number,
  favoritesCount: number,
  tagsCount: number,
  trashCount: number
): NavCounts {
  return {
    all: fileCount,
    recent: fileCount,
    favorites: favoritesCount,
    tags: tagsCount,
    trash: trashCount,
  }
}
