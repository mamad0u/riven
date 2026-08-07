'use client'

interface FolderColorBadgeProps {
  name: string
  color: string
  className?: string
}

/** Pastille dossier colorée (style tag de la recherche). */
export default function FolderColorBadge({ name, color, className = '' }: FolderColorBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-[9rem] shrink-0 items-center truncate rounded-md px-2 py-0.5 text-[11px] font-medium text-white ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {name}
    </span>
  )
}
