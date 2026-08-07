// Fonctions pures de sérialisation DOM <-> contenu prompt pour RichModuleEditor.
// Extrait de RichModuleEditor.tsx — aucun changement de comportement, uniquement
// déplacé pour isoler la logique de sérialisation (testable sans React/DOM réel via jsdom).

import { AVAILABLE_MODULES } from '../components/ModuleAutocomplete'
import { moduleChipHtml } from '../components/ModuleChip'
import {
  parseContentToSegments,
  splitPromptContent,
  joinPromptContent,
  migrateLegacyVariables,
} from './moduleInsert'
import { serializeVariableRef } from './variableRegistry'

export const MODULE_IDS = new Set(AVAILABLE_MODULES.map((m) => m.name))

export function prepareContent(content: string): string {
  if (content.includes('/variable{') || /\/variable(?!:)(?![a-zA-Z0-9_-])/.test(content)) {
    return migrateLegacyVariables(content)
  }
  return content
}

export function escapeTextToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

export function contentToHtml(fullContent: string): string {
  const { body, registry } = splitPromptContent(fullContent)
  if (!body) return ''
  const segments = parseContentToSegments(joinPromptContent(body, {}))
  let html = ''
  for (const seg of segments) {
    if (seg.kind === 'text') {
      html += escapeTextToHtml(seg.value)
    } else if (seg.type === 'variable') {
      const def = registry[seg.variableId]
      html += moduleChipHtml('variable', {
        variableId: seg.variableId,
        label: def?.label || seg.variableId,
      })
    } else {
      html += moduleChipHtml(seg.type)
    }
  }
  return html
}

export function chipTokenLength(el: HTMLElement): number {
  // Doit matcher serializeBody (sans espace forcé) pour ne pas décaler le caret.
  if (el.dataset.module === 'variable') {
    return serializeVariableRef(el.dataset.varId || 'var').length
  }
  return `/${el.dataset.module}`.length
}

export function serializeBody(root: HTMLElement): string {
  let out = ''

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.dataset?.module && MODULE_IDS.has(el.dataset.module)) {
      if (el.dataset.module === 'variable') {
        out += serializeVariableRef(el.dataset.varId || 'var')
      } else {
        out += `/${el.dataset.module}`
      }
      return
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    if (el.tagName === 'DIV' || el.tagName === 'P') {
      if (out.length > 0 && !out.endsWith('\n')) out += '\n'
    }
    for (const child of Array.from(el.childNodes)) walk(child)
  }

  for (const child of Array.from(root.childNodes)) walk(child)
  return out.replace(/\u00a0/g, ' ')
}

export function getCaretCharacterOffset(root: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return serializeBody(root).length
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  const tmp = document.createElement('div')
  tmp.appendChild(pre.cloneContents())
  return serializeBody(tmp).length
}

export function setCaretByOffset(root: HTMLElement, targetOffset: number) {
  const sel = window.getSelection()
  if (!sel) return

  let remaining = Math.max(0, targetOffset)
  const range = document.createRange()

  const placeAt = (node: Node, offset: number) => {
    range.setStart(node, offset)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const visit = (n: Node): boolean => {
    if (n.nodeType === Node.TEXT_NODE) {
      const len = n.textContent?.length ?? 0
      if (remaining <= len) {
        placeAt(n, remaining)
        return true
      }
      remaining -= len
      return false
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return false
    const el = n as HTMLElement
    if (el.dataset?.module && MODULE_IDS.has(el.dataset.module)) {
      const tokenLen = chipTokenLength(el)
      if (remaining <= tokenLen) {
        const parent = el.parentNode
        if (parent) {
          const idx = Array.from(parent.childNodes).indexOf(el)
          range.setStart(parent, idx + 1)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        return true
      }
      remaining -= tokenLen
      return false
    }
    if (el.tagName === 'BR') {
      if (remaining <= 1) {
        const parent = el.parentNode
        if (parent) {
          const idx = Array.from(parent.childNodes).indexOf(el)
          range.setStart(parent, idx + 1)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        return true
      }
      remaining -= 1
      return false
    }
    for (const c of Array.from(el.childNodes)) {
      if (visit(c)) return true
    }
    return false
  }

  if (!visit(root)) {
    range.selectNodeContents(root)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
}
