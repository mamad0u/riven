'use client'

import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

export default function WindowControls() {
  const [ready, setReady] = useState(false)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!window.electronAPI?.windowControls) return
    setReady(true)
    let cancelled = false
    ;(async () => {
      const value = await window.electronAPI!.windowControls.isMaximized()
      if (!cancelled) setMaximized(value)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // SSR + premier rendu client : rien (évite le mismatch d'hydratation)
  if (!ready) {
    return <div className="app-no-drag h-full w-[8.25rem] shrink-0" aria-hidden />
  }

  const controls = window.electronAPI!.windowControls

  return (
    <div className="app-no-drag flex h-full shrink-0 items-stretch">
      <button
        type="button"
        title="Réduire"
        onClick={() => controls.minimize()}
        className="flex w-11 items-center justify-center text-riven-text-secondary transition-colors hover:bg-riven-card hover:text-riven-text-primary"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        title={maximized ? 'Restaurer' : 'Agrandir'}
        onClick={async () => {
          controls.maximizeToggle()
          const next = await controls.isMaximized()
          setMaximized(next)
        }}
        className="flex w-11 items-center justify-center text-riven-text-secondary transition-colors hover:bg-riven-card hover:text-riven-text-primary"
      >
        {maximized ? (
          <Copy className="h-3 w-3 -scale-x-100" strokeWidth={1.75} />
        ) : (
          <Square className="h-3 w-3" strokeWidth={1.75} />
        )}
      </button>
      <button
        type="button"
        title="Fermer"
        onClick={() => controls.close()}
        className="flex w-11 items-center justify-center text-riven-text-secondary transition-colors hover:bg-red-500/90 hover:text-white"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}
