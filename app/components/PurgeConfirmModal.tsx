'use client'

import Button from './ui/Button'

interface PurgeConfirmModalProps {
  fileName: string
  count?: number
  onCancel: () => void
  onConfirm: () => void
}

export default function PurgeConfirmModal({
  fileName,
  count = 1,
  onCancel,
  onConfirm,
}: PurgeConfirmModalProps) {
  const label =
    count > 1
      ? `Suppressions de « ${count} » fichiers`
      : `Suppression de « ${fileName} »`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-md rounded-riven-lg border border-riven-border bg-riven-card p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-[#E55353]">Suppressions</h2>
        <p className="mt-4 text-base text-riven-text-primary">{label}</p>
        <p className="mt-2 text-sm text-riven-text-secondary">
          Une fois définitivement supprimés, les éléments ne seront plus accessibles.
        </p>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="px-4 py-2">
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-riven bg-[#E55353] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#d44848]"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
