'use client'

import PromptRow from './PromptRow'
import { PromptItem } from '../lib/promptItems'
import { isFavorite } from '../lib/promptMetadata'
import type { LayoutDisplayPrefs } from './LayoutSettingsPopover'

interface PromptListViewProps {
  items: PromptItem[]
  selectedPath?: string | null
  useRelativeTime?: boolean
  forceFavoriteStar?: boolean
  displayPrefs?: LayoutDisplayPrefs
  onSelect: (item: PromptItem) => void
}

export default function PromptListView({
  items,
  selectedPath,
  useRelativeTime = false,
  forceFavoriteStar = false,
  displayPrefs,
  onSelect,
}: PromptListViewProps) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((item) => (
        <PromptRow
          key={item.file.path}
          item={item}
          selected={selectedPath === item.file.path}
          useRelativeTime={useRelativeTime}
          favorite={isFavorite(item.file.path)}
          forceFavoriteStar={forceFavoriteStar}
          display={displayPrefs}
          onClick={() => onSelect(item)}
        />
      ))}
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-riven-text-secondary">Aucun prompt trouvé</p>
      )}
    </div>
  )
}
