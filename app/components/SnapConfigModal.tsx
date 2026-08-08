'use client'

import { useState, useEffect, useMemo } from 'react'
import { DetectedModule } from '../lib/moduleParser'
import {
  getInitialVariableValues,
  getParentAvailableValues,
  getRootDefinition,
  interpolateVariableRefs,
  isPickChild,
  resolveRootVariableId,
  resolveVariableOutput,
  shouldAskAtUse,
  splitPromptContent,
  type VariableDefinition,
  type VariableRegistry,
} from '../lib/variableRegistry'
import ModuleTexte from './modules/ModuleTexte'
import ModuleNombre from './modules/ModuleNombre'
import ModuleVariable from './modules/ModuleVariable'
import ModuleFichier from './modules/ModuleFichier'
import Button from './ui/Button'
import Input from './ui/Input'

interface SnapConfigModalProps {
  modules: DetectedModule[]
  /** Contenu brut du prompt (pour le registry + parent/enfant) */
  fileContent?: string
  fileName?: string
  onConfirm: (values: Array<{ name: string; index: number; value: string }>) => void
  onCancel: () => void
}

type FormEntry =
  | { kind: 'simple'; mod: DetectedModule }
  | {
      kind: 'variable'
      rootId: string
      mod: DetectedModule
      count: number
      children: string[]
      askAtUse: boolean
    }

function buildFormEntries(
  modules: DetectedModule[],
  registry: VariableRegistry
): FormEntry[] {
  const entries: FormEntry[] = []
  const variableGroups = new Map<
    string,
    { mod: DetectedModule; count: number; children: Set<string> }
  >()

  for (const mod of modules) {
    if (mod.type !== 'variable') {
      entries.push({ kind: 'simple', mod })
      continue
    }
    const id = mod.variableId || `idx:${mod.index}`
    const rootId = registry[id] ? resolveRootVariableId(id, registry) : id
    const rootDef = getRootDefinition(id, registry) ?? mod.variable
    const existing = variableGroups.get(rootId)
    if (existing) {
      existing.count += 1
      if (id !== rootId) existing.children.add(id)
    } else {
      const children = new Set<string>()
      if (id !== rootId) children.add(id)
      const group = {
        mod: {
          ...mod,
          variableId: rootId,
          variable: rootDef ?? mod.variable,
        },
        count: 1,
        children,
      }
      variableGroups.set(rootId, group)
      entries.push({
        kind: 'variable',
        rootId,
        mod: group.mod,
        count: group.count,
        children: [...children],
        askAtUse: shouldAskAtUse(rootId, registry),
      })
    }
  }

  for (const entry of entries) {
    if (entry.kind === 'variable') {
      const g = variableGroups.get(entry.rootId)
      entry.count = g?.count ?? 1
      entry.children = [...(g?.children ?? [])]
      entry.askAtUse = shouldAskAtUse(entry.rootId, registry)
    }
  }
  return entries
}

function buildSnapConfig(
  rootId: string,
  registry: VariableRegistry,
  liveValues: Record<string, string[]>
): Partial<VariableDefinition> | null {
  const def = registry[rootId]
  if (!def) return null
  if (isPickChild(def) && def.aliasOf) {
    const fromParent = getParentAvailableValues(def.aliasOf, registry, liveValues)
    return {
      ...def,
      options: fromParent,
      allowCustom: def.allowCustom,
      multi: def.multi,
    }
  }
  return def
}

function initVariableValues(
  modules: DetectedModule[],
  registry: VariableRegistry
): Record<string, string[]> {
  const init: Record<string, string[]> = {}
  const seen = new Set<string>()
  for (const mod of modules) {
    if (mod.type !== 'variable') continue
    const id = mod.variableId || `idx:${mod.index}`
    const rootId = registry[id] ? resolveRootVariableId(id, registry) : id
    if (seen.has(rootId)) continue
    seen.add(rootId)
    init[rootId] = getInitialVariableValues(rootId, registry)
  }
  return init
}

export default function SnapConfigModal({
  modules,
  fileContent = '',
  fileName,
  onConfirm,
  onCancel,
}: SnapConfigModalProps) {
  const registry = useMemo(
    () => splitPromptContent(fileContent).registry,
    [fileContent]
  )
  const [title, setTitle] = useState(fileName ?? 'Titre du prompt')
  const [values, setValues] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    modules.forEach((m) => {
      init[m.index] = ''
    })
    return init
  })
  const [variableValues, setVariableValues] = useState<Record<string, string[]>>(() =>
    initVariableValues(modules, registry)
  )

  const formEntries = useMemo(
    () => buildFormEntries(modules, registry),
    [modules, registry]
  )

  const visibleEntries = useMemo(
    () =>
      formEntries.filter(
        (e) => e.kind === 'simple' || e.askAtUse || (e.kind === 'variable' && isPickChild(registry[e.rootId]!))
      ),
    [formEntries, registry]
  )

  useEffect(() => {
    setTitle(fileName ?? 'Titre du prompt')
  }, [fileName])

  // Réinit si le contenu / modules changent
  useEffect(() => {
    setVariableValues(initVariableValues(modules, registry))
  }, [modules, registry])

  const setValue = (index: number, val: string) => {
    setValues((prev) => ({ ...prev, [index]: val }))
  }

  const flatPreview = useMemo(() => {
    const flat: Record<string, string> = {}
    for (const [k, arr] of Object.entries(variableValues)) {
      flat[k] = (arr ?? []).join(', ')
    }
    // Injecter aussi les parents figés (askAtUse=false) pour {{…}}
    for (const [id, def] of Object.entries(registry)) {
      if (!flat[id] && def.defaultValues.length > 0 && !def.askAtUse) {
        flat[id] = def.defaultValues.join(', ')
      }
    }
    return flat
  }, [variableValues, registry])

  const handleConfirm = () => {
    // Assurer que les parents « à l’avance » sont dans rawValues
    const raw: Record<string, string[]> = { ...variableValues }
    for (const [id, def] of Object.entries(registry)) {
      if (!raw[id]?.length && def.defaultValues.length > 0) {
        raw[id] = [...def.defaultValues]
      }
    }
    const result = modules.map((m) => {
      if (m.type === 'variable') {
        const id = m.variableId || `idx:${m.index}`
        const value = resolveVariableOutput(id, raw, registry)
        return { name: m.name, index: m.index, value }
      }
      let value = values[m.index] ?? ''
      value = interpolateVariableRefs(value, flatPreview, registry)
      return { name: m.name, index: m.index, value }
    })
    onConfirm(result)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
      style={{ background: 'transparent' }}
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-riven-lg border border-riven-border bg-riven-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-riven-border p-6">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold border-0 bg-transparent px-0 focus:ring-0"
            placeholder="Titre du prompt"
          />
          <p className="mt-2 text-xs text-riven-text-secondary">
            Remplis les variables nécessaires, puis insère.
          </p>
        </div>

        <div className="max-h-96 space-y-3 overflow-y-auto p-6">
          {visibleEntries.length === 0 ? (
            <p className="text-sm text-riven-text-secondary">
              Aucun champ à remplir — les valeurs sont déjà posées à l’avance.
            </p>
          ) : (
            visibleEntries.map((entry) => {
              if (entry.kind === 'variable') {
                const snapConfig = buildSnapConfig(
                  entry.rootId,
                  registry,
                  variableValues
                )
                return (
                  <div key={entry.rootId}>
                    <ModuleVariable
                      config={snapConfig ?? entry.mod.variable}
                      value={variableValues[entry.rootId] ?? []}
                      onChange={(v) =>
                        setVariableValues((prev) => ({ ...prev, [entry.rootId]: v }))
                      }
                      otherValues={flatPreview}
                      registry={registry}
                    />
                    {entry.count > 1 && (
                      <p className="-mt-1 mb-2 px-1 text-[11px] text-riven-text-secondary">
                        {entry.count}×
                      </p>
                    )}
                  </div>
                )
              }
              const mod = entry.mod
              if (mod.type === 'texte') {
                return (
                  <ModuleTexte
                    key={mod.index}
                    value={values[mod.index] ?? ''}
                    onChange={(v) => setValue(mod.index, v)}
                  />
                )
              }
              if (mod.type === 'nombre') {
                return (
                  <ModuleNombre
                    key={mod.index}
                    value={values[mod.index] ?? ''}
                    onChange={(v) => setValue(mod.index, v)}
                  />
                )
              }
              return (
                <ModuleFichier
                  key={mod.index}
                  value={values[mod.index] ?? ''}
                  onChange={(v) => setValue(mod.index, v)}
                />
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-riven-border p-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Insert Snippet</Button>
        </div>
      </div>
    </div>
  )
}
