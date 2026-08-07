export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'riven-theme'

export function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function saveTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
  root.dataset.theme = theme
}
