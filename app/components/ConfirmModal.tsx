'use client'

import Button from './ui/Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Remplacer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="app-no-drag fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div
        className="mx-4 w-full max-w-md rounded-riven-lg border border-riven-border bg-riven-card p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-riven-text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm text-riven-text-secondary">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
