'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  TEMPLATE_CATEGORIES,
  searchTemplates,
  getTemplateById,
  type PromptTemplate,
  type TemplateCategoryId,
} from '../lib/promptTemplates'

interface TemplateMenuProps {
  searchQuery?: string
  onSelect: (template: PromptTemplate) => void
}

export default function TemplateMenu({ searchQuery = '', onSelect }: TemplateMenuProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<TemplateCategoryId | null>(null)
  const q = searchQuery.trim()

  if (q) {
    const results = searchTemplates(q)
    return (
      <div className="max-h-72 overflow-y-auto py-1">
        <p className="px-3 py-1.5 text-xs text-riven-text-secondary">Templates</p>
        {results.length === 0 ? (
          <p className="px-3 py-2 text-xs text-riven-text-secondary">Aucun résultat</p>
        ) : (
          results.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className="mx-2 mb-0.5 block w-[calc(100%-1rem)] rounded-riven border border-transparent px-3 py-2 text-left transition-colors hover:border-riven-border hover:bg-riven-selected"
            >
              <span className="block text-sm text-riven-text-primary">{t.label}</span>
              <span className="block truncate text-xs text-riven-text-secondary">{t.description}</span>
            </button>
          ))
        )}
      </div>
    )
  }

  if (!selectedCategoryId) {
    return (
      <div className="max-h-72 overflow-y-auto py-1">
        <p className="px-3 py-1.5 text-xs text-riven-text-secondary">Catégories</p>
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategoryId(cat.id)}
            className="mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center justify-between rounded-riven border border-transparent px-3 py-2 text-left text-sm text-riven-text-primary transition-colors hover:border-riven-border hover:bg-riven-selected"
          >
            <span>{cat.label}</span>
            <span className="text-xs text-riven-text-secondary">{cat.children.length}</span>
          </button>
        ))}
      </div>
    )
  }

  const category = TEMPLATE_CATEGORIES.find((c) => c.id === selectedCategoryId)
  if (!category) return null

  return (
    <div className="max-h-72 overflow-y-auto py-1">
      <button
        type="button"
        onClick={() => setSelectedCategoryId(null)}
        className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-riven-text-secondary hover:text-riven-text-primary"
      >
        <ChevronLeft className="h-3 w-3" />
        {category.label}
      </button>
      {category.children.map((child) => {
        const template = getTemplateById(child.templateId)
        if (!template) return null
        return (
          <button
            key={child.id}
            type="button"
            onClick={() => onSelect(template)}
            className="mx-2 mb-0.5 block w-[calc(100%-1rem)] rounded-riven border border-transparent px-3 py-2 text-left transition-colors hover:border-riven-border hover:bg-riven-selected"
          >
            <span className="block text-sm text-riven-text-primary">{template.label}</span>
            <span className="block truncate text-xs text-riven-text-secondary">
              {template.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
