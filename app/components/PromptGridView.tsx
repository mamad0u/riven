'use client'

import PromptCard from './PromptCard'
import { PromptItem } from '../lib/promptItems'
import { isFavorite } from '../lib/promptMetadata'
import type { LayoutDisplayPrefs } from './LayoutSettingsPopover'

interface PromptGridViewProps {
  items: PromptItem[]
  selectedPath?: string | null
  forceFavoriteStar?: boolean
  displayPrefs?: LayoutDisplayPrefs
  onSelect: (item: PromptItem) => void
}

export default function PromptGridView({
  items,
  selectedPath,
  forceFavoriteStar = false,
  displayPrefs,
  onSelect,
}: PromptGridViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {items.map((item) => (
        <PromptCard
          key={item.file.path}
          item={item}
          selected={selectedPath === item.file.path}
          favorite={isFavorite(item.file.path)}
          forceFavoriteStar={forceFavoriteStar}
          display={displayPrefs}
          onClick={() => onSelect(item)}
        />
      ))}
      {items.length === 0 && (
        <p className="col-span-2 py-8 text-center text-sm text-riven-text-secondary">
          Aucun prompt trouvé
        </p>
      )}
    </div>
  )
}
