'use client'

import Button from '../ui/Button'

interface ModuleFichierProps {
  label?: string
  value: string
  onChange: (value: string) => void
}

export default function ModuleFichier({ label = 'Rename par l\'utilisateur', value, onChange }: ModuleFichierProps) {
  const handleImport = async () => {
    if (!window.electronAPI?.openFileDialog) return
    const result = await window.electronAPI.openFileDialog()
    if (result && !('error' in result)) onChange(result.path)
  }

  return (
    <div className="rounded-riven-lg border border-riven-border bg-riven-card p-4">
      <p className="mb-1 text-xs text-riven-text-secondary">Module Fichier</p>
      <p className="mb-3 text-sm text-riven-text-primary">{label}</p>
      <div className="flex items-center gap-2 rounded-riven border border-riven-border bg-riven-input px-3 py-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="C:\Dossiers"
          className="flex-1 bg-transparent text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:outline-none"
        />
        <Button variant="outline" onClick={handleImport} className="px-2 py-1 text-xs">
          importer
        </Button>
      </div>
    </div>
  )
}
