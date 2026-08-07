'use client'

import { Star } from 'lucide-react'
import Badge from './ui/Badge'
import FolderColorBadge from './FolderColorBadge'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { PromptItem } from '../lib/promptItems'
import {
  dossierNameFromPath,
  resolveFolderColorForFile,
} from '../lib/folderColors'
import type { LayoutDisplayPrefs } from './LayoutSettingsPopover'

interface PromptCardProps {
  item: PromptItem
  selected?: boolean
  favorite?: boolean
  forceFavoriteStar?: boolean
  display?: LayoutDisplayPrefs
  onClick: () => void
}

export default function PromptCard({
  item,
  selected = false,
  favorite = false,
  forceFavoriteStar = false,
  display,
  onClick,
}: PromptCardProps) {
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
      className={`flex flex-col gap-3 rounded-riven-lg border p-4 text-left transition-colors ${
        selected
          ? 'border-riven-accent bg-riven-selected'
          : 'border-riven-border bg-riven-card hover:border-riven-accent'
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {showFavoriteStar && (
          <Star
            className="mt-0.5 h-4 w-4 shrink-0 fill-riven-accent text-riven-accent"
            strokeWidth={0}
            aria-label="Favori"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {showName && (
            <span className="truncate text-sm font-medium text-riven-text-primary">
              {item.title}
            </span>
          )}
          {showDossier && dossier && dossierColor && (
            <FolderColorBadge name={dossier} color={dossierColor} />
          )}
        </div>
      </div>
      {showTags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <Badge key={tag.label} variant={tag.variant}>
              {tag.label}
            </Badge>
          ))}
        </div>
      )}
      <span className="text-xs text-riven-text-secondary">{formatRelativeTime(item.modified)}</span>
    </button>
  )
}
