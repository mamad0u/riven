/** Définition d’une variable (déclarée une fois, réutilisable / parent-enfant). */

/** Enfant miroir = même valeur que le parent ; pick = choisit parmi les valeurs du parent. */
export type VariableChildMode = 'mirror' | 'pick'

export interface VariableDefinition {
  id: string
  label: string
  options: string[]
  multi: boolean
  allowCustom: boolean
  /**
   * Parent de cette variable (ex-aliasOf).
   * - mirror : reprend automatiquement la valeur du parent
   * - pick : choisit parmi les valeurs déjà inscrites du parent
   */
  aliasOf: string | null
  /** Mode enfant si aliasOf est défini. Défaut : mirror (compat). */
  childMode: VariableChildMode | null
  /**
   * Valeurs posées à l’avance (comme une affectation en code).
   * Préremplissent le snap ; si askAtUse=false, utilisées telles quelles.
   */
  defaultValues: string[]
  /** false = valeur figée à l’avance, pas de champ au snap (sauf override affichage). */
  askAtUse: boolean
}

export type VariableRegistry = Record<string, VariableDefinition>

/** Référence croisée dans options / valeurs : {{nom_variable}} */
export const VAR_INTERPOLATION = /\{\{([a-zA-Z0-9_-]+)\}\}/g

export function slugifyVariableId(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  return base || 'var'
}

export function createUniqueVariableId(label: string, registry: VariableRegistry): string {
  const base = slugifyVariableId(label)
  if (!registry[base]) return base
  let i = 2
  while (registry[`${base}-${i}`]) i++
  return `${base}-${i}`
}

export function isParentVariable(def: VariableDefinition): boolean {
  return !def.aliasOf
}

export function isMirrorChild(def: VariableDefinition): boolean {
  return Boolean(def.aliasOf) && (def.childMode ?? 'mirror') === 'mirror'
}

export function isPickChild(def: VariableDefinition): boolean {
  return Boolean(def.aliasOf) && def.childMode === 'pick'
}

export function normalizeVariableDefinition(
  partial?: Partial<VariableDefinition> | null
): VariableDefinition {
  const label = (partial?.label ?? 'Variable').trim() || 'Variable'
  const id = (partial?.id ?? '').trim() || slugifyVariableId(label)
  const aliasOf = (partial?.aliasOf ?? '').trim() || null
  const linked = aliasOf && aliasOf !== id ? aliasOf : null
  const childMode: VariableChildMode | null = linked
    ? partial?.childMode === 'pick'
      ? 'pick'
      : 'mirror'
    : null

  const defaultValues = linked
    ? []
    : (partial?.defaultValues ?? []).map((o) => o.trim()).filter(Boolean)

  return {
    id,
    label,
    options: linked && childMode === 'mirror'
      ? []
      : (partial?.options ?? []).map((o) => o.trim()).filter(Boolean),
    multi: partial?.multi ?? false,
    allowCustom: partial?.allowCustom ?? true,
    aliasOf: linked,
    childMode,
    defaultValues,
    askAtUse: linked ? true : (partial?.askAtUse ?? true),
  }
}

/**
 * Suit la chaîne miroir jusqu’à la variable source (celle qu’on remplit).
 * Les enfants « pick » ont leur propre valeur → ils sont racine.
 */
export function resolveRootVariableId(
  id: string,
  registry: VariableRegistry,
  seen = new Set<string>()
): string {
  if (seen.has(id)) return id
  seen.add(id)
  const def = registry[id]
  if (!def?.aliasOf) return id
  if (!registry[def.aliasOf]) return id
  if ((def.childMode ?? 'mirror') === 'pick') return id
  return resolveRootVariableId(def.aliasOf, registry, seen)
}

export function getRootDefinition(
  id: string,
  registry: VariableRegistry
): VariableDefinition | null {
  const rootId = resolveRootVariableId(id, registry)
  return registry[rootId] ?? null
}

/** Remplace {{id}} par les valeurs fournies (map id → texte). */
export function interpolateVariableRefs(
  text: string,
  valuesById: Record<string, string>,
  registry?: VariableRegistry
): string {
  return text.replace(VAR_INTERPOLATION, (_, rawId: string) => {
    const root = registry ? resolveRootVariableId(rawId, registry) : rawId
    const v = valuesById[root] ?? valuesById[rawId]
    return v !== undefined && v !== '' ? v : `{{${rawId}}}`
  })
}

/**
 * Résout la valeur affichée / injectée d’une variable
 * (miroir → parent, puis interpolation {{…}}).
 */
export function resolveVariableOutput(
  id: string,
  rawValues: Record<string, string[]>,
  registry: VariableRegistry
): string {
  const root = resolveRootVariableId(id, registry)
  const flat: Record<string, string> = {}
  for (const [k, arr] of Object.entries(rawValues)) {
    const r = resolveRootVariableId(k, registry)
    flat[r] = (arr ?? []).join(', ')
  }
  let text = flat[root] ?? ''
  for (let i = 0; i < 5; i++) {
    const next = interpolateVariableRefs(text, flat, registry)
    if (next === text) break
    text = next
  }
  return text
}

/**
 * Valeurs « déjà inscrites » d’un parent : défauts + options,
 * ou la valeur live au snap si fournie.
 */
export function getParentAvailableValues(
  parentId: string,
  registry: VariableRegistry,
  liveValues?: Record<string, string[]>
): string[] {
  const parent = registry[parentId]
  if (!parent) return []
  const live = liveValues?.[parentId]
  if (live && live.length > 0) {
    return uniqueStrings(live)
  }
  return uniqueStrings([...parent.defaultValues, ...parent.options])
}

/** Valeur initiale au snap pour une racine (parent ou enfant pick). */
export function getInitialVariableValues(
  id: string,
  registry: VariableRegistry
): string[] {
  const def = registry[id]
  if (!def) return []
  if (isPickChild(def) && def.aliasOf) {
    // Pas de défaut propre : l’utilisateur choisit parmi le parent
    return []
  }
  return [...(def.defaultValues ?? [])]
}

/** Faut-il afficher un champ au snap pour cette racine ? */
export function shouldAskAtUse(id: string, registry: VariableRegistry): boolean {
  const def = registry[id]
  if (!def) return true
  if (isMirrorChild(def)) return false
  if (isPickChild(def)) return true
  return def.askAtUse !== false
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const v = raw.trim()
    if (!v || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function serializeVariableRef(id: string): string {
  return `/variable:${id}`
}

/** Bloc registry en fin de fichier */
export const VARS_START = '%%riven-vars%%'
export const VARS_END = '%%/riven-vars%%'

export function splitPromptContent(content: string): {
  body: string
  registry: VariableRegistry
} {
  const start = content.indexOf(VARS_START)
  if (start === -1) {
    return { body: content, registry: {} }
  }
  const afterStart = start + VARS_START.length
  const end = content.indexOf(VARS_END, afterStart)
  if (end === -1) {
    return { body: content, registry: {} }
  }
  const json = content.slice(afterStart, end).trim()
  const body = content.slice(0, start).replace(/\s+$/, '')
  let registry: VariableRegistry = {}
  try {
    const raw = JSON.parse(json) as Record<string, Partial<VariableDefinition>>
    for (const [key, val] of Object.entries(raw ?? {})) {
      const def = normalizeVariableDefinition({ ...val, id: val?.id || key })
      registry[def.id] = def
    }
  } catch {
    registry = {}
  }
  return { body, registry }
}

export function joinPromptContent(body: string, registry: VariableRegistry): string {
  const ids = Object.keys(registry)
  if (ids.length === 0) return body.replace(/\s+$/, '')
  const payload: Record<string, Omit<VariableDefinition, 'id'>> = {}
  for (const id of ids.sort()) {
    const d = registry[id]
    payload[id] = {
      label: d.label,
      options: d.options,
      multi: d.multi,
      allowCustom: d.allowCustom,
      aliasOf: d.aliasOf,
      childMode: d.childMode,
      defaultValues: d.defaultValues,
      askAtUse: d.askAtUse,
    }
  }
  const trimmed = body.replace(/\s+$/, '')
  return `${trimmed}\n\n${VARS_START}\n${JSON.stringify(payload)}\n${VARS_END}\n`
}

/**
 * Migre l’ancien format /variable{id:"…",label:"…",…} vers
 * registry + /variable:id
 */
export function migrateLegacyVariables(content: string): string {
  const { body: rawBody, registry: existing } = splitPromptContent(content)
  const registry: VariableRegistry = { ...existing }
  let body = rawBody
  let i = 0
  let out = ''

  while (i < body.length) {
    if (body.startsWith('/variable', i)) {
      const ref = body.slice(i).match(/^\/variable:([a-zA-Z0-9_-]+)/)
      if (ref) {
        out += ref[0]
        i += ref[0].length
        continue
      }
      if (body[i + '/variable'.length] === '{') {
        const read = readLegacyVariableBlock(body, i)
        if (read) {
          const def = normalizeVariableDefinition(read.config)
          if (!registry[def.id]) registry[def.id] = def
          else {
            registry[def.id] = {
              ...registry[def.id],
              label: def.label || registry[def.id].label,
              options:
                def.options.length > 0 ? def.options : registry[def.id].options,
              multi: def.multi,
              allowCustom: def.allowCustom,
              aliasOf: def.aliasOf ?? registry[def.id].aliasOf,
              childMode: def.childMode ?? registry[def.id].childMode,
              defaultValues:
                def.defaultValues.length > 0
                  ? def.defaultValues
                  : registry[def.id].defaultValues,
              askAtUse: def.askAtUse,
            }
          }
          out += serializeVariableRef(def.id)
          i += read.length
          continue
        }
      }
      const id = createUniqueVariableId('Variable', registry)
      registry[id] = normalizeVariableDefinition({
        id,
        label: 'Variable',
        options: [],
        multi: true,
        allowCustom: true,
      })
      out += serializeVariableRef(id)
      i += '/variable'.length
      continue
    }
    out += body[i]
    i++
  }

  return joinPromptContent(out, registry)
}

function readLegacyVariableBlock(
  text: string,
  index: number
): { config: Partial<VariableDefinition>; length: number } | null {
  if (!text.startsWith('/variable{', index)) return null
  const startBrace = index + '/variable'.length
  let inString = false
  let escaped = false
  let end = -1
  for (let j = startBrace + 1; j < text.length; j++) {
    const ch = text[j]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (ch === '}' && !inString) {
      end = j
      break
    }
  }
  if (end === -1) return null
  const inner = text.slice(startBrace + 1, end)
  const idMatch = inner.match(/id:"((?:\\.|[^"\\])*)"/)
  const labelMatch = inner.match(/label:"((?:\\.|[^"\\])*)"/)
  const optionsMatch = inner.match(/options:"((?:\\.|[^"\\])*)"/)
  const multiMatch = inner.match(/multi:(true|false)/)
  const customMatch = inner.match(/allowCustom:(true|false)/)
  const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  return {
    length: end - index + 1,
    config: {
      id: idMatch ? unescape(idMatch[1]) : undefined,
      label: labelMatch ? unescape(labelMatch[1]) : undefined,
      options: optionsMatch
        ? unescape(optionsMatch[1])
            .split('|')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
      multi: multiMatch ? multiMatch[1] === 'true' : false,
      allowCustom: customMatch ? customMatch[1] === 'true' : true,
      aliasOf: null,
    },
  }
}

/** Lit /variable:id à partir de text[index]. */
export function readVariableRefAt(
  text: string,
  index: number
): { id: string; token: string; length: number } | null {
  if (!text.startsWith('/variable', index)) return null
  const slice = text.slice(index)
  const m = slice.match(/^\/variable:([a-zA-Z0-9_-]+)/)
  if (m) {
    return { id: m[1], token: m[0], length: m[0].length }
  }
  return null
}

export function listRegistry(registry: VariableRegistry): VariableDefinition[] {
  return Object.values(registry).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

/** Variables parent (sources de valeurs). */
export function listSourceVariables(registry: VariableRegistry): VariableDefinition[] {
  return listRegistry(registry).filter((v) => isParentVariable(v))
}

/** Alias de listSourceVariables — vocabulaire parent/enfant. */
export function listParentVariables(registry: VariableRegistry): VariableDefinition[] {
  return listSourceVariables(registry)
}

export function listChildVariables(
  registry: VariableRegistry,
  parentId?: string
): VariableDefinition[] {
  return listRegistry(registry).filter(
    (v) => v.aliasOf && (!parentId || v.aliasOf === parentId)
  )
}
