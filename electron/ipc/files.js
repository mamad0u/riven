// Handlers IPC pour la gestion de fichiers (délèguent à fileManager.js).
// Extrait de main.js — même comportement, aucune logique modifiée.

function registerFileIpc({
  ipcMain,
  fileManager,
  path,
  fs,
  dialog,
  BrowserWindow,
  getMainWindow,
  loadAppConfig,
  saveAppConfig,
}) {
  console.log('Enregistrement des handlers IPC pour la gestion de fichiers...')

  ipcMain.handle('file-list', async (event, filePath) => {
    try {
      console.log('Handler file-list appelé avec path:', filePath)
      return await fileManager.listDirectory(filePath)
    } catch (error) {
      console.error('Erreur dans file-list:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('file-list-all', async () => {
    try {
      return await fileManager.listAllFiles()
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-create-dir', async (event, filePath, name) => {
    try {
      return await fileManager.createDirectory(filePath, name)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-create-file', async (event, filePath, name, content) => {
    try {
      return await fileManager.createFile(filePath, name, content)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-read', async (event, filePath) => {
    try {
      return await fileManager.readFile(filePath)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-write', async (event, filePath, content) => {
    try {
      return await fileManager.writeFile(filePath, content)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-delete', async (event, filePath) => {
    try {
      return await fileManager.deleteItem(filePath)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-rename', async (event, filePath, newName) => {
    try {
      return await fileManager.renameItem(filePath, newName)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-move-to-trash', async (event, filePath) => {
    try {
      return await fileManager.moveToTrash(filePath)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-list-trash', async () => {
    try {
      return await fileManager.listTrash()
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-restore-trash', async (event, id) => {
    try {
      return await fileManager.restoreFromTrash(id)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-purge-trash', async (event, id) => {
    try {
      return await fileManager.purgeTrashItem(id)
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-get-base-path', async () => {
    return fileManager.getBasePath()
  })

  ipcMain.handle('file-search', async (event, query) => {
    try {
      return await fileManager.searchFiles(query)
    } catch (error) {
      return { error: error.message, items: [] }
    }
  })

  ipcMain.handle('file-set-base-path', async (_event, nextPath) => {
    try {
      const resolved = fileManager.setBasePath(nextPath)
      const config = loadAppConfig()
      config.basePath = resolved
      saveAppConfig(config)
      await fileManager.initializeBaseDirectory()
      return { success: true, path: resolved }
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-import', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() || getMainWindow()
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          { name: 'Textes / Markdown', extensions: ['md', 'txt', 'markdown'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { error: 'cancelled' }
      }
      return await fileManager.importExternalFile(result.filePaths[0])
    } catch (error) {
      return { error: error.message }
    }
  })

  ipcMain.handle('file-export', async (_event, sourcePath) => {
    try {
      if (!sourcePath) return { error: 'Sélectionnez un fichier' }
      const read = await fileManager.readFile(sourcePath)
      if (read.error) return { error: read.error }
      const win = BrowserWindow.getFocusedWindow() || getMainWindow()
      const baseName = path.basename(sourcePath)
      const result = await dialog.showSaveDialog(win, {
        defaultPath: baseName,
      })
      if (result.canceled || !result.filePath) {
        return { error: 'cancelled' }
      }
      fs.writeFileSync(result.filePath, read.content ?? '', 'utf8')
      return { success: true, path: result.filePath }
    } catch (error) {
      return { error: error.message }
    }
  })
}

module.exports = { registerFileIpc }
