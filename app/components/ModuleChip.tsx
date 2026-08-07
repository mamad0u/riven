'use client'

import { getModuleMeta, type ModuleType } from './ModuleMenu'

interface ModuleChipProps {
  type: ModuleType | string
  label?: string
}

export default function ModuleChip({ type, label: labelProp }: ModuleChipProps) {
  const meta = getModuleMeta(type)
  if (!meta) return null
  const Icon = meta.icon
  const label = labelProp || meta.label

  return (
    <span
      contentEditable={false}
      data-module={type}
      className="module-chip mx-0.5 inline-flex max-w-full items-center gap-1.5 align-middle rounded-riven border border-riven-border bg-riven-card px-2 py-0.5 text-xs text-riven-text-primary select-none"
      suppressContentEditableWarning
    >
      {meta.iconSide === 'left' && <Icon className="h-3 w-3 shrink-0 text-riven-text-secondary" />}
      <span className="truncate">{label}</span>
      {meta.iconSide === 'right' && <Icon className="h-3 w-3 shrink-0 text-riven-text-secondary" />}
    </span>
  )
}

/** Build chip HTML for contenteditable (no React mount inside editor). */
export function moduleChipHtml(type: string, opts?: { variableId?: string; label?: string }): string {
  const meta = getModuleMeta(type)
  const label =
    type === 'variable' ? opts?.label || opts?.variableId || meta?.label || type : meta?.label || type
  const side = meta?.iconSide ?? 'left'
  const icon =
    type === 'texte'
      ? '✎'
      : type === 'variable'
        ? '⇄'
        : type === 'nombre'
          ? '#'
          : '📄'
  const iconHtml = `<span class="module-chip-icon" aria-hidden="true">${icon}</span>`
  const labelHtml = `<span class="module-chip-label">${escapeHtml(label)}</span>`
  const inner = side === 'right' ? `${labelHtml}${iconHtml}` : `${iconHtml}${labelHtml}`

  const varAttrs =
    type === 'variable' && opts?.variableId
      ? ` data-var-id="${escapeAttr(opts.variableId)}"`
      : ''

  return `<span contenteditable="false" data-module="${escapeAttr(type)}"${varAttrs} class="module-chip">${inner}</span>`
}

export function updateVariableChipLabel(el: HTMLElement, label: string): void {
  const labelEl = el.querySelector('.module-chip-label')
  if (labelEl) labelEl.textContent = label
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}
