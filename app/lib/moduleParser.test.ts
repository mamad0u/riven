import { describe, it, expect } from 'vitest'
import { detectModules, replaceModules } from './moduleParser'
import { joinPromptContent, normalizeVariableDefinition } from './variableRegistry'

describe('detectModules', () => {
  it('detects simple module tokens in order with sequential indices', () => {
    const modules = detectModules('Bonjour /texte, tu as /nombre ans, fichier: /fichier')
    expect(modules.map((m) => ({ name: m.name, type: m.type, index: m.index }))).toEqual([
      { name: 'texte', type: 'texte', index: 0 },
      { name: 'nombre', type: 'nombre', index: 1 },
      { name: 'fichier', type: 'fichier', index: 2 },
    ])
  })

  it('detects a /variable:id token and attaches its registry definition', () => {
    const registry = {
      nom: normalizeVariableDefinition({ id: 'nom', label: 'Nom', defaultValues: ['Alice'] }),
    }
    const content = joinPromptContent('Bonjour /variable:nom', registry)
    const modules = detectModules(content)
    expect(modules).toHaveLength(1)
    expect(modules[0]).toMatchObject({ name: 'variable', type: 'variable', variableId: 'nom' })
    expect(modules[0].variable?.label).toBe('Nom')
  })

  it('falls back to a synthetic definition for a /variable:id missing from the registry', () => {
    const modules = detectModules('Bonjour /variable:orphan')
    expect(modules[0].variable).toMatchObject({ id: 'orphan', label: 'orphan' })
  })

  it('ignores unknown /word tokens', () => {
    expect(detectModules('/unknown token here')).toEqual([])
  })

  it('returns an empty array for content with no modules', () => {
    expect(detectModules('Just plain text, no modules.')).toEqual([])
  })
})

describe('replaceModules', () => {
  it('substitutes each module token with the matching value by index', () => {
    const result = replaceModules('Bonjour /texte, tu as /nombre ans', [
      { name: 'texte', index: 0, value: 'Alice' },
      { name: 'nombre', index: 1, value: '30' },
    ])
    expect(result).toBe('Bonjour Alice, tu as 30 ans')
  })

  it('substitutes /variable:id tokens like any other module, by position', () => {
    const registry = { nom: normalizeVariableDefinition({ id: 'nom', label: 'Nom' }) }
    const content = joinPromptContent('Bonjour /variable:nom !', registry)
    const result = replaceModules(content, [{ name: 'variable', index: 0, value: 'Alice' }])
    expect(result).toBe('Bonjour Alice !')
  })

  it('replaces missing values with an empty string', () => {
    expect(replaceModules('Valeur: /texte', [])).toBe('Valeur: ')
  })

  it('never leaves the %%riven-vars%% trailer in the output', () => {
    const registry = { nom: normalizeVariableDefinition({ id: 'nom', label: 'Nom' }) }
    const content = joinPromptContent('/variable:nom', registry)
    const result = replaceModules(content, [{ name: 'variable', index: 0, value: 'Alice' }])
    expect(result).not.toContain('%%riven-vars%%')
  })
})
