'use client'

import { useEffect, useRef } from 'react'

interface InlineRenameProps {
  value: string
  onSubmit: (value: string) => void
  onCancel: () => void
  className?: string
}

export default function InlineRename({ value, onSubmit, onCancel, className = '' }: InlineRenameProps) {
  const ref = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Double rAF : évite le blur immédiat sous Electron (app-drag / remount)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.focus()
        el.select()
      })
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const finish = (fn: () => void) => {
    if (doneRef.current) return
    doneRef.current = true
    fn()
  }

  return (
    <input
      ref={ref}
      defaultValue={value}
      className={`app-no-drag w-full rounded-riven border border-riven-accent bg-riven-main px-1 py-0.5 text-sm text-riven-text-primary outline-none ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(() => onSubmit(ref.current?.value.trim() || value))
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          finish(() => onCancel())
        }
      }}
      onBlur={() => {
        // Valider au blur au lieu d'annuler (sinon un vol de focus = impossible de renommer)
        finish(() => onSubmit(ref.current?.value.trim() || value))
      }}
    />
  )
}
