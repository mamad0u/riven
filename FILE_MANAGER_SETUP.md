# Système de Gestion de Fichiers

## Fonctionnalités

Un système complet de gestion de fichiers et dossiers avec synchronisation locale :

- ✅ **Stockage local** : Tous les fichiers sont enregistrés sur le disque C:\my-app (Windows) ou ~/my-app (macOS/Linux)
- ✅ **Création de dossiers** : Créez des dossiers directement depuis l'application
- ✅ **Création de fichiers** : Créez des fichiers texte depuis l'application
- ✅ **Navigation** : Parcourez les dossiers et fichiers
- ✅ **Renommage** : Renommez les fichiers et dossiers
- ✅ **Suppression** : Supprimez les fichiers et dossiers
- ✅ **Synchronisation** : Tous les changements sont immédiatement synchronisés avec le disque

## Emplacement des fichiers

### Windows
```
C:\my-app\
```

### macOS / Linux
```
~/my-app/
```

Le dossier est créé automatiquement au premier lancement de l'application.

## Utilisation

### Accéder au gestionnaire de fichiers

1. Ouvrez l'application
2. Cliquez sur "📁 Gestionnaire de fichiers" sur la page d'accueil
3. Ou naviguez vers `/files` dans l'application

### Créer un dossier

1. Cliquez sur "+ Nouveau dossier"
2. Entrez le nom du dossier
3. Appuyez sur "Créer" ou Entrée

### Créer un fichier

1. Cliquez sur "+ Nouveau fichier"
2. Entrez le nom du fichier (avec extension, ex: `monfichier.txt`)
3. Appuyez sur "Créer" ou Entrée

### Naviguer dans les dossiers

- Cliquez sur un dossier pour l'ouvrir
- Cliquez sur "← Retour" pour revenir au dossier parent

### Renommer un élément

1. Cliquez sur "Renommer" à côté de l'élément
2. Entrez le nouveau nom
3. Appuyez sur "Renommer" ou Entrée

### Supprimer un élément

1. Cliquez sur "Supprimer" à côté de l'élément
2. Confirmez la suppression

## Structure du code

### Backend (Electron)

- **`electron/fileManager.js`** : Module de gestion des fichiers
  - `initializeBaseDirectory()` : Initialise le dossier de base
  - `listDirectory()` : Liste les fichiers et dossiers
  - `createDirectory()` : Crée un dossier
  - `createFile()` : Crée un fichier
  - `readFile()` : Lit un fichier
  - `writeFile()` : Écrit dans un fichier
  - `deleteItem()` : Supprime un élément
  - `renameItem()` : Renomme un élément

- **`electron/main.js`** : Handlers IPC pour la communication
  - `ipcMain.handle('file-list')` : Liste les fichiers
  - `ipcMain.handle('file-create-dir')` : Crée un dossier
  - `ipcMain.handle('file-create-file')` : Crée un fichier
  - `ipcMain.handle('file-read')` : Lit un fichier
  - `ipcMain.handle('file-write')` : Écrit dans un fichier
  - `ipcMain.handle('file-delete')` : Supprime un élément
  - `ipcMain.handle('file-rename')` : Renomme un élément

### Frontend (Next.js)

- **`app/files/page.tsx`** : Interface utilisateur du gestionnaire de fichiers
  - Affichage de la liste des fichiers
  - Navigation dans les dossiers
  - Création, renommage, suppression

- **`electron/preload.js`** : API exposée au renderer
  - `window.electronAPI.fileManager.*` : Méthodes de gestion de fichiers

## Sécurité

- ✅ **Vérification des chemins** : Tous les chemins sont vérifiés pour s'assurer qu'ils sont dans le dossier de base
- ✅ **Isolation du contexte** : Communication sécurisée via IPC
- ✅ **Pas d'accès direct au système de fichiers** : Le renderer ne peut pas accéder directement au système de fichiers

## Exemple d'utilisation dans le code

```typescript
// Lister les fichiers dans le dossier racine
const result = await window.electronAPI.fileManager.listDirectory(null)

// Créer un dossier
await window.electronAPI.fileManager.createDirectory(null, 'mon-dossier')

// Créer un fichier
await window.electronAPI.fileManager.createFile('mon-dossier', 'fichier.txt', 'Contenu du fichier')

// Lire un fichier
const file = await window.electronAPI.fileManager.readFile('mon-dossier/fichier.txt')

// Écrire dans un fichier
await window.electronAPI.fileManager.writeFile('mon-dossier/fichier.txt', 'Nouveau contenu')

// Renommer
await window.electronAPI.fileManager.renameItem('mon-dossier/fichier.txt', 'nouveau-nom.txt')

// Supprimer
await window.electronAPI.fileManager.deleteItem('mon-dossier/fichier.txt')
```

## Limitations actuelles

- ⚠️ Lecture/écriture de fichiers texte uniquement (pas de binaires pour l'instant)
- ⚠️ Pas d'aperçu de fichier intégré (à ajouter si nécessaire)
- ⚠️ Pas de glisser-déposer (à ajouter si nécessaire)
- ⚠️ Pas de recherche de fichiers (à ajouter si nécessaire)

## Améliorations possibles

- [ ] Éditeur de texte intégré pour les fichiers
- [ ] Aperçu des images
- [ ] Glisser-déposer de fichiers
- [ ] Recherche de fichiers
- [ ] Support des fichiers binaires
- [ ] Compression/décompression
- [ ] Historique des modifications

## Dépannage

### Le dossier n'est pas créé

1. Vérifiez les permissions d'écriture sur le disque C:\
2. Sur Windows, vous pourriez avoir besoin de lancer l'application en tant qu'administrateur
3. Vérifiez les logs de la console Electron

### Erreur "Chemin non autorisé"

Cela signifie que le chemin demandé est en dehors du dossier de base. C'est une mesure de sécurité.

### Les fichiers ne s'affichent pas

1. Vérifiez que le dossier de base existe
2. Actualisez la liste avec le bouton "🔄 Actualiser"
3. Vérifiez la console pour les erreurs

