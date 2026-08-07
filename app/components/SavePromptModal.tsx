'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileItem } from '../../electron.d'
import { ensureMdExtension } from '../lib/moduleInsert'
import Button from './ui/Button'
import Input from './ui/Input'

interface SavePromptModalProps {
  content: string
  onCancel: () => void
  onSaved: (path: string) => void
}

export default function SavePromptModal({ content, onCancel, onSaved }: SavePromptModalProps) {
  const [name, setName] = useState('')
  const [folderQuery, setFolderQuery] = useState('')
  const [folders, setFolders] = useState<FileItem[]>([])
  const [folderOpen, setFolderOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const folderWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => nameRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!window.electronAPI?.fileManager) return
      const result = await window.electronAPI.fileManager.listDirectory(null)
      if (cancelled || 'error' in result) return
      setFolders(result.items.filter((i) => i.isDirectory))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!folderWrapRef.current?.contains(e.target as Node)) {
        setFolderOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const filteredFolders = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return folders
    return folders.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    )
  }, [folders, folderQuery])

  const canSave = name.trim().length > 0 && !saving

  const handleSave = useCallback(async () => {
    if (!canSave || !window.electronAPI?.fileManager) return
    if (!content.trim()) {
      setError('Aucun texte capturé. Sélectionne du texte puis réessaie Alt+Shift+C.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const fileName = ensureMdExtension(name.trim())
      const folderTrim = folderQuery.trim()
      let dirPath: string | null = null

      if (folderTrim) {
        const matched = folders.find(
          (f) =>
            f.name.toLowerCase() === folderTrim.toLowerCase() ||
            f.path.toLowerCase() === folderTrim.toLowerCase()
        )
        if (matched) {
          dirPath = matched.path
        } else {
          const dirResult = await window.electronAPI.fileManager.createDirectory(null, folderTrim)
          if ('error' in dirResult) {
            setError(dirResult.error)
            setSaving(false)
            return
          }
          dirPath = dirResult.path
        }
      }

      const fileResult = await window.electronAPI.fileManager.createFile(
        dirPath,
        fileName,
        content
      )
      if ('error' in fileResult) {
        setError(fileResult.error)
        setSaving(false)
        return
      }
      onSaved(fileResult.path)
    } catch {
      setError('Impossible de sauvegarder le prompt')
      setSaving(false)
    }
  }, [canSave, name, folderQuery, folders, content, onSaved])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter' && !e.shiftKey && canSave) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT') {
          e.preventDefault()
          void handleSave()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, canSave, handleSave])

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 animate-capture-backdrop"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Enregistrer le prompt"
    >
      <div
        className="mx-4 w-full max-w-md rounded-riven-lg border border-riven-border bg-riven-card shadow-2xl animate-capture-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-riven-border px-5 py-4">
          <h2 className="text-base font-semibold text-riven-text-primary">Enregistrer le prompt</h2>
          <p className="mt-0.5 text-xs text-riven-text-secondary">
            Le texte capturé sera sauvegardé via cette fenêtre
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-sm text-riven-text-secondary">
              Nom du prompt<span className="text-riven-accent">*</span>
            </label>
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rentre du texte"
              autoFocus
            />
          </div>

          <div ref={folderWrapRef} className="relative">
            <label className="mb-1.5 block text-sm text-riven-text-secondary">Dossier</label>
            <Input
              value={folderQuery}
              onChange={(e) => {
                setFolderQuery(e.target.value)
                setFolderOpen(true)
              }}
              onFocus={() => setFolderOpen(true)}
              placeholder="Écris ou choisis un dossier"
            />
            {folderOpen && filteredFolders.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-riven border border-riven-border bg-riven-sidebar shadow-lg">
                {filteredFolders.map((folder) => (
                  <li key={folder.path}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-riven-text-primary hover:bg-riven-selected"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setFolderQuery(folder.name)
                        setFolderOpen(false)
                      }}
                    >
                      {folder.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-riven-text-secondary">
              Vide = racine. Nom inconnu = nouveau dossier.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-riven-border px-5 py-3">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Annuler
          </Button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="inline-flex items-center justify-center rounded-riven bg-riven-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
