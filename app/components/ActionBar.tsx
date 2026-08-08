'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import ModuleMenu, { ModuleType } from './ModuleMenu'
import TemplateMenu from './TemplateMenu'
import { normalizeModuleSpacing } from '../lib/moduleInsert'

type ActionTab = 'module' | 'template' | 'options'

interface ActionBarProps {
  isOpen: boolean
  onClose: () => void
  onInsertModule: (moduleId: ModuleType) => void
  onApplyTemplate: (body: string) => void
}

const TABS: { id: ActionTab; label: string }[] = [
  { id: 'module', label: 'Module' },
  { id: 'template', label: 'Template' },
  { id: 'options', label: 'Options' },
]

const PLACEHOLDERS: Record<ActionTab, string> = {
  module: 'Search Modules',
  template: 'Search Templates',
  options: 'Search Options',
}

export default function ActionBar({
  isOpen,
  onClose,
  onInsertModule,
  onApplyTemplate,
}: ActionBarProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>('module')
  const [searchQuery, setSearchQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setActiveTab('module')
      setSearchQuery('')
      setExpanded(false)
      return
    }
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setSearchQuery('')
    setActiveTab('module')
    setExpanded(false)
    onClose()
  }

  const handleSelectModule = (id: ModuleType) => {
    onInsertModule(id)
    handleClose()
  }

  const openTab = (tab: ActionTab) => {
    setActiveTab(tab)
    setExpanded(true)
  }

  return (
    <div className="fixed bottom-20 right-6 z-40 w-[320px]">
      <div className="overflow-hidden rounded-riven-lg border border-riven-border bg-riven-card shadow-xl">
        <div className="flex items-center gap-2 p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-riven-text-secondary" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (e.target.value.trim()) setExpanded(true)
              }}
              placeholder={PLACEHOLDERS[activeTab]}
              className="w-full rounded-riven border border-riven-border bg-riven-input py-2 pl-9 pr-3 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:border-riven-border focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="Fermer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-riven border border-riven-border bg-riven-input text-riven-text-secondary transition-colors hover:text-riven-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 pb-3">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => openTab(tab.id)}
                className={`rounded-riven px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-riven-selected text-riven-text-primary'
                    : 'text-riven-text-secondary hover:text-riven-text-primary'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {expanded && (
          <div className="max-h-72 overflow-y-auto border-t border-riven-border">
            {activeTab === 'module' && (
              <ModuleMenu onSelect={handleSelectModule} searchQuery={searchQuery} />
            )}
            {activeTab === 'template' && (
              <TemplateMenu
                searchQuery={searchQuery}
                onSelect={(t) => {
                  const body = normalizeModuleSpacing(t.body)
                  handleClose()
                  // Appliquer après fermeture pour ne pas bloquer le focus (Electron)
                  window.setTimeout(() => onApplyTemplate(body), 0)
                }}
              />
            )}
            {activeTab === 'options' && (
              <div className="px-4 py-6 text-center text-sm text-riven-text-secondary">
                Aucune option pour le moment
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
