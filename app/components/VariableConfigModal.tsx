'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from './ui/Button'
import Input from './ui/Input'
import {
  listParentVariables,
  normalizeVariableDefinition,
  slugifyVariableId,
  type VariableDefinition,
  type VariableRegistry,
} from '../lib/variableRegistry'

interface VariableConfigModalProps {
  initial?: Partial<VariableDefinition> | null
  registry: VariableRegistry
  mode: 'create' | 'edit'
  onSave: (def: VariableDefinition) => void
  onCancel: () => void
}

type Role = 'parent' | 'child'

/** Une seule liste de valeurs côté UI (options + défauts fusionnés). */
function seedValues(def: VariableDefinition): string[] {
  const merged = [...def.defaultValues, ...def.options].map((v) => v.trim()).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of merged) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out.length > 0 ? out : ['']
}

export default function VariableConfigModal({
  initial,
  registry,
  mode,
  onSave,
  onCancel,
}: VariableConfigModalProps) {
  const seed = normalizeVariableDefinition(initial)
  const parents = useMemo(
    () => listParentVariables(registry).filter((v) => v.id !== seed.id),
    [registry, seed.id]
  )

  const [role, setRole] = useState<Role>(() => (seed.aliasOf ? 'child' : 'parent'))
  const [parentId, setParentId] = useState(() => seed.aliasOf || parents[0]?.id || '')
  const [name, setName] = useState(seed.id || seed.label)
  const [values, setValues] = useState<string[]>(() => seedValues(seed))
  const [askAtUse, setAskAtUse] = useState(seed.askAtUse)
  const [error, setError] = useState('')

  const setValueAt = (index: number, value: string) => {
    setValues((prev) => prev.map((o, i) => (i === index ? value : o)))
  }
  const addValue = () => setValues((prev) => [...prev, ''])
  const removeValue = (index: number) => {
    setValues((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  const handleSave = () => {
    const id = slugifyVariableId(name)
    if (!id) {
      setError('Donne un nom (ex. canal)')
      return
    }
    if (mode === 'create' && registry[id]) {
      setError(`« ${id} » existe déjà`)
      return
    }
    if (mode === 'edit' && id !== seed.id && registry[id]) {
      setError(`« ${id} » existe déjà`)
      return
    }

    if (role === 'child') {
      if (!parentId || !registry[parentId]) {
        setError('Choisis un parent')
        return
      }
      if (parentId === id) {
        setError('Une variable ne peut pas être enfant d’elle-même')
        return
      }
      onSave(
        normalizeVariableDefinition({
          id,
          label: id,
          aliasOf: parentId,
          childMode: 'pick',
          options: [],
          defaultValues: [],
          multi: false,
          allowCustom: false,
          askAtUse: true,
        })
      )
      return
    }

    const cleaned = values.map((o) => o.trim()).filter(Boolean)
    if (!askAtUse && cleaned.length === 0) {
      setError('Ajoute au moins une valeur, ou coche « au moment de l’usage »')
      return
    }

    onSave(
      normalizeVariableDefinition({
        id,
        label: id,
        aliasOf: null,
        childMode: null,
        // Une seule liste : sert de choix + de valeurs inscrites pour les enfants
        options: cleaned,
        defaultValues: askAtUse ? [] : cleaned,
        multi: false,
        allowCustom: askAtUse,
        askAtUse,
      })
    )
  }

  return (
    <div
      className="app-no-drag fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-riven-lg border border-riven-border bg-riven-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-riven-border px-5 py-4">
          <h2 className="text-base font-semibold text-riven-text-primary">
            {mode === 'create' ? 'Nouvelle variable' : 'Modifier la variable'}
          </h2>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole('parent')}
              className={`flex-1 rounded-riven border px-3 py-2 text-sm ${
                role === 'parent'
                  ? 'border-riven-accent bg-riven-selected text-riven-text-primary'
                  : 'border-riven-border text-riven-text-secondary'
              }`}
            >
              Parent
            </button>
            <button
              type="button"
              onClick={() => setRole('child')}
              disabled={parents.length === 0}
              className={`flex-1 rounded-riven border px-3 py-2 text-sm disabled:opacity-40 ${
                role === 'child'
                  ? 'border-riven-accent bg-riven-selected text-riven-text-primary'
                  : 'border-riven-border text-riven-text-secondary'
              }`}
            >
              Enfant
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-riven-text-secondary">Nom</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(slugifyVariableId(e.target.value) || e.target.value)
                setError('')
              }}
              placeholder="canal"
              autoFocus
              className="font-mono"
            />
          </div>

          {role === 'child' ? (
            <div>
              <label className="mb-1.5 block text-xs text-riven-text-secondary">Parent</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="app-no-drag w-full rounded-riven border border-riven-border bg-riven-input px-3 py-2 text-sm text-riven-text-primary focus:border-riven-accent focus:outline-none"
              >
                {parents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-riven-text-secondary">
                Au snap, choix parmi les valeurs du parent.
              </p>
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-riven-text-primary">
                <input
                  type="checkbox"
                  checked={askAtUse}
                  onChange={(e) => setAskAtUse(e.target.checked)}
                  className="rounded border-riven-border"
                />
                Remplir au moment de l’usage
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs text-riven-text-secondary">
                    {askAtUse ? 'Choix possibles' : 'Valeur(s)'}
                  </label>
                  <button
                    type="button"
                    onClick={addValue}
                    className="inline-flex items-center gap-1 text-xs text-riven-text-secondary hover:text-riven-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {values.map((val, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={val}
                        onChange={(e) => setValueAt(i, e.target.value)}
                        placeholder={askAtUse ? `Choix ${i + 1}` : `Valeur ${i + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addValue()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeValue(i)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-riven text-riven-text-secondary hover:bg-riven-selected hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-riven-border px-5 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
