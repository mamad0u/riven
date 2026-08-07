'use client'

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'
import ModuleAutocomplete, { AVAILABLE_MODULES } from './ModuleAutocomplete'
import { updateVariableChipLabel } from './ModuleChip'
import VariableConfigModal from './VariableConfigModal'
import {
  insertModuleToken,
  normalizeModuleSpacing,
  splitPromptContent,
  joinPromptContent,
  type ModuleTokenType,
} from '../lib/moduleInsert'
import {
  serializeVariableRef,
  type VariableDefinition,
  type VariableRegistry,
} from '../lib/variableRegistry'
import {
  MODULE_IDS,
  prepareContent,
  contentToHtml,
  serializeBody,
  getCaretCharacterOffset,
  setCaretByOffset,
} from '../lib/editorSerialization'

const PLACEHOLDER =
  "Vous pouvez écrire du texte comme ici ou bien utiliser des modules, utiliser '/' ou le panneau des modules et les glisser..."

export interface RichModuleEditorHandle {
  insertModuleAtCursor: (type: ModuleTokenType | string) => void
  insertVariableRef: (id: string) => void
  openCreateVariable: () => void
  openEditVariable: (id: string) => void
  replaceContent: (value: string) => void
  focus: () => void
}

interface RichModuleEditorProps {
  content: string
  onChange: (content: string) => void
}

const RichModuleEditor = forwardRef<RichModuleEditorHandle, RichModuleEditorProps>(
  function RichModuleEditor({ content, onChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null)
    const registryRef = useRef<VariableRegistry>({})
    const [registryVersion, setRegistryVersion] = useState(0)
    const lastSerialized = useRef(content)
    const lastCaretRef = useRef(0)
    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [autocompletePosition, setAutocompletePosition] = useState<{
      top: number
      left: number
    } | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isFocused, setIsFocused] = useState(false)
    const [varModal, setVarModal] = useState<{
      mode: 'create' | 'edit'
      initial?: Partial<VariableDefinition>
    } | null>(null)

    const rememberCaret = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return
      lastCaretRef.current = getCaretCharacterOffset(el)
    }, [])

    const syncDomFromContent = useCallback((value: string) => {
      const el = editorRef.current
      if (!el) return
      const prepared = prepareContent(value)
      const { registry } = splitPromptContent(prepared)
      registryRef.current = registry
      setRegistryVersion((v) => v + 1)
      el.innerHTML = contentToHtml(prepared) || '<br>'
      lastSerialized.current = prepared
    }, [])

    const focusEditor = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      el.focus()
      setIsFocused(true)
    }, [])

    const emitFull = useCallback(
      (body: string, registry: VariableRegistry) => {
        const normalizedBody = normalizeModuleSpacing(joinPromptContent(body, {}))
        const { body: cleanBody } = splitPromptContent(normalizedBody)
        const full = joinPromptContent(cleanBody, registry)
        lastSerialized.current = full
        registryRef.current = registry
        onChange(full)
        return full
      },
      [onChange]
    )

    const emitFromDom = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      const body = serializeBody(el)
      return emitFull(body, registryRef.current)
    }, [emitFull])

    const replaceContent = useCallback(
      (value: string) => {
        const prepared = prepareContent(value)
        syncDomFromContent(prepared)
        setShowAutocomplete(false)
        setAutocompletePosition(null)
        onChange(prepared)
        requestAnimationFrame(() => {
          const el = editorRef.current
          if (!el) return
          focusEditor()
          const { body } = splitPromptContent(prepared)
          setCaretByOffset(el, body.length)
          lastCaretRef.current = body.length
        })
      },
      [syncDomFromContent, focusEditor, onChange]
    )

    useEffect(() => {
      if (content === lastSerialized.current) return
      const el = editorRef.current
      if (!el) return

      // Pendant la frappe (surtout key-repeat Backspace/Delete), React peut renvoyer
      // une prop `content` périmée. Si on resync le DOM, le caret saute en début de fichier.
      // Tant que l’éditeur a le focus, lastSerialized + DOM restent la source de vérité
      // (les remplacements externes passent par replaceContent / insert*).
      if (document.activeElement === el) {
        return
      }

      const prepared = prepareContent(content)
      if (prepared !== content) {
        onChange(prepared)
        return
      }
      const offset = lastCaretRef.current
      syncDomFromContent(prepared)
      const { body } = splitPromptContent(prepared)
      setCaretByOffset(el, Math.min(offset, body.length))
    }, [content, syncDomFromContent, onChange])

    useEffect(() => {
      syncDomFromContent(prepareContent(content))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      const onSelChange = () => {
        const el = editorRef.current
        if (!el || document.activeElement !== el) return
        rememberCaret()
      }
      document.addEventListener('selectionchange', onSelChange)
      return () => document.removeEventListener('selectionchange', onSelChange)
    }, [rememberCaret])

    const insertVariableRef = useCallback(
      (id: string) => {
        const el = editorRef.current
        if (!el) return
        const currentBody = serializeBody(el)
        let cursor = lastCaretRef.current
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          cursor = getCaretCharacterOffset(el)
        }
        cursor = Math.max(0, Math.min(cursor, currentBody.length))
        el.focus()

        let base = currentBody
        let cur = cursor
        const before = currentBody.slice(0, cursor)
        const slashMatch = before.match(/\/[a-zA-Z0-9_:]*$/)
        if (slashMatch) {
          const start = before.length - slashMatch[0].length
          base = currentBody.slice(0, start) + currentBody.slice(cursor)
          cur = start
        }

        const token = serializeVariableRef(id)
        const after = base.slice(cur)
        const needsSpace = after.length === 0 || (after[0] !== ' ' && after[0] !== '\n')
        const insertion = needsSpace ? `${token} ` : token
        const nextBody = base.slice(0, cur) + insertion + after
        const full = emitFull(nextBody, registryRef.current)
        syncDomFromContent(full)
        const nextCursor = cur + insertion.length
        lastCaretRef.current = nextCursor
        requestAnimationFrame(() => {
          if (editorRef.current) setCaretByOffset(editorRef.current, nextCursor)
        })
        setShowAutocomplete(false)
        setAutocompletePosition(null)
      },
      [emitFull, syncDomFromContent]
    )

    const insertModuleAtCursor = useCallback(
      (type: string) => {
        if (type === 'variable') {
          setVarModal({ mode: 'create', initial: { label: 'Variable', options: [] } })
          return
        }
        const el = editorRef.current
        if (!el || !MODULE_IDS.has(type)) return

        const current = serializeBody(el)
        let cursor = lastCaretRef.current
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
          cursor = getCaretCharacterOffset(el)
        }
        cursor = Math.max(0, Math.min(cursor, current.length))
        el.focus()

        let base = current
        let cur = cursor
        const before = current.slice(0, cursor)
        const slashMatch = before.match(/\/[a-z]*$/)
        if (slashMatch) {
          const start = before.length - slashMatch[0].length
          base = current.slice(0, start) + current.slice(cursor)
          cur = start
        }
        const fullBase = joinPromptContent(base, registryRef.current)
        const { content: next, cursor: nextCursor } = insertModuleToken(
          fullBase,
          cur,
          type as ModuleTokenType
        )
        syncDomFromContent(next)
        onChange(next)
        lastCaretRef.current = nextCursor
        requestAnimationFrame(() => {
          if (editorRef.current) setCaretByOffset(editorRef.current, nextCursor)
        })
        setShowAutocomplete(false)
        setAutocompletePosition(null)
      },
      [onChange, syncDomFromContent]
    )

    const openCreateVariable = useCallback(() => {
      setVarModal({ mode: 'create', initial: { label: 'Variable', options: [''] } })
    }, [])

    const openEditVariable = useCallback((id: string) => {
      const def = registryRef.current[id]
      if (!def) return
      setVarModal({ mode: 'edit', initial: def })
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        insertModuleAtCursor,
        insertVariableRef,
        openCreateVariable,
        openEditVariable,
        replaceContent,
        focus: focusEditor,
      }),
      [
        insertModuleAtCursor,
        insertVariableRef,
        openCreateVariable,
        openEditVariable,
        replaceContent,
        focusEditor,
      ]
    )

    const updateAutocomplete = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      const serialized = serializeBody(el)
      const cursor = getCaretCharacterOffset(el)
      const before = serialized.slice(0, cursor)
      const lastSlash = before.lastIndexOf('/')
      if (lastSlash === -1) {
        setShowAutocomplete(false)
        return
      }
      const afterSlash = before.slice(lastSlash + 1)
      const partialOk =
        !afterSlash.includes(' ') &&
        !afterSlash.includes('\n') &&
        (afterSlash === '' ||
          AVAILABLE_MODULES.some((m) => m.name.startsWith(afterSlash)) ||
          afterSlash.startsWith('variable') ||
          Object.keys(registryRef.current).some(
            (id) => `variable:${id}`.startsWith(afterSlash) || id.startsWith(afterSlash)
          ))

      if (!partialOk) {
        setShowAutocomplete(false)
        return
      }

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) {
          const box = el.getBoundingClientRect()
          setAutocompletePosition({ top: box.top + 40, left: box.left + 24 })
        } else {
          setAutocompletePosition({ top: rect.bottom + 4, left: rect.left })
        }
        setShowAutocomplete(true)
        setSelectedIndex(0)
      }
    }, [])

    const handleVarSave = (def: VariableDefinition) => {
      const registry = { ...registryRef.current }
      const prevId = varModal?.mode === 'edit' ? varModal.initial?.id : undefined

      if (prevId && prevId !== def.id) {
        delete registry[prevId]
        // Renommer les refs dans le body
        const el = editorRef.current
        if (el) {
          el.querySelectorAll<HTMLElement>('[data-module="variable"]').forEach((chip) => {
            if (chip.dataset.varId === prevId) {
              chip.dataset.varId = def.id
              updateVariableChipLabel(chip, def.label)
            }
          })
        }
      }

      registry[def.id] = def
      registryRef.current = registry
      setRegistryVersion((v) => v + 1)

      // Mettre à jour les labels des chips
      const el = editorRef.current
      if (el) {
        el.querySelectorAll<HTMLElement>('[data-module="variable"]').forEach((chip) => {
          if (chip.dataset.varId === def.id) {
            updateVariableChipLabel(chip, def.label)
          }
        })
      }

      if (varModal?.mode === 'create') {
        const body = el ? serializeBody(el) : ''
        emitFull(body, registry)
        setVarModal(null)
        requestAnimationFrame(() => insertVariableRef(def.id))
        return
      }

      const body = el ? serializeBody(el) : splitPromptContent(lastSerialized.current).body
      emitFull(body, registry)
      syncDomFromContent(joinPromptContent(body, registry))
      setVarModal(null)
    }

    const isEmpty = !splitPromptContent(content).body.trim()

    const focusEditorAtClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const el = editorRef.current
      if (!el) return
      if (e.target === el || el.contains(e.target as Node)) return
      e.preventDefault()
      focusEditor()
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
      rememberCaret()
    }

    const autocompleteItems = [
      ...AVAILABLE_MODULES.map((m) => ({
        key: m.name,
        title: `/${m.name}`,
        description: m.description,
        action: () => insertModuleAtCursor(m.name),
      })),
      ...Object.values(registryRef.current).map((v) => ({
        key: `var:${v.id}`,
        title: `/variable:${v.id}`,
        description: v.label,
        action: () => insertVariableRef(v.id),
      })),
    ]
    void registryVersion

    return (
      <div className="app-no-drag relative flex-1 overflow-hidden">
        <div
          className="relative h-full w-full cursor-text overflow-auto border border-transparent border-dashed p-6 font-mono text-sm text-riven-text-primary bg-riven-main"
          onMouseDown={focusEditorAtClick}
        >
          {isEmpty && !isFocused && (
            <div className="pointer-events-none absolute inset-6 text-riven-text-secondary">
              {PLACEHOLDER}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline
            tabIndex={0}
            suppressContentEditableWarning
            className="app-no-drag min-h-full w-full outline-none whitespace-pre-wrap break-words"
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              rememberCaret()
              setIsFocused(false)
              const target = e.relatedTarget as HTMLElement
              if (!target?.closest('.module-autocomplete')) {
                setTimeout(() => setShowAutocomplete(false), 200)
              }
            }}
            onInput={() => {
              emitFromDom()
              rememberCaret()
              updateAutocomplete()
            }}
            onKeyUp={() => rememberCaret()}
            onKeyDown={(e) => {
              if (showAutocomplete && (e.key === 'Enter' || e.key === 'Tab')) {
                e.preventDefault()
                const item = autocompleteItems[selectedIndex] ?? autocompleteItems[0]
                item?.action()
              } else if (showAutocomplete && e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((i) => (i + 1) % Math.max(autocompleteItems.length, 1))
              } else if (showAutocomplete && e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(
                  (i) =>
                    (i - 1 + Math.max(autocompleteItems.length, 1)) %
                    Math.max(autocompleteItems.length, 1)
                )
              } else if (showAutocomplete && e.key === 'Escape') {
                e.preventDefault()
                setShowAutocomplete(false)
              }
              // Backspace/Delete : laisser le navigateur supprimer, onInput gère emit + caret.
              // Un second emit en rAF provoquait des syncs périmés et un saut en début de fichier.
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              const chip = (e.target as HTMLElement).closest?.('[data-module]') as HTMLElement | null
              if (chip && editorRef.current?.contains(chip)) {
                e.preventDefault()
                if (chip.dataset.module === 'variable' && chip.dataset.varId) {
                  openEditVariable(chip.dataset.varId)
                  return
                }
                const el = editorRef.current
                if (!el) return
                focusEditor()
                const parent = chip.parentNode
                if (!parent) return
                const idx = Array.from(parent.childNodes).indexOf(chip as ChildNode)
                const sel = window.getSelection()
                if (!sel) return
                const range = document.createRange()
                range.setStart(parent, idx + 1)
                range.collapse(true)
                sel.removeAllRanges()
                sel.addRange(range)
                rememberCaret()
              }
            }}
            onClick={() => {
              rememberCaret()
              updateAutocomplete()
            }}
          />
        </div>
        {showAutocomplete && autocompletePosition && (
          <ModuleAutocomplete
            position={autocompletePosition}
            selectedIndex={selectedIndex}
            items={autocompleteItems.map(({ key, title, description }) => ({
              key,
              title,
              description,
            }))}
            onSelect={(key) => {
              const item = autocompleteItems.find((i) => i.key === key)
              item?.action()
            }}
          />
        )}
        {varModal && (
          <VariableConfigModal
            mode={varModal.mode}
            initial={varModal.initial}
            registry={registryRef.current}
            onSave={handleVarSave}
            onCancel={() => setVarModal(null)}
          />
        )}
      </div>
    )
  }
)

export default RichModuleEditor
