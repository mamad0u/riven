# Configuration Tray (Barre Système)

## Fonctionnalités

L'application peut maintenant fonctionner en arrière-plan grâce à une icône dans la barre système (tray) :

- ✅ **Application toujours active** : L'application reste active même quand la fenêtre principale est fermée
- ✅ **Icône dans la barre système** : Une icône apparaît dans la barre système (près de l'horloge)
- ✅ **Menu contextuel** : Clic droit sur l'icône pour accéder aux options
- ✅ **Recherche rapide** : La sidebar fonctionne même quand la fenêtre principale est fermée

## Comportement

### Fermeture de la fenêtre principale

Quand vous fermez la fenêtre principale :
- ❌ L'application **ne se ferme pas**
- ✅ La fenêtre est **masquée** (minimisée dans le tray)
- ✅ L'application continue de fonctionner en arrière-plan
- ✅ La sidebar reste accessible via les raccourcis clavier

### Menu du Tray

Clic droit sur l'icône dans la barre système pour accéder à :

1. **Afficher l'application** - Rouvre la fenêtre principale
2. **Recherche rapide** - Affiche/masque la sidebar
3. **Quitter** - Ferme complètement l'application

### Raccourcis clavier

Les raccourcis clavier continuent de fonctionner même quand la fenêtre principale est fermée :
- `Ctrl+Shift+S` ou `Alt+S` - Affiche/masque la sidebar

## Ajouter une icône personnalisée

Pour ajouter votre propre icône au tray :

1. Placez une image `icon.png` dans le dossier `public/`
2. Format recommandé : PNG, 16x16 ou 32x32 pixels
3. L'icône sera automatiquement chargée

Si aucune icône n'est fournie, Electron utilisera l'icône par défaut de l'application.

## Fonctionnement technique

### Code principal

- `createTray()` - Crée l'icône dans la barre système
- `mainWindow.on('close')` - Intercepte la fermeture et masque au lieu de fermer
- `app.on('window-all-closed')` - Empêche la fermeture automatique de l'app

### Variables globales

- `app.isQuitting` - Indique si l'application est en train de quitter (pour fermer vraiment)
- `tray` - Référence à l'icône du tray

## Personnalisation

### Modifier le menu du tray

Dans `electron/main.js`, modifiez le `contextMenu` dans `createTray()` :

```javascript
const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Votre option',
    click: () => {
      // Votre code ici
    }
  },
  // ...
])
```

### Modifier le tooltip

```javascript
tray.setToolTip('Votre texte ici')
```

## Notes importantes

⚠️ **Sur macOS** : L'icône apparaît dans la barre de menu (en haut à droite)

⚠️ **Sur Windows** : L'icône apparaît dans la zone de notification (près de l'horloge)

⚠️ **Sur Linux** : L'icône apparaît dans la barre système selon votre environnement de bureau

⚠️ **Fermeture complète** : Pour fermer complètement l'application, utilisez "Quitter" dans le menu du tray

## Dépannage

### L'icône n'apparaît pas

1. Vérifiez que `createTray()` est bien appelé dans `app.whenReady()`
2. Sur certains systèmes, les icônes peuvent être masquées dans les paramètres système
3. Vérifiez les permissions d'affichage des notifications

### L'application se ferme quand même

1. Vérifiez que `app.on('window-all-closed')` ne contient pas `app.quit()`
2. Assurez-vous que `mainWindow.on('close')` intercepte bien l'événement avec `event.preventDefault()`

### La sidebar ne fonctionne plus après fermeture

1. Vérifiez que `sidebarWindow` n'est pas détruit
2. Les raccourcis clavier globaux doivent rester enregistrés

