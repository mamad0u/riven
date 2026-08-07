'use client'

import { useRef } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { FOLDER_BASE_COLORS } from '../lib/folderColors'

interface FolderColorPickerProps {
  value: string | null
  onChange: (color: string | null) => void
}

export default function FolderColorPicker({ value, onChange }: FolderColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2"
      role="group"
      aria-label="Couleur du dossier"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {FOLDER_BASE_COLORS.map((color) => {
        const selected = value?.toLowerCase() === color.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`Couleur ${color}`}
            aria-pressed={selected}
            className={`h-4 w-4 shrink-0 rounded-full transition-transform hover:scale-110 ${
              selected ? 'ring-2 ring-white ring-offset-1 ring-offset-riven-card' : ''
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        )
      })}

      <button
        type="button"
        title="Couleur personnalisée"
        aria-label="Ouvrir la palette"
        className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-riven-text-secondary transition-colors hover:bg-riven-selected hover:text-riven-text-primary"
        onClick={() => inputRef.current?.click()}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <input
        ref={inputRef}
        type="color"
        value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#60A5FA'}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        onChange={(e) => onChange(e.target.value)}
      />

      {value && (
        <button
          type="button"
          title="Réinitialiser"
          aria-label="Réinitialiser la couleur"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-riven-text-secondary transition-colors hover:bg-riven-selected hover:text-riven-text-primary"
          onClick={() => onChange(null)}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
