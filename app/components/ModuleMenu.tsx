'use client'

import { Type, ArrowLeftRight, Hash, Folder, type LucideIcon } from 'lucide-react'

export const MODULE_TYPES = [
  { id: 'texte', label: 'Module Texte', icon: Type, iconSide: 'right' as const },
  { id: 'variable', label: 'Nouvelle variable', icon: ArrowLeftRight, iconSide: 'left' as const },
  { id: 'nombre', label: 'Module Nombre', icon: Hash, iconSide: 'left' as const },
  { id: 'fichier', label: 'Module Fichier', icon: Folder, iconSide: 'left' as const },
] as const

export type ModuleType = (typeof MODULE_TYPES)[number]['id']

export function getModuleMeta(type: string): {
  label: string
  icon: LucideIcon
  iconSide: 'left' | 'right'
} | null {
  const found = MODULE_TYPES.find((m) => m.id === type)
  if (!found) return null
  return { label: found.label, icon: found.icon, iconSide: found.iconSide }
}

interface ModuleMenuProps {
  onSelect: (moduleId: ModuleType) => void
  searchQuery?: string
}

export default function ModuleMenu({ onSelect, searchQuery = '' }: ModuleMenuProps) {
  const filtered = MODULE_TYPES.filter((m) =>
    m.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-xs text-riven-text-secondary">Modules</p>
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-xs text-riven-text-secondary">Aucun résultat</p>
      ) : (
        filtered.map((mod) => {
          const Icon = mod.icon
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelect(mod.id)}
              className="mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-riven border border-transparent px-3 py-2 text-sm text-riven-text-primary transition-colors hover:border-riven-border hover:bg-riven-selected"
            >
              <Icon className="h-4 w-4 shrink-0 text-riven-text-secondary" />
              {mod.label}
            </button>
          )
        })
      )}
    </div>
  )
}
