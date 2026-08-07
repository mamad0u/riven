'use client'

import { Tab } from '../hooks/useEditorTabs'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose }: TabBarProps) {
  return (
    <div className="app-no-drag flex min-w-0 flex-1 items-center overflow-x-auto pl-6">
      {tabs.map((tab, index) => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`group relative flex h-7 min-w-0 max-w-[16rem] shrink-0 cursor-pointer items-center gap-2 pr-2.5 transition-colors ${
              index === 0 ? 'pl-0' : 'pl-2.5'
            } ${
              active
                ? 'text-riven-text-primary hover:text-riven-accent'
                : 'text-riven-text-secondary hover:text-[#B0B3BA]'
            }`}
          >
            <span className="truncate text-base leading-none">
              {tab.fileName.replace(/\.[^.]+$/, '')}
              {tab.hasUnsavedChanges && <span className="ml-1 text-riven-accent">•</span>}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              className="shrink-0 text-[#6B6E75] opacity-0 transition-opacity hover:text-riven-text-secondary group-hover:opacity-100"
              title="Fermer"
            >
              ×
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-1/2 h-6 w-px -translate-y-1/2 bg-[#3A3D42]"
            />
          </div>
        )
      })}
    </div>
  )
}
