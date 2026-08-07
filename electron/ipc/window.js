// Handlers IPC generiques de controle de fenetre (minimize/maximize/close,
// always-on-top), appliques a la fenetre qui a envoye le message.
// Extrait de main.js — même comportement, aucune logique modifiée.

function registerWindowIpc({ ipcMain, BrowserWindow }) {
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })

  ipcMain.on('window-maximize-toggle', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  ipcMain.handle('window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window-is-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isAlwaysOnTop() ?? false
  })

  ipcMain.handle('window-set-always-on-top', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (flag) {
      // Au-dessus de presque toutes les fenêtres (popup de capture)
      win.setAlwaysOnTop(true, 'pop-up-menu')
    } else {
      win.setAlwaysOnTop(false)
    }
    return win.isAlwaysOnTop()
  })

  ipcMain.handle('window-toggle-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    const next = !win.isAlwaysOnTop()
    win.setAlwaysOnTop(next)
    return next
  })
}

module.exports = { registerWindowIpc }
