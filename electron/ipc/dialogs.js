// Handlers IPC pour les dialogs natifs (ouverture fichier / dossier).
// Extrait de main.js — même comportement, aucune logique modifiée.

function registerDialogIpc({ ipcMain, dialog, BrowserWindow, getMainWindow }) {
  ipcMain.handle('dialog-open-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { error: 'cancelled' }
    }
    return { path: result.filePaths[0] }
  })

  ipcMain.handle('dialog-open-directory', async () => {
    const win = BrowserWindow.getFocusedWindow() || getMainWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { error: 'cancelled' }
    }
    return { path: result.filePaths[0] }
  })
}

module.exports = { registerDialogIpc }
