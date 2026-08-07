'use client'

import { Plus, Pencil, CornerDownLeft } from 'lucide-react'
import type { VariableDefinition, VariableRegistry } from '../lib/variableRegistry'
import { listChildVariables, listParentVariables } from '../lib/variableRegistry'

interface VariablesPanelProps {
  registry: VariableRegistry
  searchQuery?: string
  onCreate: () => void
  onEdit: (def: VariableDefinition) => void
  onInsert: (id: string) => void
}

function matchesQuery(v: VariableDefinition, q: string): boolean {
  if (!q) return true
  return (
    v.id.toLowerCase().includes(q) ||
    v.label.toLowerCase().includes(q) ||
    Boolean(v.aliasOf?.toLowerCase().includes(q))
  )
}

function childSubtitle(v: VariableDefinition): string {
  return v.aliasOf ? `← ${v.aliasOf}` : ''
}

function parentSubtitle(v: VariableDefinition): string {
  const vals = [...v.defaultValues, ...v.options].filter(Boolean)
  const unique = [...new Set(vals)]
  if (unique.length === 0) return v.askAtUse ? 'à l’usage' : 'parent'
  return unique.join(', ')
}

export default function VariablesPanel({
  registry,
  searchQuery = '',
  onCreate,
  onEdit,
  onInsert,
}: VariablesPanelProps) {
  const q = searchQuery.trim().toLowerCase()
  const parents = listParentVariables(registry).filter((v) => {
    if (matchesQuery(v, q)) return true
    return listChildVariables(registry, v.id).some((c) => matchesQuery(c, q))
  })
  const orphans = listChildVariables(registry).filter(
    (c) => c.aliasOf && !registry[c.aliasOf] && matchesQuery(c, q)
  )

  const empty = parents.length === 0 && orphans.length === 0

  return (
    <div className="py-1">
      <div className="mb-1 flex items-center justify-between px-3 py-1.5">
        <p className="text-xs text-riven-text-secondary">Variables du prompt</p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 text-xs text-riven-text-secondary hover:text-riven-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Définir
        </button>
      </div>

      {empty ? (
        <p className="px-3 py-3 text-xs text-riven-text-secondary">
          {q
            ? 'Aucune variable trouvée'
            : 'Aucune variable. Crée un parent, puis éventuellement un enfant.'}
        </p>
      ) : (
        <>
          {parents.map((parent) => {
            const children = listChildVariables(registry, parent.id).filter((c) =>
              matchesQuery(c, q) || matchesQuery(parent, q)
            )
            return (
              <div key={parent.id} className="mb-1">
                <VariableRow
                  v={parent}
                  subtitle={parentSubtitle(parent)}
                  onInsert={onInsert}
                  onEdit={onEdit}
                />
                {children.map((child) => (
                  <div key={child.id} className="ml-3 border-l border-riven-border pl-1">
                    <VariableRow
                      v={child}
                      subtitle={childSubtitle(child)}
                      onInsert={onInsert}
                      onEdit={onEdit}
                    />
                  </div>
                ))}
              </div>
            )
          })}
          {orphans.map((v) => (
            <VariableRow
              key={v.id}
              v={v}
              subtitle={childSubtitle(v)}
              onInsert={onInsert}
              onEdit={onEdit}
            />
          ))}
        </>
      )}
    </div>
  )
}

function VariableRow({
  v,
  subtitle,
  onInsert,
  onEdit,
}: {
  v: VariableDefinition
  subtitle: string
  onInsert: (id: string) => void
  onEdit: (def: VariableDefinition) => void
}) {
  return (
    <div className="mx-2 mb-0.5 flex items-center gap-1 rounded-riven border border-transparent px-2 py-1.5 hover:border-riven-border hover:bg-riven-selected">
      <button
        type="button"
        onClick={() => onInsert(v.id)}
        className="min-w-0 flex-1 text-left"
        title="Insérer une référence"
      >
        <div className="truncate font-mono text-sm text-riven-text-primary">{v.id}</div>
        <div className="truncate text-[11px] text-riven-text-secondary">{subtitle}</div>
      </button>
      <button
        type="button"
        onClick={() => onInsert(v.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-riven-text-secondary hover:text-riven-accent"
        title="Insérer"
      >
        <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onEdit(v)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-riven-text-secondary hover:text-riven-text-primary"
        title="Modifier la définition"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
