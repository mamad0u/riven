import { FileItem } from '../../electron.d'

export interface PromptItem {
  file: FileItem
  title: string
  modified: Date
  tags: { label: string; variant: 'green' | 'purple' }[]
}

export function fileToPromptItem(
  file: FileItem,
  index: number,
  getTags: (path: string, index: number) => { label: string; variant: 'green' | 'purple' }[]
): PromptItem {
  return {
    file,
    title: file.name.replace(/\.[^.]+$/, ''),
    modified: new Date(file.modified),
    tags: getTags(file.path, index),
  }
}

export function sortByRecent(items: PromptItem[]): PromptItem[] {
  return [...items].sort((a, b) => b.modified.getTime() - a.modified.getTime())
}
