// Types pour l'API Electron exposée via preload.js

export interface FileItem {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  isFile: boolean
  size: number
  created: Date
  modified: Date
}

export interface DirectoryListing {
  path: string
  items: FileItem[]
}

export interface TrashItem {
  id: string
  name: string
  originalPath: string
  deletedAt: string
  isDirectory: boolean
}

export interface FileManagerAPI {
  listDirectory: (path?: string | null) => Promise<DirectoryListing | { error: string }>
  listAllFiles: () => Promise<{ items: FileItem[] } | { error: string }>
  createDirectory: (path: string | null, name: string) => Promise<{ success: boolean; path: string } | { error: string }>
  createFile: (path: string | null, name: string, content?: string) => Promise<{ success: boolean; path: string } | { error: string }>
  readFile: (path: string) => Promise<{ success: boolean; content: string } | { error: string }>
  writeFile: (path: string, content: string) => Promise<{ success: boolean } | { error: string }>
  deleteItem: (path: string) => Promise<{ success: boolean } | { error: string }>
  renameItem: (path: string, newName: string) => Promise<{ success: boolean; newPath: string } | { error: string }>
  moveToTrash: (path: string) => Promise<{ success: true; id: string } | { error: string }>
  listTrash: () => Promise<{ items: TrashItem[] } | { error: string }>
  restoreFromTrash: (id: string) => Promise<{ success: true; restoredPath: string } | { error: string }>
  purgeTrashItem: (id: string) => Promise<{ success: true } | { error: string }>
  getBasePath: () => Promise<string>
  setBasePath: (nextPath: string) => Promise<{ success: true; path: string } | { error: string }>
  importFile: () => Promise<
    | { success: true; path: string; fullPath: string; name: string }
    | { error: string }
  >
  exportFile: (sourcePath: string) => Promise<{ success: true; path: string } | { error: string }>
  searchFiles: (query: string) => Promise<{ items: FileItem[] } | { error: string; items: [] }>
}

export interface ElectronAPI {
  closeSidebar: () => void
  toggleSidebar: () => void
  restoreFocusAndPaste: (content: string) => void
  onCapturePrompt: (cb: (payload: { text: string }) => void) => () => void
  closeCaptureOverlay: () => void
  openCaptureOverlay: (text?: string) => void
  notifyCaptureSaved: () => void
  openPromptInMain: (file: FileItem) => void
  onOpenPrompt: (cb: (file: FileItem) => void) => () => void
  onPromptsChanged: (cb: () => void) => () => void
  openFileDialog: () => Promise<{ path: string } | { error: string }>
  openDirectoryDialog: () => Promise<{ path: string } | { error: string }>
  getAppVersion: () => Promise<string>
  setGlobalShortcuts: (payload: {
    toggleSidebar?: string
    capturePrompt?: string
  }) => Promise<{ success: true; shortcuts: Record<string, string> } | { error: string }>
  windowControls: {
    minimize: () => void
    maximizeToggle: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    isAlwaysOnTop: () => Promise<boolean>
    setAlwaysOnTop: (flag: boolean) => Promise<boolean>
    toggleAlwaysOnTop: () => Promise<boolean>
  }
  fileManager: FileManagerAPI
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
