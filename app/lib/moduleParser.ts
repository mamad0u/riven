import {
  readVariableRefAt,
  splitPromptContent,
  type VariableDefinition,
} from './variableRegistry'

export interface DetectedModule {
  name: string
  type: 'texte' | 'nombre' | 'variable' | 'fichier'
  index: number
  value: string
  /** Présent uniquement pour type === 'variable' */
  variable?: VariableDefinition
  variableId?: string
}

export function detectModules(text: string): DetectedModule[] {
  const { body, registry } = splitPromptContent(text)
  const modules: DetectedModule[] = []
  let index = 0
  let i = 0

  while (i < body.length) {
    if (body[i] !== '/') {
      i++
      continue
    }
    const simple = body.slice(i).match(/^\/(texte|nombre|fichier)\b/)
    if (simple) {
      modules.push({
        name: simple[1],
        type: simple[1] as DetectedModule['type'],
        index: index++,
        value: '',
      })
      i += simple[0].length
      continue
    }
    const variable = readVariableRefAt(body, i)
    if (variable) {
      const def = registry[variable.id] ?? {
        id: variable.id,
        label: variable.id,
        options: [],
        multi: false,
        allowCustom: true,
      }
      modules.push({
        name: 'variable',
        type: 'variable',
        index: index++,
        value: '',
        variable: def,
        variableId: variable.id,
      })
      i += variable.length
      continue
    }
    i++
  }
  return modules
}

export function replaceModules(
  text: string,
  values: Array<{ name: string; index: number; value: string }>
): string {
  const { body, registry } = splitPromptContent(text)
  let currentIndex = 0
  let out = ''
  let i = 0

  while (i < body.length) {
    if (body[i] === '/') {
      const simple = body.slice(i).match(/^\/(texte|nombre|fichier)\b/)
      if (simple) {
        out += values[currentIndex]?.value ?? ''
        currentIndex++
        i += simple[0].length
        continue
      }
      const variable = readVariableRefAt(body, i)
      if (variable) {
        out += values[currentIndex]?.value ?? ''
        currentIndex++
        i += variable.length
        continue
      }
    }
    out += body[i]
    i++
  }

  // Le résultat copié ne contient plus le registry (prompt final)
  void registry
  return out
}
