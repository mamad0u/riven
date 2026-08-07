'use client'

import { useCallback, useEffect, useState } from 'react'
import SavePromptModal from '../components/SavePromptModal'
import SavePromptToast from '../components/SavePromptToast'

export default function CapturePage() {
  const [ready, setReady] = useState(false)
  const [content, setContent] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    setReady(true)
    return () => {
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onCapturePrompt) return
    return window.electronAPI.onCapturePrompt(({ text }) => {
      setContent(text ?? '')
      setShowToast(false)
      setShowModal(true)
    })
  }, [])

  const closeOverlay = useCallback(() => {
    setShowModal(false)
    setShowToast(false)
    window.electronAPI?.closeCaptureOverlay?.()
  }, [])

  const handleCancel = useCallback(() => {
    setShowModal(false)
    window.electronAPI?.closeCaptureOverlay?.()
  }, [])

  const handleSaved = useCallback(() => {
    setShowModal(false)
    setShowToast(true)
    window.electronAPI?.notifyCaptureSaved?.()
  }, [])

  const handleToastHide = useCallback(() => {
    setShowToast(false)
    window.electronAPI?.closeCaptureOverlay?.()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showToast) {
        e.preventDefault()
        handleCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCancel, showToast])

  if (!ready) return null

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      {showModal && (
        <SavePromptModal
          content={content}
          onCancel={handleCancel}
          onSaved={handleSaved}
        />
      )}
      <SavePromptToast visible={showToast} onHide={handleToastHide} />
      {!showModal && !showToast && (
        <button type="button" className="sr-only" onClick={closeOverlay} aria-hidden>
          close
        </button>
      )}
    </div>
  )
}
