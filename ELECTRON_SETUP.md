# Configuration Electron + Next.js

## Améliorations apportées

### 1. **Fichier `electron/main.js`**

#### Problèmes corrigés :
- ❌ **Avant** : Tentative de charger `app/page.tsx` (fichier TSX) avec `loadFile()`
- ✅ **Après** : Charge l'URL du serveur Next.js en développement (`http://localhost:3000`) ou les fichiers statiques en production

#### Améliorations de sécurité :
- `nodeIntegration: false` - Désactive l'intégration Node.js dans le renderer (sécurité)
- `contextIsolation: true` - Active l'isolation du contexte (sécurité recommandée par Electron)
- `webSecurity: true` - Active la sécurité web

#### Améliorations UX :
- Fenêtre masquée jusqu'à ce que le contenu soit chargé
- DevTools automatiques en développement
- Rechargement automatique si le serveur Next.js redémarre
- Gestion correcte de la fermeture de fenêtre
- Support macOS (recréation de fenêtre)

### 2. **Fichier `package.json`**

#### Nouveaux scripts :
- `npm run dev` - Démarre Next.js et Electron simultanément
- `npm run dev:next` - Démarre uniquement le serveur Next.js
- `npm run dev:electron` - Démarre uniquement Electron
- `npm run build:electron` - Build Next.js + Electron Builder

#### Nouvelles dépendances :
- `concurrently` - Exécute plusieurs commandes en parallèle
- `wait-on` - Attend que le serveur Next.js soit prêt avant de lancer Electron
- `cross-env` - Définit les variables d'environnement de manière cross-platform
- `electron-builder` - Pour créer des installateurs (optionnel)

### 3. **Fichier `next.config.ts`**

#### Configuration pour Electron :
- Support pour export statique (commenté, à activer si besoin)
- Images non optimisées en production (si export statique)
- `assetPrefix` configuré pour les builds statiques

## Utilisation

### Développement

```bash
npm install  # Installer les nouvelles dépendances
npm run dev  # Démarre Next.js et Electron automatiquement
```

### Production (Option 1 : Export statique)

1. Décommentez `output: 'export'` dans `next.config.ts`
2. Build :
```bash
npm run build
npm start
```

### Production (Option 2 : Serveur Next.js intégré)

1. Gardez `output: 'export'` commenté
2. Build et démarrage :
```bash
npm run build
npm start
```

## Recommandations supplémentaires

### 1. Créer un fichier `preload.js` (optionnel)

Pour la communication IPC sécurisée entre le processus principal et le renderer :

```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Exposer des méthodes sécurisées ici
  platform: process.platform,
})
```

Puis dans `main.js`, ajoutez :
```javascript
preload: path.join(__dirname, 'preload.js')
```

### 2. Configuration Electron Builder (optionnel)

Créez un fichier `electron-builder.yml` pour configurer les builds :

```yaml
appId: com.votreapp.myapp
productName: Mon App
directories:
  output: dist
files:
  - out/**
  - electron/**
  - package.json
win:
  target: nsis
mac:
  target: dmg
linux:
  target: AppImage
```

### 3. Variables d'environnement

Créez un fichier `.env.local` pour les variables d'environnement :

```
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=Mon App Electron
```

## Notes importantes

⚠️ **Sécurité** : Les paramètres de sécurité (`nodeIntegration: false`, `contextIsolation: true`) sont essentiels pour la sécurité de votre application. Ne les désactivez que si absolument nécessaire.

⚠️ **Export statique** : Si vous utilisez `output: 'export'`, certaines fonctionnalités Next.js ne seront pas disponibles (API Routes, Server Components, etc.).

⚠️ **Port** : Le port par défaut est 3000. Si vous changez le port Next.js, mettez à jour l'URL dans `main.js`.


