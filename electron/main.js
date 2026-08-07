const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, dialog, clipboard } = require('electron')
const path = require('path')
const { exec, execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Importer le gestionnaire de fichiers
const fileManager = require('./fileManager')
const {
  captureSelectedTextWithTimeout,
} = require('./captureSelection')
const { registerFileIpc } = require('./ipc/files')
const { registerDialogIpc } = require('./ipc/dialogs')
const { registerAppIpc } = require('./ipc/app')
const { createConfigStore } = require('./config')
const { createShortcutsManager } = require('./shortcuts')
const {
  createMainWindow,
  createSidebarWindowInstance,
  createCaptureWindowInstance,
} = require('./windows')
const { createAppTray } = require('./tray')
const { createNativePaste } = require('./nativePaste')

let mainWindow = null
let sidebarWindow = null
let captureWindow = null
let tray = null

// Partagé par référence avec nativePaste.js (mutation en place uniquement,
// jamais de réassignation — voir la note dans nativePaste.js).
const focusState = {
  lastFocusedWindow: null, // Fenêtre Electron qui avait le focus avant d'ouvrir la sidebar
  lastActiveElementInfo: null, // Informations sur l'élément actif avant d'ouvrir la sidebar
  lastActiveWindowHandle: null, // Handle de la fenêtre système active (pour restaurer le focus)
}

const { loadAppConfig, saveAppConfig } = createConfigStore({ app, path, fs })

const applyStoredBasePath = () => {
  const config = loadAppConfig()
  if (config.basePath) {
    try {
      fileManager.setBasePath(config.basePath)
    } catch (err) {
      console.error('Base path config invalide, défaut utilisé:', err.message)
    }
  }
}

const { registeredGlobalShortcuts, toElectronAccel, registerAppGlobalShortcuts } =
  createShortcutsManager({
    globalShortcut,
    onToggleSidebar: () => toggleSidebar(),
    onCapturePrompt: () => openCapturePrompt(),
  })

const createWindow = () => {
  mainWindow = createMainWindow({ BrowserWindow, path, isDev, app })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Créer la fenêtre sidebar flottante
const createSidebarWindow = () => {
  if (sidebarWindow) {
    return sidebarWindow
  }

  const { screen } = require('electron')
  sidebarWindow = createSidebarWindowInstance({ BrowserWindow, screen, path, isDev })

  // Gérer la fermeture
  sidebarWindow.on('closed', () => {
    sidebarWindow = null
  })

  return sidebarWindow
}

// Fenêtre flottante détachée pour Quick Prompt Save (indépendante de l'app principale)
const createCaptureWindow = () => {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindow
  }

  const { screen } = require('electron')
  captureWindow = createCaptureWindowInstance({ BrowserWindow, screen, path, isDev })

  captureWindow.on('closed', () => {
    captureWindow = null
  })

  return captureWindow
}

const showCaptureOverlay = (text) => {
  const win = createCaptureWindow()
  if (!win) return

  const send = () => {
    win.webContents.send('capture-prompt', { text: text || '' })
  }

  const reveal = () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setOpacity(0)
    win.show()
    win.focus()
    send()

    let opacity = 0
    const fadeIn = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(fadeIn)
        return
      }
      opacity += 0.08
      if (opacity >= 1) {
        opacity = 1
        clearInterval(fadeIn)
      }
      win.setOpacity(opacity)
    }, 16)
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', reveal)
  } else {
    reveal()
  }
}

const hideCaptureOverlay = () => {
  if (!captureWindow || captureWindow.isDestroyed() || !captureWindow.isVisible()) return

  let opacity = captureWindow.getOpacity()
  if (opacity <= 0) {
    captureWindow.hide()
    captureWindow.setOpacity(0)
    return
  }

  const fadeOut = setInterval(() => {
    if (!captureWindow || captureWindow.isDestroyed()) {
      clearInterval(fadeOut)
      return
    }
    opacity -= 0.1
    if (opacity <= 0) {
      opacity = 0
      clearInterval(fadeOut)
      captureWindow.hide()
      captureWindow.setOpacity(0)
      return
    }
    captureWindow.setOpacity(opacity)
  }, 16)
}

// Logique native win32 (capture/restauration de focus, collage externe) et
// handler restore-focus-and-paste : voir electron/nativePaste.js
const { restoreActiveWindow, getForegroundWindowHandleSync, findElectronWindowByHwnd } =
  createNativePaste({
    exec,
    execSync,
    fs,
    path,
    os,
    ipcMain,
    focusState,
    getMainWindow: () => mainWindow,
    getSidebarWindow: () => sidebarWindow,
    getCaptureWindow: () => captureWindow,
  })

const openCapturePrompt = async () => {
  console.log('→ openCapturePrompt déclenché')

  // Capture AVANT d'afficher l'overlay (sinon on vole le focus trop tôt)
  let text = ''
  try {
    text = (await captureSelectedTextWithTimeout(findElectronWindowByHwnd, 900)) || ''
  } catch (e) {
    console.error('Erreur captureSelectedText:', e.message)
    text = clipboard.readText() || ''
  }
  console.log('→ texte capturé (longueur):', text.length)

  // Popup détachée — ne PAS remonter la fenêtre principale
  showCaptureOverlay(text)
}

// Fonction pour afficher/masquer la sidebar
const toggleSidebar = () => {
  if (!sidebarWindow) {
    createSidebarWindow()
  }
  
  if (sidebarWindow) {
    if (sidebarWindow.isVisible()) {
      // Animation de disparition
      let opacity = 1
      const fadeOut = setInterval(() => {
        opacity -= 0.05
        if (opacity <= 0) {
          opacity = 0
          clearInterval(fadeOut)
          sidebarWindow.hide()
          // Restaurer le focus sur la fenêtre système sauvegardée
          restoreActiveWindow()
        }
        sidebarWindow.setOpacity(opacity)
      }, 16) // ~60fps
    } else {
      // Capturer le HWND de façon SYNCHRONE avant que l'overlay prenne le focus
      // (saveActiveWindow() était async → la fenêtre active pouvait déjà être Electron)
      const handle = getForegroundWindowHandleSync()
      if (handle && handle !== 0) {
        focusState.lastActiveWindowHandle = handle
      }

      // Sauvegarder la fenêtre Electron qui avait le focus et l'élément actif
      focusState.lastFocusedWindow = BrowserWindow.getFocusedWindow()
      
      // Si une fenêtre Electron avait le focus, sauvegarder l'élément actif
      if (focusState.lastFocusedWindow && !focusState.lastFocusedWindow.isDestroyed()) {
        focusState.lastFocusedWindow.webContents.executeJavaScript(`
          (function() {
            const activeElement = document.activeElement;
            if (activeElement && (
              activeElement.tagName === 'INPUT' || 
              activeElement.tagName === 'TEXTAREA' ||
              activeElement.isContentEditable
            )) {
              // Sauvegarder les informations de l'élément actif
              return {
                tagName: activeElement.tagName,
                id: activeElement.id || '',
                className: activeElement.className || '',
                name: activeElement.name || '',
                type: activeElement.type || '',
                isContentEditable: activeElement.isContentEditable || false
              };
            }
            return null;
          })();
        `).then((info) => {
          focusState.lastActiveElementInfo = info
          console.log('Élément actif sauvegardé:', info)
        }).catch(() => {
          focusState.lastActiveElementInfo = null
        })
      }
      
      // S'assurer que le contenu est chargé
      if (sidebarWindow.webContents.isLoading()) {
        sidebarWindow.webContents.once('did-finish-load', () => {
          showSidebarWithAnimation()
        })
      } else {
        showSidebarWithAnimation()
      }
    }
  }
}

// Fonction pour afficher la sidebar avec animation
const showSidebarWithAnimation = () => {
  if (!sidebarWindow) return
  
  sidebarWindow.setOpacity(0)
  sidebarWindow.show()
  sidebarWindow.focus()
  
  // Animation d'apparition progressive
  let opacity = 0
  const fadeIn = setInterval(() => {
    opacity += 0.05
    if (opacity >= 1) {
      opacity = 1
      clearInterval(fadeIn)
      // Focus sur l'input de recherche après l'animation
      sidebarWindow.webContents.executeJavaScript(`
        (function() {
          const input = document.querySelector('input[type="text"]');
          if (input) {
            setTimeout(() => input.focus(), 100);
          }
        })();
      `).catch(() => {})
    }
    sidebarWindow.setOpacity(opacity)
  }, 16) // ~60fps
}

// Gérer les messages IPC depuis le renderer
ipcMain.on('close-sidebar', () => {
  if (sidebarWindow && sidebarWindow.isVisible()) {
    // Animation de disparition
    let opacity = 1
    const fadeOut = setInterval(() => {
      opacity -= 0.05
      if (opacity <= 0) {
        opacity = 0
        clearInterval(fadeOut)
        sidebarWindow.hide()
        // Ne pas restaurer le focus ici, c'est fait dans restore-focus-and-paste
        // pour éviter les conflits et avoir un meilleur contrôle du timing
      }
      sidebarWindow.setOpacity(opacity)
    }, 16) // ~60fps
  } else if (sidebarWindow) {
    sidebarWindow.hide()
    // Ne pas restaurer le focus ici non plus
  }
})

ipcMain.on('toggle-sidebar', () => {
  toggleSidebar()
})

ipcMain.on('capture-overlay-close', () => {
  hideCaptureOverlay()
})

ipcMain.on('open-capture-overlay', (_event, text) => {
  showCaptureOverlay(typeof text === 'string' ? text : '')
})

ipcMain.on('capture-saved', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('prompts-changed')
  }
})

ipcMain.on('open-prompt-in-main', (_event, file) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  }
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  const send = () => mainWindow.webContents.send('open-prompt', file)
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send)
  } else {
    send()
  }
})

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

// Handlers pour la gestion de fichiers, dialogs et app (extraits dans electron/ipc/*.js)
// S'assurer que les handlers sont enregistrés avant app.whenReady()
registerFileIpc({
  ipcMain,
  fileManager,
  path,
  fs,
  dialog,
  BrowserWindow,
  getMainWindow: () => mainWindow,
  loadAppConfig,
  saveAppConfig,
})

registerDialogIpc({
  ipcMain,
  dialog,
  BrowserWindow,
  getMainWindow: () => mainWindow,
})

registerAppIpc({
  ipcMain,
  app,
  registeredGlobalShortcuts,
  toElectronAccel,
  loadAppConfig,
  saveAppConfig,
  registerAppGlobalShortcuts,
})

console.log('Tous les handlers IPC pour la gestion de fichiers sont enregistrés')

// Créer l'icône du tray (barre système)
const createTray = () => {
  tray = createAppTray({
    Tray,
    Menu,
    nativeImage,
    path,
    app,
    getMainWindow: () => mainWindow,
    onShowWindow: () => createWindow(),
    onToggleSidebar: () => toggleSidebar(),
  })
}

// Gérer l'activation de l'application (macOS)
app.whenReady().then(async () => {
  // Pas de menu natif File/Edit/… (header custom frameless)
  Menu.setApplicationMenu(null)

  applyStoredBasePath()
  const bootConfig = loadAppConfig()
  if (bootConfig.globalShortcuts) {
    // Mutation en place (pas de réassignation) : ipc/app.js a reçu une référence
    // vers cet objet à l'enregistrement des handlers, avant ce point. Réassigner
    // la variable créerait un nouvel objet et désynchroniserait les deux copies.
    Object.assign(registeredGlobalShortcuts, bootConfig.globalShortcuts)
  }

  // Initialiser le dossier de base
  try {
    await fileManager.initializeBaseDirectory()
    console.log('Dossier de base initialisé')
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du dossier de base:', error)
  }

  createWindow()
  
  // Créer la sidebar (masquée par défaut)
  createSidebarWindow()
  // Overlay capture détaché (masqué par défaut)
  createCaptureWindow()

  // Créer l'icône du tray
  createTray()

  registerAppGlobalShortcuts()

  // Alt+S / Shift+D / Shift+M : raccourcis renderer (fenêtre principale / sidebar)

  app.on('activate', () => {
    // Sur macOS, recréer la fenêtre si elle n'existe pas
    if (BrowserWindow.getAllWindows().length === 0) {
  createWindow()
      createSidebarWindow()
    } else if (mainWindow) {
      mainWindow.show()
      app.dock.show()
    }
  })
})

// Ne pas quitter l'application quand toutes les fenêtres sont fermées
// L'application reste active dans le tray
app.on('window-all-closed', (event) => {
  // Ne pas quitter, l'application reste en arrière-plan
  // L'utilisateur peut quitter via le menu du tray
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
})

// Désenregistrer tous les raccourcis quand l'application se ferme
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (tray) {
    tray.destroy()
  }
})

// Variable pour savoir si l'application est en train de quitter
app.isQuitting = false

// Gérer les erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error)
})