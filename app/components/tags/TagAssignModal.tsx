'use client'

import { useMemo, useState } from 'react'
import { listTags, TagId } from '../../lib/tagStore'
import { getTagIdsForPath, setTagIdsForPath } from '../../lib/promptMetadata'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface TagAssignModalProps {
  filePath: string
  fileName: string
  onClose: () => void
  onSaved: () => void
}

export default function TagAssignModal({
  filePath,
  fileName,
  onClose,
  onSaved,
}: TagAssignModalProps) {
  const allTags = useMemo(() => listTags(), [])
  const [selected, setSelected] = useState<Set<TagId>>(
    () => new Set(getTagIdsForPath(filePath))
  )
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return allTags
    return allTags.filter((t) => t.name.toLowerCase().includes(q))
  }, [allTags, filter])

  const toggle = (id: TagId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    setTagIdsForPath(filePath, [...selected])
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-md flex-col rounded-riven-lg border border-riven-border bg-riven-card">
        <div className="border-b border-riven-border px-5 py-4">
          <h2 className="text-lg font-semibold text-riven-text-primary">Gérer les tags</h2>
          <p className="mt-0.5 truncate text-xs text-riven-text-secondary">{fileName}</p>
        </div>

        <div className="border-b border-riven-border px-5 py-3">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer les tags…"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-riven-text-secondary">
              Aucun tag. Crée-en depuis la vue Tags.
            </p>
          ) : (
            filtered.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-3 rounded-riven px-2 py-2 hover:bg-riven-selected"
              >
                <input
                  type="checkbox"
                  checked={selected.has(tag.id)}
                  onChange={() => toggle(tag.id)}
                  className="h-3.5 w-3.5 accent-riven-text-secondary"
                />
                <span className="text-sm text-riven-text-primary">{tag.name}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-riven-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </div>
      </div>
    </div>
  )
}
