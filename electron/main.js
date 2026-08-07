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

let mainWindow = null
let sidebarWindow = null
let captureWindow = null
let tray = null
let lastFocusedWindow = null // Fenêtre Electron qui avait le focus avant d'ouvrir la sidebar
let lastActiveElementInfo = null // Informations sur l'élément actif avant d'ouvrir la sidebar
let lastActiveWindowHandle = null // Handle de la fenêtre système active (pour restaurer le focus)

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'riven-config.json')

const loadAppConfig = () => {
  try {
    const raw = fs.readFileSync(CONFIG_FILE(), 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const saveAppConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify(config, null, 2), 'utf8')
  } catch (err) {
    console.error('Erreur sauvegarde config:', err)
  }
}

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

// const : cet objet est partagé par référence avec ipc/app.js (shortcuts-set-globals),
// il ne doit jamais être réassigné, seulement muté en place (voir plus bas).
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
    toggleSidebar()
  })
  if (!okSidebar) {
    console.log('Échec enregistrement raccourci sidebar:', sidebarAccel)
  } else {
    console.log('Raccourci sidebar enregistré:', sidebarAccel)
  }

  const captureAccel = registeredGlobalShortcuts.capturePrompt || 'Alt+Shift+C'
  const okCapture = globalShortcut.register(captureAccel, () => {
    console.log('Raccourci Capture prompt reçu:', captureAccel)
    void openCapturePrompt()
  })
  if (!okCapture) {
    console.log('Échec enregistrement raccourci capture:', captureAccel)
  } else {
    console.log('Raccourci capture enregistré:', captureAccel)
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    backgroundColor: '#0D0D0E',
  })

  mainWindow.setMenuBarVisibility(false)

  // Afficher la fenêtre une fois le contenu chargé
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    
    // Ouvrir les DevTools en développement
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  // Charger l'application Next.js
  if (isDev) {
    // En développement : charger depuis le serveur Next.js
    mainWindow.loadURL('http://localhost:3000')
    
    // Recharger automatiquement si le serveur Next.js redémarre
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:3000')
      }, 1000)
    })
  } else {
    // En production : charger depuis les fichiers statiques exportés
    // Assurez-vous que Next.js est configuré avec output: 'export'
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'))
  }

  // Gérer la fermeture de la fenêtre (masquer au lieu de fermer)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      // Afficher une notification (optionnel)
      if (process.platform === 'darwin') {
        app.dock.hide()
      }
    }
  })

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
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  // Taille de la fenêtre pour la barre de recherche (centrée)
  // Augmenter la hauteur pour afficher les résultats
  const windowWidth = 900
  const windowHeight = 700 // Hauteur augmentée pour afficher les résultats
  const x = Math.floor((width - windowWidth) / 2)
  const y = Math.floor((height - windowHeight) / 2)

  sidebarWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x, // Centré horizontalement
    y: y, // Centré verticalement
    frame: false, // Pas de barre de titre
    alwaysOnTop: true, // Toujours au premier plan
    skipTaskbar: true, // Ne pas afficher dans la barre des tâches
    resizable: false, // Pas de redimensionnement
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#00000000', // Transparent
    transparent: true, // Fenêtre transparente
    // Empêcher la fenêtre de se fermer complètement
    closable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false, // Pas d'ombre
  })

  // Charger la page sidebar
  if (isDev) {
    sidebarWindow.loadURL('http://localhost:3000/sidebar')
  } else {
    sidebarWindow.loadFile(path.join(__dirname, '../out/sidebar/index.html'))
  }

  // Attendre que le contenu soit chargé avant d'afficher
  sidebarWindow.webContents.once('did-finish-load', () => {
    // Le contenu est chargé, on peut maintenant afficher avec animation
  })

  // Masquer la sidebar par défaut
  sidebarWindow.hide()
  sidebarWindow.setOpacity(0) // Commencer avec opacité 0

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
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x: waX, y: waY, width, height } = primaryDisplay.workArea

  captureWindow = new BrowserWindow({
    width,
    height,
    x: waX,
    y: waY,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    closable: false,
    minimizable: false,
    maximizable: false,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  captureWindow.setAlwaysOnTop(true, 'screen-saver')
  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    captureWindow.loadURL('http://localhost:3000/capture')
  } else {
    captureWindow.loadFile(path.join(__dirname, '../out/capture/index.html'))
  }

  captureWindow.hide()
  captureWindow.setOpacity(0)

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

// Fonction pour sauvegarder la fenêtre système active (Windows)
const saveActiveWindow = () => {
  if (process.platform === 'win32') {
    console.log('Tentative de sauvegarde de la fenêtre active...')
    
    // Créer un script PowerShell temporaire
    const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@
$hwnd = [Win32]::GetForegroundWindow()
Write-Output $hwnd.ToInt64()
`
    
    const tempFile = path.join(os.tmpdir(), `electron-save-window-${Date.now()}.ps1`)
    
    fs.writeFileSync(tempFile, psScript, 'utf8')
    
    exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      // Nettoyer le fichier temporaire
      try {
        fs.unlinkSync(tempFile)
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
      
      if (error) {
        console.error('Erreur lors de la sauvegarde de la fenêtre active:', error.message)
        if (stderr) {
          console.error('Stderr:', stderr.substring(0, 200))
        }
        return
      }
      
      if (stdout) {
        const trimmed = stdout.trim()
        console.log('Sortie PowerShell (raw):', trimmed)
        const handle = parseInt(trimmed)
        console.log('Handle parsé:', handle)
        
        if (!isNaN(handle) && handle !== 0) {
          lastActiveWindowHandle = handle
          console.log('✓ Fenêtre système active sauvegardée, handle:', handle)
        } else {
          console.log('✗ Handle invalide:', handle)
        }
      } else {
        console.log('✗ Aucune sortie de PowerShell')
      }
    })
  } else {
    console.log('Platform non-Windows, sauvegarde de fenêtre ignorée')
  }
}

// Fonction pour restaurer le focus sur la fenêtre système sauvegardée (Windows)
const restoreActiveWindow = () => {
  if (process.platform === 'win32') {
    if (!lastActiveWindowHandle) {
      console.log('✗ Aucun handle de fenêtre sauvegardé, impossible de restaurer le focus')
      return
    }
    
    console.log('Tentative de restauration du focus sur handle:', lastActiveWindowHandle)
    
    const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
}
'@
$hwnd = New-Object IntPtr(${lastActiveWindowHandle})
if ([Win32]::IsWindow($hwnd)) {
  $result = [Win32]::SetForegroundWindow($hwnd)
  if ($result) {
    Write-Output "OK"
  } else {
    Write-Output "SETFOREGROUND_FAILED"
  }
} else {
  Write-Output "WINDOW_NOT_FOUND"
}
`
    
    const tempFile = path.join(os.tmpdir(), `electron-restore-window-${Date.now()}.ps1`)
    
    fs.writeFileSync(tempFile, psScript, 'utf8')
    
    exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      // Nettoyer le fichier temporaire
      try {
        fs.unlinkSync(tempFile)
      } catch (e) {
        // Ignorer les erreurs de suppression
      }
      
      if (error) {
        console.error('Erreur lors de la restauration du focus:', error.message)
        if (stderr) {
          console.error('Stderr:', stderr.substring(0, 200))
        }
        return
      }
      
      if (stdout) {
        const result = stdout.trim()
        console.log('Résultat PowerShell:', result)
        if (result === 'OK') {
          console.log('✓ Focus restauré sur la fenêtre système, handle:', lastActiveWindowHandle)
        } else if (result === 'SETFOREGROUND_FAILED') {
          console.log('✗ SetForegroundWindow a échoué (peut nécessiter des permissions élevées)')
        } else {
          console.log('✗ La fenêtre système n\'existe plus ou ne peut pas être restaurée:', result)
          lastActiveWindowHandle = null
        }
      } else {
        console.log('✗ Aucune sortie de PowerShell lors de la restauration')
      }
    })
  } else {
    console.log('Platform non-Windows, restauration de focus ignorée')
  }
}

// Capture SYNCHRONE du HWND de la fenêtre active AVANT d'afficher l'overlay
// (execSync bloque ~300-500ms mais c'est acceptable avant d'ouvrir l'overlay)
const getForegroundWindowHandleSync = () => {
  if (process.platform !== 'win32') return null

  const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class HwndCapture {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@
[HwndCapture]::GetForegroundWindow().ToInt64()`

  const tempFile = path.join(os.tmpdir(), `hwnd-${Date.now()}.ps1`)
  try {
    fs.writeFileSync(tempFile, psScript, 'utf8')
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
      { timeout: 3000 }
    ).toString().trim()
    try { fs.unlinkSync(tempFile) } catch {}
    const handle = parseInt(result)
    if (!isNaN(handle) && handle !== 0) {
      console.log('✓ HWND capturé (sync):', handle)
      return handle
    }
  } catch (e) {
    try { fs.unlinkSync(tempFile) } catch {}
    console.error('Erreur capture HWND sync:', e.message)
  }
  return null
}

const getNativeHwnd = (win) => {
  if (!win || win.isDestroyed()) return null
  try {
    const buf = win.getNativeWindowHandle()
    if (buf.length >= 8) return Number(buf.readBigUInt64LE(0))
    return buf.readUInt32LE(0)
  } catch {
    return null
  }
}

const findElectronWindowByHwnd = (hwnd) => {
  if (!hwnd) return null
  for (const win of [mainWindow, sidebarWindow, captureWindow]) {
    if (getNativeHwnd(win) === hwnd) return win
  }
  return null
}

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

// Restaurer le focus sur une fenêtre externe et simuler Ctrl+V pour coller
const pasteToExternalWindow = (hwnd) => {
  if (process.platform !== 'win32' || !hwnd) return

  console.log('Tentative de collage dans la fenêtre externe, handle:', hwnd)

  const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FocusPaste {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
$hwnd = New-Object IntPtr(${hwnd})
if (-not [FocusPaste]::IsWindow($hwnd)) {
  Write-Output "WINDOW_NOT_FOUND"
  exit
}
# AttachThreadInput : contourne la protection Windows contre le vol de focus
$targetPid = 0
$targetThread = [FocusPaste]::GetWindowThreadProcessId($hwnd, [ref]$targetPid)
$currentThread = [FocusPaste]::GetCurrentThreadId()
[FocusPaste]::AttachThreadInput($currentThread, $targetThread, $true)
[FocusPaste]::ShowWindow($hwnd, 9)
[FocusPaste]::BringWindowToTop($hwnd)
$ok = [FocusPaste]::SetForegroundWindow($hwnd)
[FocusPaste]::AttachThreadInput($currentThread, $targetThread, $false)
Start-Sleep -Milliseconds 150
# Simuler Ctrl+V dans la fenêtre qui a maintenant le focus
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v")
if ($ok) { Write-Output "OK" } else { Write-Output "SETFOREGROUND_FAILED" }`

  const tempFile = path.join(os.tmpdir(), `paste-${Date.now()}.ps1`)
  fs.writeFileSync(tempFile, psScript, 'utf8')

  exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
    try { fs.unlinkSync(tempFile) } catch {}
    if (error) {
      console.error('Erreur collage externe:', error.message)
      return
    }
    const result = stdout.trim()
    if (result === 'OK') {
      console.log('✓ Ctrl+V envoyé à la fenêtre externe, handle:', hwnd)
    } else if (result === 'SETFOREGROUND_FAILED') {
      console.log('✗ SetForegroundWindow a échoué (Ctrl+V peut quand même avoir fonctionné)')
    } else {
      console.log('✗ Résultat paste externe:', result)
    }
  })
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
        lastActiveWindowHandle = handle
      }

      // Sauvegarder la fenêtre Electron qui avait le focus et l'élément actif
      lastFocusedWindow = BrowserWindow.getFocusedWindow()
      
      // Si une fenêtre Electron avait le focus, sauvegarder l'élément actif
      if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) {
        lastFocusedWindow.webContents.executeJavaScript(`
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
          lastActiveElementInfo = info
          console.log('Élément actif sauvegardé:', info)
        }).catch(() => {
          lastActiveElementInfo = null
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

// Handler pour restaurer le focus et coller
ipcMain.on('restore-focus-and-paste', async (event, content) => {
  console.log('restore-focus-and-paste appelé avec:', content?.substring(0, 50) + '...')
  console.log('lastFocusedWindow:', lastFocusedWindow ? 'existe' : 'null')
  console.log('lastActiveElementInfo:', lastActiveElementInfo)
  console.log('lastActiveWindowHandle:', lastActiveWindowHandle)
  
  // Cas 1 : C'était une fenêtre Electron - on peut exécuter du JavaScript directement
  if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) {
    console.log('Cas 1 : Fenêtre Electron détectée, insertion directe du texte')
    lastFocusedWindow.focus()
    
    // Attendre que la fenêtre Electron reçoive le focus
    setTimeout(() => {
      if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) {
        // Vérifier que le document est chargé
        lastFocusedWindow.webContents.executeJavaScript('document.readyState').then((readyState) => {
          if (readyState !== 'complete') {
            console.log('Document pas encore chargé, attente...')
            return
          }
          
          // Étape 1 : Focus sur l'élémentmes 
          const focusScript = `
            (function() {
              try {
                const savedInfo = ${JSON.stringify(lastActiveElementInfo || {})};
                let targetElement = null;
                
                // Essayer de retrouver l'élément sauvegardé
                if (savedInfo && savedInfo.tagName) {
                  if (savedInfo.id) {
                    targetElement = document.getElementById(savedInfo.id);
                  } else if (savedInfo.name) {
                    targetElement = document.querySelector(savedInfo.tagName.toLowerCase() + '[name="' + savedInfo.name + '"]');
                  } else if (savedInfo.className) {
                    // Ne pas utiliser les classes Tailwind dans le sélecteur car elles contiennent des caractères invalides (:)
                    // À la place, chercher tous les éléments du même type et vérifier manuellement les classes
                    const allElements = document.querySelectorAll(savedInfo.tagName.toLowerCase());
                    for (let i = 0; i < allElements.length; i++) {
                      const el = allElements[i];
                      // Vérifier si l'élément a le même type et les mêmes classes
                      if ((!savedInfo.type || el.type === savedInfo.type) &&
                          el.className === savedInfo.className) {
                        targetElement = el;
                        break;
                      }
                    }
                  }
                  
                  if (targetElement && (
                    targetElement.tagName !== savedInfo.tagName ||
                    (savedInfo.type && targetElement.type !== savedInfo.type)
                  )) {
                    targetElement = null;
                  }
                }
                
                if (!targetElement) {
                  targetElement = document.activeElement;
                }
                
                if (!targetElement || (
                  targetElement.tagName !== 'INPUT' && 
                  targetElement.tagName !== 'TEXTAREA' &&
                  !targetElement.isContentEditable
                )) {
                  const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, [contenteditable="true"]');
                  if (inputs.length > 0) {
                    for (let i = inputs.length - 1; i >= 0; i--) {
                      if (!inputs[i].disabled && !inputs[i].readOnly) {
                        targetElement = inputs[i];
                        break;
                      }
                    }
                  }
                }
                
                if (targetElement) {
                  targetElement.focus();
                  return targetElement.tagName + (targetElement.id ? '#' + targetElement.id : '') + (targetElement.name ? '[name="' + targetElement.name + '"]' : '');
                }
                return null;
              } catch (error) {
                console.error('Erreur dans focusScript:', error);
                return 'ERROR: ' + error.message;
              }
            })();
          `
          
          lastFocusedWindow.webContents.executeJavaScript(focusScript).then((elementInfo) => {
            console.log('Élément ciblé:', elementInfo)
            
            if (elementInfo && elementInfo.startsWith('ERROR:')) {
              console.error('Erreur lors du focus:', elementInfo)
              return
            }
            
            // Étape 2 : Insérer le texte après un court délai
            setTimeout(() => {
              if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) {
                const pasteScript = `
                  (function() {
                    try {
                      const textToPaste = ${JSON.stringify(content || '')};
                      const activeElement = document.activeElement;
                      
                      let targetElement = activeElement;
                      
                      // Si l'élément actif n'est pas un input, chercher le dernier input/textarea
                      if (!targetElement || (
                        targetElement.tagName !== 'INPUT' && 
                        targetElement.tagName !== 'TEXTAREA' &&
                        !targetElement.isContentEditable
                      )) {
                        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, [contenteditable="true"]');
                        if (inputs.length > 0) {
                          for (let i = inputs.length - 1; i >= 0; i--) {
                            if (!inputs[i].disabled && !inputs[i].readOnly) {
                              targetElement = inputs[i];
                              break;
                            }
                          }
                        }
                      }
                      
                      if (targetElement) {
                        // S'assurer que l'élément a le focus
                        if (document.activeElement !== targetElement) {
                          targetElement.focus();
                        }
                        
                        // Insérer le texte selon le type d'élément
                        if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
                          const input = targetElement;
                          const start = input.selectionStart !== null ? input.selectionStart : input.value.length;
                          const end = input.selectionEnd !== null ? input.selectionEnd : input.value.length;
                          const value = input.value || '';
                          const newValue = value.substring(0, start) + textToPaste + value.substring(end);
                          
                          // Utiliser Object.getOwnPropertyDescriptor pour définir la valeur (pour React)
                          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || 
                                                         Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                          
                          if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(input, newValue);
                          } else {
                            input.value = newValue;
                          }
                          
                          // Définir la position du curseur
                          const newCursorPos = start + textToPaste.length;
                          try {
                            input.setSelectionRange(newCursorPos, newCursorPos);
                          } catch (e) {
                            // Ignorer les erreurs de sélection
                          }
                          
                          // Déclencher les événements pour que React/autres frameworks détectent le changement
                          try {
                            const inputEvent = new InputEvent('input', {
                              bubbles: true,
                              cancelable: true,
                              inputType: 'insertText',
                              data: textToPaste
                            });
                            input.dispatchEvent(inputEvent);
                          } catch (e) {
                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                            input.dispatchEvent(inputEvent);
                          }
                          
                          const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                          input.dispatchEvent(changeEvent);
                          
                          console.log('Texte collé dans input:', targetElement.tagName, newValue.substring(0, 50));
                          return true;
                        } else if (targetElement.isContentEditable) {
                          // Pour les éléments contenteditable
                          if (document.activeElement !== targetElement) {
                            targetElement.focus();
                          }
                          
                          const selection = window.getSelection();
                          if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            const textNode = document.createTextNode(textToPaste);
                            range.insertNode(textNode);
                            range.setStartAfter(textNode);
                            selection.removeAllRanges();
                            selection.addRange(range);
                            
                            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                          } else {
                            targetElement.textContent = (targetElement.textContent || '') + textToPaste;
                            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                          
                          console.log('Texte collé dans contenteditable');
                          return true;
                        }
                      }
                      
                      console.log('Aucun élément cible trouvé');
                      return false;
                    } catch (error) {
                      console.error('Erreur dans pasteScript:', error);
                      return 'ERROR: ' + error.message;
                    }
                  })();
                `
                
                lastFocusedWindow.webContents.executeJavaScript(pasteScript).then((result) => {
                  if (result && typeof result === 'string' && result.startsWith('ERROR:')) {
                    console.error('Erreur lors du collage:', result)
                  } else {
                    console.log('Texte collé, résultat:', result)
                  }
                }).catch((err) => {
                  console.error('Erreur lors du collage:', err)
                })
              }
            }, 200)
          }).catch((err) => {
            console.error('Erreur lors du focus:', err)
          })
        }).catch((err) => {
          console.error('Erreur lors de la vérification du document:', err)
        })
      }
    }, 500)
  } else if (lastActiveWindowHandle) {
    // Cas 2 : Fenêtre externe (navigateur, Cursor, Word, etc.)
    // Le contenu est déjà dans le presse-papier via copyToClipboard()
    // On restaure le focus + on simule Ctrl+V automatiquement
    console.log('Cas 2 : Collage automatique dans la fenêtre externe, handle:', lastActiveWindowHandle)
    pasteToExternalWindow(lastActiveWindowHandle)
  } else {
    console.log('Aucune fenêtre à restaurer')
  }
})

console.log('Tous les handlers IPC pour la gestion de fichiers sont enregistrés')

// Créer l'icône du tray (barre système)
const createTray = () => {
  let trayIcon
  
  // Essayer de charger une icône personnalisée depuis public
  try {
    const iconPath = path.join(__dirname, '../public/icon.png')
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      throw new Error('Icône vide')
    }
  } catch (error) {
    // Si pas d'icône personnalisée, utiliser l'icône de l'application
    // Electron utilisera automatiquement l'icône de l'app si disponible
    // Sinon, créer une icône vide (Electron utilisera une icône par défaut)
    trayIcon = nativeImage.createEmpty()
  }

  // Créer le tray (Electron utilisera l'icône de l'app si trayIcon est vide)
  if (trayIcon && !trayIcon.isEmpty()) {
    tray = new Tray(trayIcon)
  } else {
    // Utiliser l'icône par défaut de l'application
    // Sur certains systèmes, cela nécessite que l'app ait une icône définie
    tray = new Tray(nativeImage.createEmpty())
  }

  // Menu contextuel du tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Afficher l\'application',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          if (process.platform === 'darwin') {
            app.dock.show()
          }
        } else {
          createWindow()
        }
      }
    },
    {
      label: 'Recherche rapide',
      click: () => {
        toggleSidebar()
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('Mon Application')
  tray.setContextMenu(contextMenu)

  // Double-clic pour afficher la fenêtre
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      if (process.platform === 'darwin') {
        app.dock.show()
      }
    } else {
      createWindow()
    }
  })

  // Clic simple pour afficher/masquer la sidebar (sur certains systèmes)
  tray.on('click', () => {
    if (process.platform === 'win32') {
      // Sur Windows, le clic simple ouvre le menu contextuel
      tray.popUpContextMenu()
    }
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