import type { FileItem } from '../../electron.d'

export const RIVEN_FILE_DRAG_MIME = 'application/x-riven-file'

export function setFileDragData(dataTransfer: DataTransfer, file: FileItem) {
  dataTransfer.setData(RIVEN_FILE_DRAG_MIME, JSON.stringify(file))
  dataTransfer.effectAllowed = 'copy'
}

export function parseFileDragData(dataTransfer: DataTransfer): FileItem | null {
  const raw = dataTransfer.getData(RIVEN_FILE_DRAG_MIME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as FileItem
    if (!parsed || typeof parsed.path !== 'string' || !parsed.isFile) return null
    return parsed
  } catch {
    return null
  }
}

export function isRivenFileDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(RIVEN_FILE_DRAG_MIME)
}
