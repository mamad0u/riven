'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
  /** Contenu injecté juste avant l’item avec cet id */
  insertBeforeId?: string
  insertContent?: ReactNode
}

export default function ContextMenu({
  x,
  y,
  items,
  onSelect,
  onClose,
  insertBeforeId,
  insertContent,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad
    if (left < pad) left = pad
    if (top < pad) top = pad
    ref.current.style.left = `${left}px`
    ref.current.style.top = `${top}px`
  }, [x, y, items, insertContent, insertBeforeId])

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] rounded-riven border border-riven-border bg-riven-card py-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item) => {
        const before =
          insertContent && insertBeforeId && item.id === insertBeforeId ? (
            <div key={`${item.id}-insert`}>
              <div className="my-1 border-t border-riven-border" />
              {insertContent}
              <div className="my-1 border-t border-riven-border" />
            </div>
          ) : null

        if (item.separator) {
          return (
            <div key={item.id}>
              {before}
              <div className="my-1 border-t border-riven-border" />
            </div>
          )
        }

        return (
          <div key={item.id}>
            {before}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`block w-full px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40 ${
                item.danger
                  ? 'text-red-400 hover:bg-riven-selected'
                  : 'text-riven-text-primary hover:bg-riven-selected'
              }`}
              onClick={() => {
                if (item.disabled) return
                onSelect(item.id)
                onClose()
              }}
            >
              {item.label}
            </button>
          </div>
        )
      })}
    </div>
  )
}
