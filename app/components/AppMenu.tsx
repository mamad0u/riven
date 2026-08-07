'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import type { FileItem } from '@/electron.d'
import {
  ShortcutId,
  getShortcutsList,
  setShortcut,
  resetShortcuts,
  formatAcceleratorDisplay,
  eventToAccelerator,
} from '../lib/shortcutStore'
import { ThemeMode, applyTheme, loadTheme, saveTheme } from '../lib/themeStore'

type MenuSection = 'fichiers' | 'raccourcis' | 'personnalisation' | 'informations'

const SECTIONS: { id: MenuSection; label: string }[] = [
  { id: 'fichiers', label: 'Fichiers' },
  { id: 'raccourcis', label: 'Raccourcie' },
  { id: 'personnalisation', label: 'Personnalisation' },
  { id: 'informations', label: 'Informations' },
]

const SECTION_KEYWORDS: Record<MenuSection, string[]> = {
  fichiers: ['importer', 'exporter', 'emplacement', 'sauvegarde', 'dossier'],
  raccourcis: ['raccourci', 'clavier', 'shortcut', 'capture', 'dashboard', 'tags'],
  personnalisation: ['dark', 'light', 'thème', 'theme', 'mode'],
  informations: ['version', 'riven', 'à propos', 'infos'],
}

interface AppMenuProps {
  open: boolean
  onClose: () => void
  sidebarWidth?: number
  currentFilePath?: string | null
  onImportedFile?: (file: FileItem) => void
  onTreeChanged?: () => void
}

export default function AppMenu({
  open,
  onClose,
  sidebarWidth = 256,
  currentFilePath = null,
  onImportedFile,
  onTreeChanged,
}: AppMenuProps) {
  const [section, setSection] = useState<MenuSection>('fichiers')
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [basePath, setBasePath] = useState('')
  const [version, setVersion] = useState('0.1.0')
  const [shortcutTick, setShortcutTick] = useState(0)
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const shortcuts = useMemo(() => {
    void shortcutTick
    return getShortcutsList()
  }, [shortcutTick])

  const refreshBasePath = useCallback(async () => {
    if (!window.electronAPI?.fileManager) return
    try {
      const p = await window.electronAPI.fileManager.getBasePath()
      setBasePath(p)
    } catch {
      setBasePath('')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setTheme(loadTheme())
    void refreshBasePath()
    void window.electronAPI?.getAppVersion?.().then((v) => {
      if (v) setVersion(v)
    })
    setShortcutTick((t) => t + 1)
  }, [open, refreshBasePath])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (recordingId) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, recordingId])

  useEffect(() => {
    if (!recordingId) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecordingId(null)
        setShortcutError(null)
        return
      }
      const accel = eventToAccelerator(e)
      if (!accel) return
      const result = setShortcut(recordingId, accel)
      if (!result.ok) {
        setShortcutError(result.error)
        return
      }
      setShortcutError(null)
      setRecordingId(null)
      setShortcutTick((t) => t + 1)

      const map = result.map
      void window.electronAPI?.setGlobalShortcuts?.({
        toggleSidebar: map.toggleSidebar,
        capturePrompt: map.capturePrompt,
      })
      window.dispatchEvent(new CustomEvent('riven-shortcuts-changed'))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recordingId])

  useEffect(() => {
    if (open) {
      setSection('fichiers')
      setQuery('')
      setRecordingId(null)
      setShortcutError(null)
      setActionMessage(null)
    }
  }, [open])

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS.filter((s) => {
      if (s.label.toLowerCase().includes(q)) return true
      return SECTION_KEYWORDS[s.id].some((k) => k.includes(q) || q.includes(k))
    })
  }, [query])

  useEffect(() => {
    if (filteredSections.length === 0) return
    if (!filteredSections.some((s) => s.id === section)) {
      setSection(filteredSections[0].id)
    }
  }, [filteredSections, section])

  const handleImport = async () => {
    if (!window.electronAPI?.fileManager?.importFile) return
    setBusy(true)
    setActionMessage(null)
    try {
      const result = await window.electronAPI.fileManager.importFile()
      if ('error' in result) {
        if (result.error !== 'cancelled') setActionMessage(result.error)
        return
      }
      setActionMessage(`Importé : ${result.name}`)
      onTreeChanged?.()
      const file: FileItem = {
        name: result.name,
        path: result.path,
        fullPath: result.fullPath,
        isDirectory: false,
        isFile: true,
        size: 0,
        created: new Date(),
        modified: new Date(),
      }
      if (/\.(md|txt|markdown)$/i.test(result.name)) {
        onImportedFile?.(file)
        onClose()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    if (!currentFilePath) {
      setActionMessage('Sélectionnez un fichier')
      return
    }
    if (!window.electronAPI?.fileManager?.exportFile) return
    setBusy(true)
    setActionMessage(null)
    try {
      const result = await window.electronAPI.fileManager.exportFile(currentFilePath)
      if ('error' in result) {
        if (result.error !== 'cancelled') setActionMessage(result.error)
        return
      }
      setActionMessage('Fichier exporté')
    } finally {
      setBusy(false)
    }
  }

  const handleChooseBasePath = async () => {
    if (!window.electronAPI?.openDirectoryDialog || !window.electronAPI.fileManager?.setBasePath) {
      return
    }
    setBusy(true)
    setActionMessage(null)
    try {
      const picked = await window.electronAPI.openDirectoryDialog()
      if ('error' in picked) {
        if (picked.error !== 'cancelled') setActionMessage(picked.error)
        return
      }
      const result = await window.electronAPI.fileManager.setBasePath(picked.path)
      if ('error' in result) {
        setActionMessage(result.error)
        return
      }
      setBasePath(result.path)
      setActionMessage('Emplacement mis à jour')
      onTreeChanged?.()
    } finally {
      setBusy(false)
    }
  }

  const handleTheme = (next: ThemeMode) => {
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  const handleResetShortcuts = () => {
    const map = resetShortcuts()
    setShortcutTick((t) => t + 1)
    setShortcutError(null)
    void window.electronAPI?.setGlobalShortcuts?.({
      toggleSidebar: map.toggleSidebar,
      capturePrompt: map.capturePrompt,
    })
    window.dispatchEvent(new CustomEvent('riven-shortcuts-changed'))
    setActionMessage('Raccourcis réinitialisés')
  }

  if (!open) return null

  const top = 56
  const leftPanelWidth = sidebarWidth - 16

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default bg-transparent"
        aria-label="Fermer le menu"
        onClick={onClose}
      />

      <div
        className="app-no-drag fixed z-[95] flex items-start gap-2"
        style={{ top, left: 8 }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu application"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 flex-col gap-3 rounded-2xl border border-riven-border bg-riven-sidebar p-3 shadow-2xl"
          style={{ width: leftPanelWidth }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-riven-border bg-riven-input px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-riven-text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search options ..."
              className="min-w-0 flex-1 bg-transparent text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:outline-none"
              autoFocus
            />
          </div>

          <nav className="flex flex-col gap-1">
            {filteredSections.map((item) => {
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'border border-riven-border bg-riven-selected text-riven-text-primary'
                      : 'border border-transparent text-riven-text-primary hover:bg-riven-card'
                  }`}
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-riven-text-secondary" />
                </button>
              )
            })}
            {filteredSections.length === 0 && (
              <p className="px-2 py-3 text-xs text-riven-text-secondary">Aucun résultat</p>
            )}
          </nav>
        </div>

        <div className="w-[min(400px,calc(100vw-18rem))] rounded-2xl border border-riven-border bg-riven-sidebar p-4 shadow-2xl">
          {section === 'fichiers' && (
            <div className="flex flex-col gap-2">
              <MenuActionRow
                label="Importer un fichier"
                action="Importer"
                disabled={busy}
                onAction={handleImport}
              />
              <MenuActionRow
                label="Exporter un fichier"
                action="Exporter"
                disabled={busy}
                onAction={handleExport}
              />
              <MenuActionRow
                label="Emplacement de sauvegarde"
                hint={`Actuel : ${basePath || '…'}`}
                action="Choisir"
                disabled={busy}
                onAction={handleChooseBasePath}
              />
            </div>
          )}

          {section === 'raccourcis' && (
            <div className="flex flex-col gap-2">
              {shortcuts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-1 py-2"
                >
                  <span className="min-w-0 flex-1 text-sm text-riven-text-primary">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShortcutError(null)
                      setRecordingId(item.id)
                    }}
                    className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      recordingId === item.id
                        ? 'border-riven-accent bg-riven-selected text-riven-accent'
                        : 'border-riven-border bg-riven-card text-riven-text-primary hover:bg-riven-selected'
                    }`}
                  >
                    {recordingId === item.id
                      ? 'Appuie…'
                      : formatAcceleratorDisplay(item.accelerator)}
                  </button>
                </div>
              ))}
              {shortcutError && (
                <p className="px-1 text-xs text-red-400">{shortcutError}</p>
              )}
              <button
                type="button"
                onClick={handleResetShortcuts}
                className="mt-1 self-start rounded-lg border border-riven-border px-2.5 py-1 text-xs text-riven-text-secondary hover:bg-riven-card hover:text-riven-text-primary"
              >
                Réinitialiser
              </button>
              <p className="px-1 text-[10px] text-riven-text-secondary">
                Clique un raccourci puis appuie sur la nouvelle combinaison (Échap pour annuler).
              </p>
            </div>
          )}

          {section === 'personnalisation' && (
            <div className="flex items-center justify-between rounded-xl px-1 py-2">
              <span className="text-sm text-riven-text-primary">Dark / Light Mode</span>
              <div className="flex overflow-hidden rounded-lg border border-riven-border">
                <button
                  type="button"
                  onClick={() => handleTheme('dark')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    theme === 'dark'
                      ? 'bg-riven-selected text-riven-text-primary'
                      : 'bg-riven-card text-riven-text-secondary hover:text-riven-text-primary'
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => handleTheme('light')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    theme === 'light'
                      ? 'bg-riven-selected text-riven-text-primary'
                      : 'bg-riven-card text-riven-text-secondary hover:text-riven-text-primary'
                  }`}
                >
                  Light
                </button>
              </div>
            </div>
          )}

          {section === 'informations' && (
            <div className="flex min-h-[160px] flex-col">
              <h3 className="mb-3 text-sm font-semibold text-riven-text-primary">
                Informations / Riven
              </h3>
              <p className="text-sm leading-relaxed text-riven-text-secondary">
                Riven est une application de stockage et d&apos;édition de prompts. Elle vous
                permet d&apos;augmenter votre rapidité et la qualité de vos prompts grâce aux
                outils à votre disposition.
              </p>
              <p className="mt-auto pt-6 text-xs text-riven-text-secondary">
                Version {version} / Riven
              </p>
            </div>
          )}

          {actionMessage && (
            <p className="mt-3 border-t border-riven-border pt-3 text-xs text-riven-text-secondary">
              {actionMessage}
            </p>
          )}
        </div>
      </div>
    </>
  )
}

function MenuActionRow({
  label,
  hint,
  action,
  onAction,
  disabled,
}: {
  label: string
  hint?: string
  action: string
  onAction?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-2">
      <div className="min-w-0">
        <p className="text-sm text-riven-text-primary">{label}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-riven-text-secondary">{hint}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className="shrink-0 rounded-lg border border-riven-border bg-riven-card px-3 py-1.5 text-xs text-riven-text-primary transition-colors hover:bg-riven-selected disabled:opacity-40"
      >
        {action}
      </button>
    </div>
  )
}
