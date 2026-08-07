import {
  joinPromptContent,
  listRegistry,
  migrateLegacyVariables,
  readVariableRefAt,
  serializeVariableRef,
  splitPromptContent,
  type VariableDefinition,
  type VariableRegistry,
} from './variableRegistry'

export type ModuleTokenType = 'texte' | 'nombre' | 'variable' | 'fichier'

export const MODULE_TOKEN_TYPES: ModuleTokenType[] = ['texte', 'nombre', 'variable', 'fichier']

export type ContentSegment =
  | { kind: 'text'; value: string }
  | { kind: 'module'; type: Exclude<ModuleTokenType, 'variable'> }
  | { kind: 'module'; type: 'variable'; variableId: string }

export function insertModuleToken(
  content: string,
  cursor: number,
  type: ModuleTokenType,
  variableId?: string
): { content: string; cursor: number } {
  const { body, registry } = splitPromptContent(content)
  // cursor is relative to full content historically — map to body if registry trailer exists
  const bodyLen = body.length
  const safeCursor = Math.max(0, Math.min(cursor, bodyLen))
  const token =
    type === 'variable'
      ? serializeVariableRef(variableId || 'var')
      : `/${type}`
  const before = body.slice(0, safeCursor)
  const after = body.slice(safeCursor)
  const needsSpace = after.length === 0 || (after[0] !== ' ' && after[0] !== '\n')
  const insertion = needsSpace ? `${token} ` : token
  const nextBody = before + insertion + after
  const next = joinPromptContent(nextBody, registry)
  return {
    content: next,
    cursor: before.length + insertion.length,
  }
}

export function normalizeModuleSpacing(content: string): string {
  const migrated = content.includes('/variable{') ? migrateLegacyVariables(content) : content
  const { body, registry } = splitPromptContent(migrated)
  let out = ''
  let i = 0
  while (i < body.length) {
    if (body[i] === '/') {
      const simple = body.slice(i).match(/^\/(texte|nombre|fichier)\b/)
      if (simple) {
        out += simple[0]
        i += simple[0].length
        if (i >= body.length || (body[i] !== ' ' && body[i] !== '\n')) out += ' '
        continue
      }
      const variable = readVariableRefAt(body, i)
      if (variable) {
        out += variable.token
        i += variable.length
        if (i >= body.length || (body[i] !== ' ' && body[i] !== '\n')) out += ' '
        continue
      }
    }
    out += body[i]
    i++
  }
  return joinPromptContent(out, registry)
}

export function parseContentToSegments(content: string): ContentSegment[] {
  const { body } = splitPromptContent(content)
  const segments: ContentSegment[] = []
  let i = 0
  let textStart = 0

  const flushText = (end: number) => {
    if (end > textStart) {
      segments.push({ kind: 'text', value: body.slice(textStart, end) })
    }
  }

  while (i < body.length) {
    if (body[i] === '/') {
      const simple = body.slice(i).match(/^\/(texte|nombre|fichier)\b/)
      if (simple) {
        flushText(i)
        segments.push({
          kind: 'module',
          type: simple[1] as Exclude<ModuleTokenType, 'variable'>,
        })
        i += simple[0].length
        textStart = i
        continue
      }
      const variable = readVariableRefAt(body, i)
      if (variable) {
        flushText(i)
        segments.push({ kind: 'module', type: 'variable', variableId: variable.id })
        i += variable.length
        textStart = i
        continue
      }
    }
    i++
  }
  flushText(body.length)
  return segments
}

export function serializeFromSegments(
  segments: ContentSegment[],
  registry: VariableRegistry = {}
): string {
  let out = ''
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.kind === 'text') {
      out += seg.value
      continue
    }
    if (seg.type === 'variable') {
      out += serializeVariableRef(seg.variableId)
    } else {
      out += `/${seg.type}`
    }
    const next = segments[i + 1]
    const nextStartsOk =
      next?.kind === 'text' && (next.value.startsWith(' ') || next.value.startsWith('\n'))
    if (!nextStartsOk) out += ' '
  }
  return joinPromptContent(out, registry)
}

export function ensureMdExtension(name: string, opts?: { replaceTxt?: boolean }): string {
  const trimmed = name.trim() || 'nouveau-fichier'
  const replaceTxt = opts?.replaceTxt ?? false
  const lower = trimmed.toLowerCase()
  if (replaceTxt && lower.endsWith('.txt')) {
    return `${trimmed.slice(0, -4)}.md`
  }
  if (trimmed.includes('.')) return trimmed
  return `${trimmed}.md`
}

export { splitPromptContent, joinPromptContent, listRegistry, migrateLegacyVariables }
export type { VariableDefinition, VariableRegistry }
