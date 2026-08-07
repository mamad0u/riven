'use client'

import { useState, FormEvent, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Search } from 'lucide-react'

interface SearchBarProps {
  onSearch?: (query: string) => void
  onInputChange?: (query: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Contenu contrôlé optionnel */
  value?: string
  /** pill = barre seule ; embedded = ligne dans un panel */
  variant?: 'pill' | 'embedded'
}

export interface SearchBarRef {
  focus: () => void
}

const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(({
  onSearch,
  onInputChange,
  placeholder = 'Search prompts...',
  className = '',
  autoFocus = false,
  value,
  variant = 'pill',
}, ref) => {
  const [internalQuery, setInternalQuery] = useState('')
  const query = value !== undefined ? value : internalQuery
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim() && onSearch) onSearch(query.trim())
  }

  const handleChange = (next: string) => {
    if (value === undefined) setInternalQuery(next)
    onInputChange?.(next)
  }

  const shellClass =
    variant === 'pill'
      ? 'riven-glass rounded-full shadow-lg'
      : 'border-0 bg-transparent'

  return (
    <form onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <div
        className={`relative flex items-center transition-colors focus-within:border-white/20 ${shellClass} ${
          variant === 'pill' ? '' : 'rounded-none'
        }`}
      >
        <div className="pl-4">
          <Search className="h-4 w-4 text-riven-text-secondary" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="app-no-drag flex-1 bg-transparent py-3.5 pr-4 pl-2.5 text-sm text-riven-text-primary placeholder:text-riven-text-secondary focus:outline-none"
          aria-label={placeholder}
        />
        {query && (
          <button
            type="button"
            onClick={() => handleChange('')}
            className="app-no-drag mr-3 text-riven-text-secondary hover:text-riven-text-primary"
            aria-label="Effacer"
          >
            ×
          </button>
        )}
      </div>
    </form>
  )
})

SearchBar.displayName = 'SearchBar'

export default SearchBar
