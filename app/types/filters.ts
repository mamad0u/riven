/** Sélection d'un tag comme filtre (dashboard, sidebar, etc.). */
export interface TagFilterSelection {
  id: string
  name: string
  /** include = doit avoir le tag ; exclude = ne doit pas l'avoir */
  mode?: 'include' | 'exclude'
}

export type DateFilterPreset = 'all' | 'today' | 'week' | 'month' | 'older'
