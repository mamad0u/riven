import { describe, it, expect } from 'vitest'
import {
  normalizeVariableDefinition,
  resolveRootVariableId,
  isPickChild,
  isMirrorChild,
  isParentVariable,
  interpolateVariableRefs,
  resolveVariableOutput,
  getParentAvailableValues,
  getInitialVariableValues,
  shouldAskAtUse,
  splitPromptContent,
  joinPromptContent,
  migrateLegacyVariables,
  slugifyVariableId,
  createUniqueVariableId,
  serializeVariableRef,
  readVariableRefAt,
  type VariableRegistry,
} from './variableRegistry'

describe('slugifyVariableId', () => {
  it('slugifies accented labels to a lowercase, dash-separated id', () => {
    expect(slugifyVariableId('Nom du Client')).toBe('nom-du-client')
    expect(slugifyVariableId('Été 2026 !')).toBe('ete-2026')
  })

  it('falls back to "var" when the label has no usable characters', () => {
    expect(slugifyVariableId('***')).toBe('var')
    expect(slugifyVariableId('')).toBe('var')
  })
})

describe('createUniqueVariableId', () => {
  it('returns the base slug when unused', () => {
    expect(createUniqueVariableId('Client', {})).toBe('client')
  })

  it('appends an incrementing suffix on collision', () => {
    const registry = {
      client: normalizeVariableDefinition({ id: 'client', label: 'Client' }),
      'client-2': normalizeVariableDefinition({ id: 'client-2', label: 'Client' }),
    }
    expect(createUniqueVariableId('Client', registry)).toBe('client-3')
  })
})

describe('normalizeVariableDefinition', () => {
  it('fills in sensible defaults for a bare partial', () => {
    const def = normalizeVariableDefinition({ label: 'Ville' })
    expect(def).toMatchObject({
      id: 'ville',
      label: 'Ville',
      options: [],
      multi: false,
      allowCustom: true,
      aliasOf: null,
      childMode: null,
      defaultValues: [],
      askAtUse: true,
    })
  })

  it('trims/filters empty options and default values', () => {
    const def = normalizeVariableDefinition({
      label: 'Ville',
      options: [' Paris ', '', 'Lyon'],
      defaultValues: ['  ', 'Marseille '],
    })
    expect(def.options).toEqual(['Paris', 'Lyon'])
    expect(def.defaultValues).toEqual(['Marseille'])
  })

  it('treats a self-referencing aliasOf as no parent', () => {
    const def = normalizeVariableDefinition({ id: 'x', label: 'X', aliasOf: 'x' })
    expect(def.aliasOf).toBeNull()
    expect(def.childMode).toBeNull()
  })

  it('mirror children have no own options/defaultValues and always askAtUse', () => {
    const def = normalizeVariableDefinition({
      label: 'Ville client',
      aliasOf: 'ville',
      options: ['ignored'],
      defaultValues: ['ignored'],
      askAtUse: false,
    })
    expect(def.childMode).toBe('mirror')
    expect(def.options).toEqual([])
    expect(def.defaultValues).toEqual([])
    expect(def.askAtUse).toBe(true)
  })

  it('pick children keep their own options but no defaultValues', () => {
    const def = normalizeVariableDefinition({
      label: 'Ville client',
      aliasOf: 'ville',
      childMode: 'pick',
      options: ['Paris', 'Lyon'],
      defaultValues: ['ignored'],
    })
    expect(def.childMode).toBe('pick')
    expect(def.options).toEqual(['Paris', 'Lyon'])
    expect(def.defaultValues).toEqual([])
  })
})

describe('parent/child resolution', () => {
  const registry: VariableRegistry = {
    ville: normalizeVariableDefinition({ id: 'ville', label: 'Ville', defaultValues: ['Paris'] }),
    'ville-mirror': normalizeVariableDefinition({
      id: 'ville-mirror',
      label: 'Ville (miroir)',
      aliasOf: 'ville',
      childMode: 'mirror',
    }),
    'ville-pick': normalizeVariableDefinition({
      id: 'ville-pick',
      label: 'Ville (pick)',
      aliasOf: 'ville',
      childMode: 'pick',
    }),
  }

  it('isParentVariable is true only for roots without aliasOf', () => {
    expect(isParentVariable(registry.ville)).toBe(true)
    expect(isParentVariable(registry['ville-mirror'])).toBe(false)
  })

  it('isMirrorChild / isPickChild classify children correctly', () => {
    expect(isMirrorChild(registry['ville-mirror'])).toBe(true)
    expect(isPickChild(registry['ville-mirror'])).toBe(false)
    expect(isPickChild(registry['ville-pick'])).toBe(true)
    expect(isMirrorChild(registry['ville-pick'])).toBe(false)
  })

  it('resolveRootVariableId follows mirror chains to the source', () => {
    expect(resolveRootVariableId('ville-mirror', registry)).toBe('ville')
    expect(resolveRootVariableId('ville', registry)).toBe('ville')
  })

  it('resolveRootVariableId treats pick children as their own root', () => {
    expect(resolveRootVariableId('ville-pick', registry)).toBe('ville-pick')
  })

  it('resolveRootVariableId is safe against cycles', () => {
    const cyclic: VariableRegistry = {
      a: normalizeVariableDefinition({ id: 'a', label: 'A', aliasOf: 'b', childMode: 'mirror' }),
      b: normalizeVariableDefinition({ id: 'b', label: 'B', aliasOf: 'a', childMode: 'mirror' }),
    }
    expect(() => resolveRootVariableId('a', cyclic)).not.toThrow()
  })

  it('shouldAskAtUse is false for mirror children, true otherwise', () => {
    expect(shouldAskAtUse('ville', registry)).toBe(true)
    expect(shouldAskAtUse('ville-mirror', registry)).toBe(false)
    expect(shouldAskAtUse('ville-pick', registry)).toBe(true)
    expect(shouldAskAtUse('unknown', registry)).toBe(true)
  })

  it('getParentAvailableValues merges defaults + options, deduplicated', () => {
    const reg: VariableRegistry = {
      p: normalizeVariableDefinition({
        id: 'p',
        label: 'P',
        defaultValues: ['A', 'B'],
        options: ['B', 'C'],
      }),
    }
    expect(getParentAvailableValues('p', reg)).toEqual(['A', 'B', 'C'])
  })

  it('getParentAvailableValues prefers live values when present', () => {
    const reg: VariableRegistry = {
      p: normalizeVariableDefinition({ id: 'p', label: 'P', defaultValues: ['A'] }),
    }
    expect(getParentAvailableValues('p', reg, { p: ['Live1', 'Live1', 'Live2'] })).toEqual([
      'Live1',
      'Live2',
    ])
  })

  it('getInitialVariableValues returns defaults for parents, empty for pick children', () => {
    expect(getInitialVariableValues('ville', registry)).toEqual(['Paris'])
    expect(getInitialVariableValues('ville-pick', registry)).toEqual([])
  })
})

describe('interpolateVariableRefs / resolveVariableOutput', () => {
  it('replaces {{id}} with the provided value', () => {
    expect(interpolateVariableRefs('Bonjour {{nom}} !', { nom: 'Alice' })).toBe('Bonjour Alice !')
  })

  it('leaves the placeholder untouched when no value is provided', () => {
    expect(interpolateVariableRefs('Bonjour {{nom}} !', {})).toBe('Bonjour {{nom}} !')
  })

  it('resolveVariableOutput resolves mirror children through the parent value', () => {
    const registry: VariableRegistry = {
      ville: normalizeVariableDefinition({ id: 'ville', label: 'Ville' }),
      'ville-mirror': normalizeVariableDefinition({
        id: 'ville-mirror',
        label: 'Ville (miroir)',
        aliasOf: 'ville',
        childMode: 'mirror',
      }),
    }
    const rawValues = { ville: ['Paris'] }
    expect(resolveVariableOutput('ville-mirror', rawValues, registry)).toBe('Paris')
    expect(resolveVariableOutput('ville', rawValues, registry)).toBe('Paris')
  })

  it('resolveVariableOutput resolves nested {{ref}} interpolation up to a fixed point', () => {
    const registry: VariableRegistry = {}
    const rawValues = { a: ['{{b}}'], b: ['{{c}}'], c: ['final'] }
    expect(resolveVariableOutput('a', rawValues, registry)).toBe('final')
  })
})

describe('splitPromptContent / joinPromptContent (trailer %%riven-vars%%)', () => {
  it('round-trips a body with a registry through join then split', () => {
    const registry: VariableRegistry = {
      nom: normalizeVariableDefinition({ id: 'nom', label: 'Nom', defaultValues: ['Alice'] }),
    }
    const joined = joinPromptContent('Bonjour /variable:nom', registry)
    expect(joined).toContain('%%riven-vars%%')
    const { body, registry: parsed } = splitPromptContent(joined)
    expect(body).toBe('Bonjour /variable:nom')
    expect(parsed.nom).toMatchObject({ id: 'nom', label: 'Nom', defaultValues: ['Alice'] })
  })

  it('splitPromptContent returns the raw content with an empty registry when there is no trailer', () => {
    expect(splitPromptContent('Just plain text')).toEqual({
      body: 'Just plain text',
      registry: {},
    })
  })

  it('joinPromptContent returns the trimmed body unchanged when the registry is empty', () => {
    expect(joinPromptContent('Body   \n\n', {})).toBe('Body')
  })

  it('splitPromptContent recovers gracefully from a corrupted trailer', () => {
    const corrupted = 'Body\n\n%%riven-vars%%\n{not json%%/riven-vars%%\n'
    const { registry } = splitPromptContent(corrupted)
    expect(registry).toEqual({})
  })
})

describe('migrateLegacyVariables', () => {
  it('converts a legacy /variable{...} block into a registry entry + /variable:id token', () => {
    const legacy = 'Bonjour /variable{id:"nom",label:"Nom",options:"Alice|Bob",multi:false}'
    const migrated = migrateLegacyVariables(legacy)
    const { body, registry } = splitPromptContent(migrated)
    expect(body).toBe('Bonjour /variable:nom')
    expect(registry.nom).toMatchObject({ id: 'nom', label: 'Nom', options: ['Alice', 'Bob'] })
  })

  it('leaves already-migrated /variable:id tokens untouched', () => {
    const already = 'Bonjour /variable:nom'
    expect(migrateLegacyVariables(already)).toContain('/variable:nom')
  })

  it('creates a fresh variable for a bare legacy /variable with no block', () => {
    const migrated = migrateLegacyVariables('Bonjour /variable')
    const { body, registry } = splitPromptContent(migrated)
    const ids = Object.keys(registry)
    expect(ids).toHaveLength(1)
    expect(body).toBe(`Bonjour ${serializeVariableRef(ids[0])}`)
  })
})

describe('readVariableRefAt', () => {
  it('reads a /variable:id token at the given index', () => {
    const text = 'x /variable:client y'
    const result = readVariableRefAt(text, 2)
    expect(result).toEqual({ id: 'client', token: '/variable:client', length: 16 })
  })

  it('returns null when there is no variable token at the index', () => {
    expect(readVariableRefAt('hello world', 0)).toBeNull()
  })
})
