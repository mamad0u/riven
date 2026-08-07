/** Couleurs de dossiers (hex), stockées dans les métadonnées par chemin. */

import { getPromptMetadata, setPromptMetadata } from './promptMetadata'

export const FOLDER_BASE_COLORS = [
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#60A5FA', // blue
  '#A78BFA', // purple
] as const

const FALLBACK_COLORS = [...FOLDER_BASE_COLORS]

function colorIndexFromPath(path: string): number {
  let h = 0
  const s = normalizeFolderPath(path)
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function normalizeFolderPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function parentFolderPath(filePath: string): string | null {
  const parts = normalizeFolderPath(filePath).split('/').filter(Boolean)
  if (parts.length < 2) return null
  return parts.slice(0, -1).join('/')
}

export function dossierNameFromPath(filePath: string): string {
  const parts = normalizeFolderPath(filePath).split('/').filter(Boolean)
  if (parts.length < 2) return ''
  return parts[parts.length - 2]
}

export function getFolderColor(folderPath: string): string | null {
  const color = getPromptMetadata(normalizeFolderPath(folderPath)).folderColor
  return color || null
}

export function setFolderColor(folderPath: string, color: string | null): void {
  setPromptMetadata(normalizeFolderPath(folderPath), {
    folderColor: color || '',
  })
}

/** Couleur du dossier parent (explicite, sinon premier ancêtre coloré, sinon fallback stable). */
export function resolveFolderColorForFile(filePath: string): string | null {
  const parts = normalizeFolderPath(filePath).split('/').filter(Boolean)
  if (parts.length < 2) return null
  for (let i = parts.length - 1; i >= 1; i--) {
    const folderPath = parts.slice(0, i).join('/')
    const color = getFolderColor(folderPath)
    if (color) return color
  }
  const parent = parts.slice(0, -1).join('/')
  return fallbackFolderColor(colorIndexFromPath(parent))
}

/** Fallback cosmétique stable par chemin si aucune couleur choisie. */
export function fallbackFolderColor(index: number): string {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

export function resolveFolderColor(folderPath: string, _fallbackIndex = 0): string {
  const path = normalizeFolderPath(folderPath)
  return getFolderColor(path) ?? fallbackFolderColor(colorIndexFromPath(path))
}
