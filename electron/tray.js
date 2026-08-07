// Icône et menu contextuel de la barre système (tray).
// Extrait de main.js — même comportement, aucune logique modifiée.

function createAppTray({ Tray, Menu, nativeImage, path, app, getMainWindow, onShowWindow, onToggleSidebar }) {
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
  let tray
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
        const win = getMainWindow()
        if (win) {
          win.show()
          if (process.platform === 'darwin') {
            app.dock.show()
          }
        } else {
          onShowWindow()
        }
      }
    },
    {
      label: 'Recherche rapide',
      click: () => {
        onToggleSidebar()
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
    const win = getMainWindow()
    if (win) {
      win.show()
      if (process.platform === 'darwin') {
        app.dock.show()
      }
    } else {
      onShowWindow()
    }
  })

  // Clic simple pour afficher/masquer la sidebar (sur certains systèmes)
  tray.on('click', () => {
    if (process.platform === 'win32') {
      // Sur Windows, le clic simple ouvre le menu contextuel
      tray.popUpContextMenu()
    }
  })

  return tray
}

module.exports = { createAppTray }
