# Configuration Sidebar Flottante

## Fonctionnalités

Une sidebar flottante qui :
- ✅ Reste **toujours au premier plan** (au-dessus de toutes les fenêtres)
- ✅ S'affiche/masque avec des **raccourcis clavier globaux**
- ✅ Fonctionne même quand l'application principale est minimisée
- ✅ Design moderne avec support du mode sombre

## Raccourcis clavier

Deux raccourcis sont disponibles pour afficher/masquer la sidebar :

1. **`Ctrl+Shift+S`** (Windows/Linux) ou **`Cmd+Shift+S`** (macOS)
2. **`Alt+S`** (toutes les plateformes)

## Structure des fichiers

```
my-app/
├── electron/
│   ├── main.js          # Gestion de la fenêtre sidebar et raccourcis
│   └── preload.js       # Communication IPC sécurisée
├── app/
│   ├── sidebar/
│   │   └── page.tsx     # Page de la sidebar
│   └── types/
│       └── electron.d.ts # Types TypeScript pour l'API Electron
```

## Comment ça fonctionne

### 1. Fenêtre flottante

La sidebar est créée comme une fenêtre Electron séparée avec :
- `alwaysOnTop: true` - Toujours au premier plan
- `frame: false` - Pas de barre de titre
- `skipTaskbar: true` - N'apparaît pas dans la barre des tâches
- Positionnée à gauche de l'écran par défaut

### 2. Raccourcis clavier globaux

Les raccourcis sont enregistrés avec `globalShortcut` d'Electron, ce qui signifie qu'ils fonctionnent **même quand l'application n'est pas au focus**.

### 3. Communication IPC

- `preload.js` expose une API sécurisée au renderer
- `ipcMain` dans `main.js` écoute les messages du renderer
- Communication bidirectionnelle entre la sidebar et le processus principal

## Personnalisation

### Changer la position de la sidebar

Dans `electron/main.js`, modifiez les coordonnées :

```javascript
sidebarWindow = new BrowserWindow({
  width: 350,
  height: height,
  x: 0,  // Changez pour positionner à droite : width - 350
  y: 0,
  // ...
})
```

### Changer les raccourcis clavier

Dans `electron/main.js`, modifiez les raccourcis :

```javascript
// Remplacer Ctrl+Shift+S par votre raccourci
globalShortcut.register('CommandOrControl+Alt+S', () => {
  toggleSidebar()
})
```

### Personnaliser le contenu

Modifiez `app/sidebar/page.tsx` pour ajouter votre propre contenu, composants, etc.

## Utilisation

1. **Démarrer l'application** :
```bash
npm run dev
```

2. **Afficher la sidebar** :
   - Appuyez sur `Ctrl+Shift+S` ou `Alt+S`
   - Ou cliquez sur le bouton "Fermer" dans la sidebar pour la masquer

3. **La sidebar reste visible** :
   - Même si vous changez de fenêtre
   - Même si l'application principale est minimisée
   - Jusqu'à ce que vous la masquiez avec le raccourci

## Notes importantes

⚠️ **Permissions** : Sur certains systèmes, les raccourcis clavier globaux peuvent nécessiter des permissions d'accessibilité.

⚠️ **Conflits** : Si un raccourci est déjà utilisé par une autre application, il ne fonctionnera pas. Changez-le dans `main.js`.

⚠️ **Sécurité** : La communication IPC utilise `contextIsolation: true` pour la sécurité, conformément aux meilleures pratiques Electron.

## Dépannage

### Le raccourci ne fonctionne pas

1. Vérifiez la console Electron pour voir si le raccourci est bien enregistré
2. Vérifiez qu'aucune autre application n'utilise le même raccourci
3. Sur macOS, vérifiez les permissions d'accessibilité dans les Préférences Système

### La sidebar ne s'affiche pas

1. Vérifiez que Next.js est bien démarré (`npm run dev:next`)
2. Vérifiez la console Electron pour les erreurs
3. Assurez-vous que la route `/sidebar` existe dans votre application Next.js

### La sidebar n'est pas au premier plan

Vérifiez que `alwaysOnTop: true` est bien défini dans `createSidebarWindow()`.

