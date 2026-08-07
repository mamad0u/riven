# Riven

Application desktop de gestion de prompts, construite avec [Electron](https://www.electronjs.org/) (processus principal + fenêtres) et [Next.js](https://nextjs.org) (interface, servie en local par Electron).

## Architecture du projet

```
my-app/
├── electron/              # Processus principal Electron (Node.js)
│   ├── main.js            # Point d'entrée : requires + app.whenReady() + cycle de vie
│   ├── config.js          # Persistance de riven-config.json (userData)
│   ├── windows.js         # Création des 3 BrowserWindow (main, sidebar, capture)
│   ├── tray.js             # Icône et menu de la barre système
│   ├── shortcuts.js       # Raccourcis globaux (toggle sidebar / capture)
│   ├── nativePaste.js     # Focus/paste externe (win32), voir Étape 4c du refactor
│   ├── fileManager.js     # Lecture/écriture des prompts sur disque
│   ├── captureSelection.js
│   ├── preload.js         # Pont contextIsolation (window.electronAPI)
│   └── ipc/               # Handlers IPC regroupés par domaine
│       ├── files.js       # file-* → délègue à fileManager.js
│       ├── dialogs.js     # dialog-open-file / dialog-open-directory
│       ├── app.js         # app-get-version, shortcuts-set-globals
│       └── window.js      # window-minimize/maximize/close, always-on-top
├── app/                   # Interface Next.js (App Router)
│   ├── page.tsx           # Dashboard principal (orchestrateur)
│   ├── sidebar/, capture/ # Fenêtres flottantes secondaires
│   ├── components/        # Composants React (dont modules/, sidebar/, tags/, ui/)
│   ├── hooks/             # useEditorTabs, useTagStore, useDashboardFilters, useKeyboardShortcuts
│   ├── lib/                # Logique métier pure (parsing, registry, stores localStorage…)
│   └── types/              # Types partagés (TagFilterSelection, DateFilterPreset…)
└── electron.d.ts           # Types de l'API exposée par preload.js (source de vérité FileItem)
```

Alias TypeScript : `@/*` pointe vers la racine de `my-app` (ex. `@/electron.d`, `@/app/lib/...`).

## Stratégie de persistance

Le projet a **deux mécanismes de stockage distincts**, avec des implications importantes si l'équipe partage un dossier de prompts commun (ex. via un drive réseau, un dossier synchronisé ou un dépôt git dédié aux prompts) :

### 1. Fichiers disque — portable / partageable

Les **prompts eux-mêmes** (contenu `.md` + variables) sont gérés par [`electron/fileManager.js`](electron/fileManager.js) et stockés dans le dossier de base (`basePath`, configurable — voir `riven-config.json` ci-dessous) :

- Chaque prompt est un fichier `.md`.
- Les définitions de variables (parent/enfant, valeurs par défaut) sont sérialisées dans un trailer `%%riven-vars%%` en fin de fichier (voir [`app/lib/variableRegistry.ts`](app/lib/variableRegistry.ts)).
- **Ces fichiers sont portables** : si le dossier `basePath` est partagé entre plusieurs postes (copie, sync, dépôt git), les prompts et leurs variables suivent.

### 2. `localStorage` du renderer — strictement locale à la machine

Toutes les **métadonnées d'usage personnel** sont stockées dans le `localStorage` de la fenêtre Next.js, donc **jamais partagées** même si le dossier de prompts est partagé :

| Donnée | Module | Clé `localStorage` |
| --- | --- | --- |
| Tags (liste + assignation par fichier) | [`app/lib/tagStore.ts`](app/lib/tagStore.ts) | `riven-tag-store` |
| Favoris + couleurs de dossier | [`app/lib/promptMetadata.ts`](app/lib/promptMetadata.ts) (utilisé aussi par [`folderColors.ts`](app/lib/folderColors.ts)) | `riven-prompt-metadata` |
| Raccourcis clavier personnalisés | [`app/lib/shortcutStore.ts`](app/lib/shortcutStore.ts) | `riven-shortcuts` |
| Thème (clair/sombre) | [`app/lib/themeStore.ts`](app/lib/themeStore.ts) | `riven-theme` |

**Implication équipe** : si deux personnes ouvrent le même dossier de prompts partagé sur deux machines différentes, chacune verra ses **propres** tags, favoris, couleurs de dossier et raccourcis — ces métadonnées ne se synchronisent pas via le partage de fichiers. Seul le contenu des prompts (texte + variables) est commun.

### 3. Config applicative Electron — locale à la machine

[`electron/config.js`](electron/config.js) persiste `riven-config.json` dans le dossier `userData` d'Electron (spécifique à l'OS/l'utilisateur, hors du dossier de prompts) : le `basePath` choisi et les raccourcis globaux système. Comme pour le `localStorage`, ce fichier n'est pas partagé entre machines.

## Getting Started

```bash
npm install
npm run dev
```

`npm run dev` lance en parallèle le serveur Next.js (`http://localhost:3000`) et l'application Electron (`electron .`) qui charge ce serveur dans ses fenêtres. Ce n'est **pas** une application web classique : ouvrir `http://localhost:3000` dans un navigateur fonctionnera partiellement mais l'API `window.electronAPI` (fichiers, fenêtres, raccourcis) ne sera disponible que dans l'app Electron.

### Autres scripts utiles

- `npm run lint` — ESLint sur tout le projet.
- `npx tsc --noEmit` — vérification des types sans compilation.
- `npm run build` — build de production Next.js.
- `npm run build:electron` — build Next.js + packaging Electron (`electron-builder`).
- `npm run start` — lance l'app packagée en mode production.

Voir aussi les fichiers `*_SETUP.md` à la racine pour le détail de certaines fonctionnalités (gestion de fichiers, tray, sidebar, Electron).
