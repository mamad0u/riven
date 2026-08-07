// Enregistrement des raccourcis globaux (toggle sidebar / capture prompt).
// Extrait de main.js — même comportement, aucune logique modifiée.
//
// onToggleSidebar / onCapturePrompt sont injectés car les fonctions
// correspondantes (toggleSidebar, openCapturePrompt) restent dans main.js
// (logique de capture/paste externe, hors scope de cette étape).

function createShortcutsManager({ globalShortcut, onToggleSidebar, onCapturePrompt }) {
  const registeredGlobalShortcuts = {
    toggleSidebar: 'CommandOrControl+Shift+S',
    capturePrompt: 'Alt+Shift+C',
  }

  const toElectronAccel = (accel) =>
    String(accel || '')
      .split('+')
      .map((p) => {
        const t = p.trim()
        if (t.toLowerCase() === 'ctrl') return 'CommandOrControl'
        return t
      })
      .join('+')

  const registerAppGlobalShortcuts = () => {
    try {
      globalShortcut.unregisterAll()
    } catch {
      /* ignore */
    }

    const sidebarAccel = registeredGlobalShortcuts.toggleSidebar || 'CommandOrControl+Shift+S'
    const okSidebar = globalShortcut.register(sidebarAccel, () => {
      onToggleSidebar()
    })
    if (!okSidebar) {
      console.log('Échec enregistrement raccourci sidebar:', sidebarAccel)
    } else {
      console.log('Raccourci sidebar enregistré:', sidebarAccel)
    }

    const captureAccel = registeredGlobalShortcuts.capturePrompt || 'Alt+Shift+C'
    const okCapture = globalShortcut.register(captureAccel, () => {
      console.log('Raccourci Capture prompt reçu:', captureAccel)
      void onCapturePrompt()
    })
    if (!okCapture) {
      console.log('Échec enregistrement raccourci capture:', captureAccel)
    } else {
      console.log('Raccourci capture enregistré:', captureAccel)
    }
  }

  return { registeredGlobalShortcuts, toElectronAccel, registerAppGlobalShortcuts }
}

module.exports = { createShortcutsManager }
