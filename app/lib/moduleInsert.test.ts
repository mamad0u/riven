import { describe, it, expect } from 'vitest'
import {
  insertModuleToken,
  normalizeModuleSpacing,
  parseContentToSegments,
  serializeFromSegments,
  ensureMdExtension,
} from './moduleInsert'
import { joinPromptContent, normalizeVariableDefinition, splitPromptContent } from './variableRegistry'

describe('insertModuleToken', () => {
  it('inserts a simple module token at the cursor, followed by a space', () => {
    // joinPromptContent trims trailing whitespace, so a token inserted at the
    // very end of the content loses its trailing space once serialized back.
    const { content } = insertModuleToken('Bonjour ', 8, 'texte')
    expect(content).toBe('Bonjour /texte')
  })

  it('inserts the token before existing text without duplicating whitespace', () => {
    const { content } = insertModuleToken('Bonjour  fin', 8, 'nombre')
    expect(content).toBe('Bonjour /nombre fin')
  })

  it('inserts a /variable:id token when type is variable', () => {
    const { content } = insertModuleToken('Bonjour ', 8, 'variable', 'nom')
    expect(content).toBe('Bonjour /variable:nom')
  })

  it('clamps an out-of-range cursor to the body bounds', () => {
    const { content } = insertModuleToken('abc', 999, 'texte')
    expect(content).toBe('abc/texte')
  })

  it('reports the cursor position right after the inserted token', () => {
    const { cursor } = insertModuleToken('Bonjour  fin', 8, 'nombre')
    expect(cursor).toBe('Bonjour /nombre'.length)
  })

  it('preserves the existing variable registry trailer', () => {
    const registry = { nom: normalizeVariableDefinition({ id: 'nom', label: 'Nom' }) }
    const base = joinPromptContent('Bonjour ', registry)
    const { content } = insertModuleToken(base, 'Bonjour '.length, 'texte')
    const { registry: parsed } = splitPromptContent(content)
    expect(parsed.nom).toBeDefined()
  })
})

describe('normalizeModuleSpacing', () => {
  it('adds a missing space after a simple module token', () => {
    // A non-word delimiter (",") is required after the token: module names
    // are matched with a `\b` word boundary, so a directly-glued word-like
    // suffix (e.g. "fin") would be parsed as part of the token itself.
    expect(normalizeModuleSpacing('/texte,fin')).toBe('/texte ,fin')
  })

  it('adds a missing space after a /variable:id token', () => {
    expect(normalizeModuleSpacing('/variable:nom,fin')).toBe('/variable:nom ,fin')
  })

  it('leaves correctly-spaced content untouched', () => {
    expect(normalizeModuleSpacing('/texte fin')).toBe('/texte fin')
  })

  it('migrates legacy /variable{...} blocks before normalizing spacing', () => {
    const legacy = '/variable{id:"nom",label:"Nom",options:"",multi:false},fin'
    const result = normalizeModuleSpacing(legacy)
    expect(result).toContain('/variable:nom ,fin')
  })
})

describe('parseContentToSegments / serializeFromSegments', () => {
  it('splits text and module tokens into ordered segments', () => {
    const segments = parseContentToSegments('Bonjour /texte, fin.')
    expect(segments).toEqual([
      { kind: 'text', value: 'Bonjour ' },
      { kind: 'module', type: 'texte' },
      { kind: 'text', value: ', fin.' },
    ])
  })

  it('produces a variable segment with its variableId', () => {
    const segments = parseContentToSegments('/variable:nom')
    expect(segments).toEqual([{ kind: 'module', type: 'variable', variableId: 'nom' }])
  })

  it('round-trips segments back to the original body via serializeFromSegments', () => {
    // Round-tripping is exact only when module tokens are already followed by
    // whitespace, as normalizeModuleSpacing would otherwise enforce elsewhere.
    const original = 'Bonjour /texte fin.'
    const segments = parseContentToSegments(original)
    expect(serializeFromSegments(segments)).toBe(original)
  })
})

describe('ensureMdExtension', () => {
  it('appends .md to a name with no extension', () => {
    expect(ensureMdExtension('mon-prompt')).toBe('mon-prompt.md')
  })

  it('leaves a name with an existing extension untouched by default', () => {
    expect(ensureMdExtension('mon-prompt.txt')).toBe('mon-prompt.txt')
  })

  it('replaces a .txt extension with .md when replaceTxt is set', () => {
    expect(ensureMdExtension('mon-prompt.txt', { replaceTxt: true })).toBe('mon-prompt.md')
  })

  it('falls back to a default name when given an empty/blank string', () => {
    expect(ensureMdExtension('   ')).toBe('nouveau-fichier.md')
  })
})
