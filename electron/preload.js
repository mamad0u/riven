const { contextBridge, ipcRenderer } = require('electron')

// Exposer une API sécurisée au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  closeSidebar: () => ipcRenderer.send('close-sidebar'),
  toggleSidebar: () => ipcRenderer.send('toggle-sidebar'),
  restoreFocusAndPaste: (content) => ipcRenderer.send('restore-focus-and-paste', content),

  onCapturePrompt: (cb) => {
    const handler = (_event, payload) => cb(payload)
    ipcRenderer.on('capture-prompt', handler)
    return () => ipcRenderer.removeListener('capture-prompt', handler)
  },
  closeCaptureOverlay: () => ipcRenderer.send('capture-overlay-close'),
  openCaptureOverlay: (text) => ipcRenderer.send('open-capture-overlay', text || ''),
  notifyCaptureSaved: () => ipcRenderer.send('capture-saved'),
  openPromptInMain: (file) => ipcRenderer.send('open-prompt-in-main', file),
  onOpenPrompt: (cb) => {
    const handler = (_event, file) => cb(file)
    ipcRenderer.on('open-prompt', handler)
    return () => ipcRenderer.removeListener('open-prompt', handler)
  },
  onPromptsChanged: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('prompts-changed', handler)
    return () => ipcRenderer.removeListener('prompts-changed', handler)
  },

  openFileDialog: () => ipcRenderer.invoke('dialog-open-file'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog-open-directory'),
  getAppVersion: () => ipcRenderer.invoke('app-get-version'),
  setGlobalShortcuts: (payload) => ipcRenderer.invoke('shortcuts-set-globals', payload),

  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window-is-always-on-top'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window-set-always-on-top', flag),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  },

  // Gestion de fichiers
  fileManager: {
    listDirectory: (path) => ipcRenderer.invoke('file-list', path),
    listAllFiles: () => ipcRenderer.invoke('file-list-all'),
    createDirectory: (path, name) => ipcRenderer.invoke('file-create-dir', path, name),
    createFile: (path, name, content) => ipcRenderer.invoke('file-create-file', path, name, content),
    readFile: (path) => ipcRenderer.invoke('file-read', path),
    writeFile: (path, content) => ipcRenderer.invoke('file-write', path, content),
    deleteItem: (path) => ipcRenderer.invoke('file-delete', path),
    renameItem: (path, newName) => ipcRenderer.invoke('file-rename', path, newName),
    moveToTrash: (path) => ipcRenderer.invoke('file-move-to-trash', path),
    listTrash: () => ipcRenderer.invoke('file-list-trash'),
    restoreFromTrash: (id) => ipcRenderer.invoke('file-restore-trash', id),
    purgeTrashItem: (id) => ipcRenderer.invoke('file-purge-trash', id),
    getBasePath: () => ipcRenderer.invoke('file-get-base-path'),
    setBasePath: (nextPath) => ipcRenderer.invoke('file-set-base-path', nextPath),
    importFile: () => ipcRenderer.invoke('file-import'),
    exportFile: (sourcePath) => ipcRenderer.invoke('file-export', sourcePath),
    searchFiles: (query) => ipcRenderer.invoke('file-search', query),
  },
})
