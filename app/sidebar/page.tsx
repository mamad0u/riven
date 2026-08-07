'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import SearchBar, { SearchBarRef } from '../components/SearchBar'
import SnapConfigModal from '../components/SnapConfigModal'
import Badge from '../components/ui/Badge'
import FolderColorBadge from '../components/FolderColorBadge'
import { detectModules, replaceModules, DetectedModule } from '../lib/moduleParser'
import { getTagsForPath } from '../lib/promptMetadata'
import {
  loadShortcutMap,
  eventMatchesAccelerator,
} from '../lib/shortcutStore'
import {
  dossierNameFromPath,
  resolveFolderColorForFile,
} from '../lib/folderColors'
import { ensureMigrated } from '../lib/tagStore'
import type { FileItem } from '@/electron.d'

interface SearchResult {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  isFile: boolean
  size: number
  created: Date
  modified: Date
}

type TagVariant = 'green' | 'purple' | 'blue'

interface EnrichedResult extends SearchResult {
  title: string
  description: string
  tags: { label: string; variant: TagVariant }[]
  canEdit: boolean
  dossier: string
  dossierColor: string | null
}

const PREVIEW_CACHE = new Map<string, string>()
const PREVIEW_LIMIT = 12

function titleFromName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

function firstLinePreview(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#'))
  if (line) return line.length > 110 ? `${line.slice(0, 107)}…` : line
  const fallback = content.trim().replace(/\s+/g, ' ')
  return fallback.length > 110 ? `${fallback.slice(0, 107)}…` : fallback || ''
}

function cycleVariant(base: 'green' | 'purple', index: number): TagVariant {
  const cycle: TagVariant[] = ['blue', 'purple', 'green']
  return cycle[(index + (base === 'purple' ? 1 : 0)) % cycle.length]
}

function isPromptFile(item: SearchResult) {
  if (!item.isFile) return false
  const lower = item.name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.txt') || !item.name.includes('.')
}

export default function SidebarPage() {
  const [isVisible, setIsVisible] = useState(false)
  const [rawResults, setRawResults] = useState<SearchResult[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedFile, setCopiedFile] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showModuleEditor, setShowModuleEditor] = useState(false)
  const [detectedModules, setDetectedModules] = useState<DetectedModule[]>([])
  const [fileContent, setFileContent] = useState('')
  const [currentFileName, setCurrentFileName] = useState('')
  const searchBarRef = useRef<SearchBarRef>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const isActive = searchQuery.trim().length > 0

  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => searchBarRef.current?.focus())
    }
  }, [isActive])

  useEffect(() => {
    ensureMigrated()
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    const timer = setTimeout(() => {
      setIsVisible(true)
      setTimeout(() => searchBarRef.current?.focus(), 80)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setRawResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      if (!window.electronAPI?.fileManager) {
        setIsSearching(false)
        return
      }
      try {
        const result = await window.electronAPI.fileManager.searchFiles(searchQuery.trim())
        if ('error' in result) {
          setRawResults([])
        } else {
          const files = (result.items || []).filter(isPromptFile)
          setRawResults(files)
          setSelectedIndex(0)
        }
      } catch {
        setRawResults([])
      } finally {
        setIsSearching(false)
      }
    }, 150)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Lazy previews for top results
  useEffect(() => {
    if (rawResults.length === 0) return
    let cancelled = false
    const targets = rawResults.slice(0, PREVIEW_LIMIT)

    ;(async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        targets.map(async (item) => {
          if (PREVIEW_CACHE.has(item.path)) {
            next[item.path] = PREVIEW_CACHE.get(item.path)!
            return
          }
          if (!window.electronAPI?.fileManager) return
          try {
            const fileResult = await window.electronAPI.fileManager.readFile(item.path)
            if ('error' in fileResult) {
              next[item.path] = item.path
              return
            }
            const preview = firstLinePreview(fileResult.content) || item.path
            PREVIEW_CACHE.set(item.path, preview)
            next[item.path] = preview
          } catch {
            next[item.path] = item.path
          }
        })
      )
      if (!cancelled) {
        setPreviews((prev) => ({ ...prev, ...next }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawResults])

  const enrichedResults: EnrichedResult[] = useMemo(() => {
    return rawResults.map((item, index) => {
      const tags = getTagsForPath(item.path, index).map((t, i) => ({
        label: t.label,
        variant: cycleVariant(t.variant, i + index),
      }))
      return {
        ...item,
        title: titleFromName(item.name),
        description: previews[item.path] || item.path,
        tags,
        canEdit: true,
        dossier: dossierNameFromPath(item.path),
        dossierColor: resolveFolderColorForFile(item.path),
      }
    })
  }, [rawResults, previews])

  const copyToClipboard = useCallback(async (content: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedFile(fileName)
      setTimeout(() => setCopiedFile(null), 1800)
      setTimeout(() => {
        window.electronAPI?.closeSidebar()
        setTimeout(() => window.electronAPI?.restoreFocusAndPaste(content), 350)
      }, 80)
    } catch {
      alert('Impossible de copier dans le presse-papier')
    }
  }, [])

  const handleUse = useCallback(
    async (result: EnrichedResult) => {
      if (!window.electronAPI?.fileManager || !result.isFile) return
      try {
        const fileResult = await window.electronAPI.fileManager.readFile(result.path)
        if ('error' in fileResult) {
          alert(fileResult.error)
          return
        }
        const modules = detectModules(fileResult.content)
        if (modules.length > 0) {
          setDetectedModules(modules)
          setFileContent(fileResult.content)
          setCurrentFileName(result.name)
          setShowModuleEditor(true)
        } else {
          copyToClipboard(fileResult.content, result.name)
        }
      } catch {
        alert('Erreur lors de la lecture du fichier')
      }
    },
    [copyToClipboard]
  )

  const handleEdit = useCallback(async (result: EnrichedResult) => {
    if (!result.canEdit || !window.electronAPI?.openPromptInMain) return
    const file: FileItem = {
      name: result.name,
      path: result.path,
      fullPath: result.fullPath,
      isDirectory: false,
      isFile: true,
      size: result.size,
      created: result.created,
      modified: result.modified,
    }
    window.electronAPI.openPromptInMain(file)
    window.electronAPI.closeSidebar()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showModuleEditor) {
          setShowModuleEditor(false)
          setDetectedModules([])
          return
        }
        window.electronAPI?.closeSidebar()
        return
      }

      if (!isActive || enrichedResults.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < enrichedResults.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = enrichedResults[selectedIndex]
        if (item) void handleUse(item)
      } else if (eventMatchesAccelerator(e, loadShortcutMap().quickEdit)) {
        e.preventDefault()
        const item = enrichedResults[selectedIndex]
        if (item?.canEdit) void handleEdit(item)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, enrichedResults, selectedIndex, handleUse, handleEdit, showModuleEditor])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleModuleConfirm = (values: Array<{ name: string; index: number; value: string }>) => {
    copyToClipboard(replaceModules(fileContent, values), currentFileName)
    setShowModuleEditor(false)
    setDetectedModules([])
    setFileContent('')
    setCurrentFileName('')
  }

  const selectedId =
    enrichedResults[selectedIndex] != null
      ? `result-${enrichedResults[selectedIndex].path}`
      : undefined

  return (
    <div className="h-screen w-full overflow-visible bg-transparent">
      <div className="flex h-full w-full flex-col items-center px-4 pt-10">
        <div
          className={`w-full max-w-2xl transition-opacity duration-300 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {!isActive ? (
            <div className="animate-quick-search">
              <SearchBar
                ref={searchBarRef}
                value={searchQuery}
                onSearch={handleSearch}
                onInputChange={handleSearch}
                placeholder="Search prompts..."
                className="w-full"
                autoFocus
                variant="pill"
              />
            </div>
          ) : (
            <div
              className="animate-quick-search overflow-hidden rounded-2xl riven-glass shadow-2xl"
              role="combobox"
              aria-expanded
              aria-haspopup="listbox"
              aria-owns="quick-search-results"
            >
              <SearchBar
                ref={searchBarRef}
                value={searchQuery}
                onSearch={handleSearch}
                onInputChange={handleSearch}
                placeholder="Search prompts..."
                className="w-full"
                autoFocus
                variant="embedded"
              />

              <div className="border-t border-white/10">
                {isSearching ? (
                  <div className="px-5 py-8 text-center text-sm text-riven-text-secondary">
                    Recherche en cours…
                  </div>
                ) : enrichedResults.length > 0 ? (
                  <div
                    id="quick-search-results"
                    ref={listRef}
                    role="listbox"
                    aria-activedescendant={selectedId}
                    className="max-h-[420px] overflow-y-auto py-1"
                  >
                    {enrichedResults.map((result, index) => {
                      const selected = index === selectedIndex
                      return (
                        <button
                          key={result.path}
                          id={`result-${result.path}`}
                          data-index={index}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => void handleUse(result)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`app-no-drag flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                            selected ? 'bg-riven-selected/90' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-riven-text-primary">
                              {result.title}
                            </div>
                            <div className="mt-0.5 line-clamp-1 text-xs text-riven-text-secondary">
                              {result.description}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <div className="flex flex-wrap justify-end gap-1">
                              {result.dossier && result.dossierColor && (
                                <FolderColorBadge
                                  name={result.dossier}
                                  color={result.dossierColor}
                                />
                              )}
                              {result.tags.slice(0, 3).map((tag) => (
                                <Badge key={`${result.path}-${tag.label}`} variant={tag.variant}>
                                  {tag.label}
                                </Badge>
                              ))}
                            </div>
                            {selected && (
                              <div className="flex flex-wrap justify-end gap-1">
                                {result.canEdit && (
                                  <span className="rounded-md border border-white/15 bg-black/25 px-1.5 py-0.5 text-[10px] text-riven-text-secondary">
                                    Editer Shift + M
                                  </span>
                                )}
                                <span className="rounded-md border border-white/15 bg-black/25 px-1.5 py-0.5 text-[10px] text-riven-text-secondary">
                                  Utiliser Enter
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center text-sm text-riven-text-secondary">
                    Aucun prompt trouvé
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {copiedFile && (
          <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
            <div
              className="px-8 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              style={{ backgroundColor: '#2B2B2F', borderRadius: 9999 }}
            >
              Prompt utilisé !
            </div>
          </div>
        )}

        {showModuleEditor && (
          <SnapConfigModal
            key={detectedModules.map((m) => m.index).join('-')}
            modules={detectedModules}
            fileContent={fileContent}
            fileName={currentFileName}
            onConfirm={handleModuleConfirm}
            onCancel={() => {
              setShowModuleEditor(false)
              setDetectedModules([])
            }}
          />
        )}
      </div>
    </div>
  )
}
