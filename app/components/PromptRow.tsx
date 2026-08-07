'use client'

import { Star } from 'lucide-react'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { PromptItem } from '../lib/promptItems'
import {
  dossierNameFromPath,
  resolveFolderColorForFile,
} from '../lib/folderColors'
import type { LayoutDisplayPrefs } from './LayoutSettingsPopover'
import FolderColorBadge from './FolderColorBadge'

interface PromptRowProps {
  item: PromptItem
  selected?: boolean
  useRelativeTime?: boolean
  favorite?: boolean
  forceFavoriteStar?: boolean
  display?: LayoutDisplayPrefs
  onClick: () => void
}

export default function PromptRow({
  item,
  selected = false,
  useRelativeTime = false,
  favorite = false,
  forceFavoriteStar = false,
  display,
  onClick,
}: PromptRowProps) {
  const timeLabel = formatRelativeTime(item.modified)
  void useRelativeTime
  const showName = display?.showName !== false
  const showDossier = display?.showDossier === true
  const showTags = display?.showTags === true
  const showFavoriteStar =
    favorite && (forceFavoriteStar || display?.showFavoris === true)
  const dossier = dossierNameFromPath(item.file.path)
  const dossierColor = resolveFolderColorForFile(item.file.path)

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-riven border px-5 py-4 text-left transition-colors ${
        selected
          ? 'border-riven-accent bg-riven-selected'
          : 'border-riven-border bg-riven-card hover:border-riven-accent'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showFavoriteStar && (
          <Star
            className="h-4 w-4 shrink-0 fill-riven-accent text-riven-accent"
            strokeWidth={0}
            aria-label="Favori"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {showName && (
              <span className="truncate text-sm text-riven-text-primary">{item.title}</span>
            )}
            {showDossier && dossier && dossierColor && (
              <FolderColorBadge name={dossier} color={dossierColor} />
            )}
          </div>
          {showTags && item.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag.label}
                  className="rounded-full border border-riven-border px-1.5 py-0.5 text-[10px] text-riven-text-secondary"
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <span className="ml-4 shrink-0 text-xs text-riven-text-secondary">{timeLabel}</span>
    </button>
  )
}
