'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

type FabState = 'base' | 'hover' | 'active' | 'disabled'

interface FloatingActionButtonProps {
  isOpen: boolean
  disabled?: boolean
  onClick: () => void
}

export default function FloatingActionButton({ isOpen, disabled = false, onClick }: FloatingActionButtonProps) {
  const [hovered, setHovered] = useState(false)

  let state: FabState = 'base'
  if (disabled) state = 'disabled'
  else if (isOpen) state = 'active'
  else if (hovered) state = 'hover'

  const stateClasses: Record<FabState, string> = {
    base: 'border-riven-border text-riven-text-primary',
    hover: 'border-riven-accent text-riven-text-primary',
    active: 'border-riven-accent bg-riven-selected text-riven-accent',
    disabled: 'border-riven-border text-riven-text-secondary opacity-40 cursor-not-allowed',
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-riven border-2 bg-riven-card shadow-lg transition-colors ${stateClasses[state]}`}
      title={isOpen ? 'Fermer' : 'Ajouter un module'}
    >
      {isOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
    </button>
  )
}
