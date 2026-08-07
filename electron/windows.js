// Construction des 3 BrowserWindow de l'app (main, sidebar, capture).
// Extrait de main.js — même comportement, aucune logique modifiée.
//
// Chaque fonction construit et configure une fenêtre puis la retourne ;
// l'affectation aux variables mainWindow/sidebarWindow/captureWindow et la
// gestion du cycle de vie (on('closed') => remise à null) restent dans
// main.js, qui reste le seul propriétaire de cet état partagé par de
// nombreux autres handlers (tray, ipc, capture/paste externe).

function createMainWindow({ BrowserWindow, path, isDev, app }) {
  const win = new BrowserWindow({
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

  win.setMenuBarVisibility(false)

  // Afficher la fenêtre une fois le contenu chargé
  win.once('ready-to-show', () => {
    win.show()

    // Ouvrir les DevTools en développement
    if (isDev) {
      win.webContents.openDevTools()
    }
  })

  // Charger l'application Next.js
  if (isDev) {
    // En développement : charger depuis le serveur Next.js
    win.loadURL('http://localhost:3000')

    // Recharger automatiquement si le serveur Next.js redémarre
    win.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        win.loadURL('http://localhost:3000')
      }, 1000)
    })
  } else {
    // En production : charger depuis les fichiers statiques exportés
    win.loadFile(path.join(__dirname, '../out/index.html'))
  }

  // Gérer la fermeture de la fenêtre (masquer au lieu de fermer)
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
      // Afficher une notification (optionnel)
      if (process.platform === 'darwin') {
        app.dock.hide()
      }
    }
  })

  return win
}

// Fenêtre sidebar flottante (barre de recherche centrée)
function createSidebarWindowInstance({ BrowserWindow, screen, path, isDev }) {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  // Taille de la fenêtre pour la barre de recherche (centrée)
  // Augmenter la hauteur pour afficher les résultats
  const windowWidth = 900
  const windowHeight = 700 // Hauteur augmentée pour afficher les résultats
  const x = Math.floor((width - windowWidth) / 2)
  const y = Math.floor((height - windowHeight) / 2)

  const win = new BrowserWindow({
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
    win.loadURL('http://localhost:3000/sidebar')
  } else {
    win.loadFile(path.join(__dirname, '../out/sidebar/index.html'))
  }

  // Attendre que le contenu soit chargé avant d'afficher
  win.webContents.once('did-finish-load', () => {
    // Le contenu est chargé, on peut maintenant afficher avec animation
  })

  // Masquer la sidebar par défaut
  win.hide()
  win.setOpacity(0) // Commencer avec opacité 0

  return win
}

// Fenêtre flottante détachée pour Quick Prompt Save (indépendante de l'app principale)
function createCaptureWindowInstance({ BrowserWindow, screen, path, isDev }) {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x: waX, y: waY, width, height } = primaryDisplay.workArea

  const win = new BrowserWindow({
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

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev) {
    win.loadURL('http://localhost:3000/capture')
  } else {
    win.loadFile(path.join(__dirname, '../out/capture/index.html'))
  }

  win.hide()
  win.setOpacity(0)

  return win
}

module.exports = {
  createMainWindow,
  createSidebarWindowInstance,
  createCaptureWindowInstance,
}
