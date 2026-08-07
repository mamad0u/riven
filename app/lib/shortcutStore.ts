export type ShortcutId =
  | 'toggleSidebar'
  | 'capturePrompt'
  | 'tagSearch'
  | 'quickEdit'
  | 'dashboard'

export interface ShortcutDef {
  id: ShortcutId
  label: string
  /** Format interne : Ctrl+Shift+S, Alt+S, Shift+D… */
  accelerator: string
  scope: 'global' | 'renderer'
}

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  {
    id: 'toggleSidebar',
    label: 'Ouvrir / fermer la sidebar flottante',
    accelerator: 'Ctrl+Shift+S',
    scope: 'global',
  },
  {
    id: 'capturePrompt',
    label: 'Capture prompt',
    accelerator: 'Alt+Shift+C',
    scope: 'global',
  },
  {
    id: 'tagSearch',
    label: 'Recherche tags',
    accelerator: 'Alt+S',
    scope: 'renderer',
  },
  {
    id: 'quickEdit',
    label: 'Éditer (recherche rapide)',
    accelerator: 'Shift+M',
    scope: 'renderer',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    accelerator: 'Shift+D',
    scope: 'renderer',
  },
]

const STORAGE_KEY = 'riven-shortcuts'

type ShortcutMap = Record<ShortcutId, string>

function defaultsMap(): ShortcutMap {
  return Object.fromEntries(DEFAULT_SHORTCUTS.map((s) => [s.id, s.accelerator])) as ShortcutMap
}

export function loadShortcutMap(): ShortcutMap {
  const base = defaultsMap()
  if (typeof window === 'undefined') return base
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>
    return { ...base, ...parsed }
  } catch {
    return base
  }
}

export function saveShortcutMap(map: ShortcutMap) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getShortcutsList(map?: ShortcutMap): ShortcutDef[] {
  const m = map ?? loadShortcutMap()
  return DEFAULT_SHORTCUTS.map((s) => ({
    ...s,
    accelerator: m[s.id] ?? s.accelerator,
  }))
}

export function formatAcceleratorDisplay(accel: string): string {
  return accel
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' + ')
}

/** Convertit un KeyboardEvent en accélérateur interne (ex. Ctrl+Shift+S). */
export function eventToAccelerator(e: KeyboardEvent): string | null {
  const key = e.key
  if (!key || key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let k = key
  if (k === ' ') k = 'Space'
  else if (k.length === 1) k = k.toUpperCase()
  else k = k.charAt(0).toUpperCase() + k.slice(1)

  // Évite Shift+A quand on veut juste la lettre avec shift pour un symbole — on garde la lettre
  parts.push(k)
  return parts.join('+')
}

export function eventMatchesAccelerator(e: KeyboardEvent, accelerator: string): boolean {
  const want = accelerator
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  const needCtrl = want.some((p) =>
    ['ctrl', 'cmd', 'commandorcontrol', 'meta'].includes(p)
  )
  const needAlt = want.includes('alt')
  const needShift = want.includes('shift')
  const keyPart = want.find(
    (p) => !['ctrl', 'cmd', 'commandorcontrol', 'meta', 'alt', 'shift'].includes(p)
  )
  if (!keyPart) return false

  const hasCtrl = e.ctrlKey || e.metaKey
  if (needCtrl !== hasCtrl) return false
  if (needAlt !== e.altKey) return false
  if (needShift !== e.shiftKey) return false

  const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  return (
    pressed === keyPart ||
    e.code.replace(/^Key/i, '').toLowerCase() === keyPart
  )
}

/** Format Electron globalShortcut */
export function toElectronAccelerator(accel: string): string {
  return accel
    .split('+')
    .map((p) => {
      const t = p.trim()
      if (t.toLowerCase() === 'ctrl') return 'CommandOrControl'
      return t
    })
    .join('+')
}

export function findCollision(
  map: ShortcutMap,
  id: ShortcutId,
  accelerator: string
): ShortcutId | null {
  const norm = accelerator.toLowerCase()
  for (const [otherId, otherAccel] of Object.entries(map) as [ShortcutId, string][]) {
    if (otherId === id) continue
    if (otherAccel.toLowerCase() === norm) return otherId
  }
  return null
}

export function setShortcut(
  id: ShortcutId,
  accelerator: string
): { ok: true; map: ShortcutMap } | { ok: false; error: string; map: ShortcutMap } {
  const map = loadShortcutMap()
  const collision = findCollision(map, id, accelerator)
  if (collision) {
    const label = DEFAULT_SHORTCUTS.find((s) => s.id === collision)?.label ?? collision
    return { ok: false, error: `Déjà utilisé par « ${label} »`, map }
  }
  map[id] = accelerator
  saveShortcutMap(map)
  return { ok: true, map }
}

export function resetShortcuts(): ShortcutMap {
  const map = defaultsMap()
  saveShortcutMap(map)
  return map
}
