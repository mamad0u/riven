// Handlers IPC divers liés à l'app (version, raccourcis globaux).
// Extrait de main.js — même comportement, aucune logique modifiée.

function registerAppIpc({
  ipcMain,
  app,
  registeredGlobalShortcuts,
  toElectronAccel,
  loadAppConfig,
  saveAppConfig,
  registerAppGlobalShortcuts,
}) {
  ipcMain.handle('app-get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('shortcuts-set-globals', (_event, payload) => {
    try {
      if (payload?.toggleSidebar) {
        registeredGlobalShortcuts.toggleSidebar = toElectronAccel(payload.toggleSidebar)
      }
      if (payload?.capturePrompt) {
        registeredGlobalShortcuts.capturePrompt = toElectronAccel(payload.capturePrompt)
      }
      const config = loadAppConfig()
      config.globalShortcuts = { ...registeredGlobalShortcuts }
      saveAppConfig(config)
      registerAppGlobalShortcuts()
      return { success: true, shortcuts: registeredGlobalShortcuts }
    } catch (error) {
      return { error: error.message }
    }
  })
}

module.exports = { registerAppIpc }
