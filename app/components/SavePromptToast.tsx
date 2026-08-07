'use client'

import { useEffect } from 'react'

interface SavePromptToastProps {
  visible: boolean
  onHide: () => void
  message?: string
}

export default function SavePromptToast({
  visible,
  onHide,
  message = 'Prompt sauvegarder !',
}: SavePromptToastProps) {
  useEffect(() => {
    if (!visible) return
    const t = window.setTimeout(onHide, 2200)
    return () => window.clearTimeout(t)
  }, [visible, onHide])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center pb-16 animate-fade-in">
      <div
        className="px-8 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{
          backgroundColor: '#2B2B2F',
          borderRadius: 9999,
        }}
      >
        {message}
      </div>
    </div>
  )
}
