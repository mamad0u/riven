'use client'

interface AutocompleteItem {
  key: string
  title: string
  description: string
}

interface ModuleAutocompleteProps {
  position: { top: number; left: number } | null
  selectedIndex: number
  items?: AutocompleteItem[]
  onSelect: (key: string) => void
}

export const AVAILABLE_MODULES = [
  { name: 'texte', description: 'Champ texte libre' },
  { name: 'variable', description: 'Définir une nouvelle variable' },
  { name: 'nombre', description: 'Valeur numérique' },
  { name: 'fichier', description: 'Chemin fichier' },
]

const DEFAULT_ITEMS: AutocompleteItem[] = AVAILABLE_MODULES.map((m) => ({
  key: m.name,
  title: `/${m.name}`,
  description: m.description,
}))

export default function ModuleAutocomplete({
  position,
  selectedIndex,
  items = DEFAULT_ITEMS,
  onSelect,
}: ModuleAutocompleteProps) {
  if (!position) return null

  return (
    <div
      className="module-autocomplete fixed z-[9999] min-w-[250px] max-w-[320px] overflow-hidden rounded-riven border border-riven-accent bg-riven-card shadow-2xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-64 overflow-y-auto py-1">
        {items.length === 0 ? (
          <p className="px-4 py-2 text-xs text-riven-text-secondary">Aucun résultat</p>
        ) : (
          items.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full px-4 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-riven-selected text-riven-accent'
                  : 'hover:bg-riven-card text-riven-text-primary'
              }`}
            >
              <span className="font-mono text-sm">{item.title}</span>
              <p className="mt-0.5 text-xs text-riven-text-secondary">{item.description}</p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
