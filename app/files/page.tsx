'use client'

// Page legacy — la navigation principale est sur /

import { useState, useEffect, useCallback } from 'react'

interface FileItem {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  isFile: boolean
  size: number
  created: Date
  modified: Date
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [basePath, setBasePath] = useState<string>('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createType, setCreateType] = useState<'file' | 'directory'>('file')
  const [newItemName, setNewItemName] = useState('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [renameItem, setRenameItem] = useState<FileItem | null>(null)
  const [newName, setNewName] = useState('')
  const [editingFile, setEditingFile] = useState<FileItem | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Charger le chemin de base
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.fileManager.getBasePath().then((path) => {
        setBasePath(path)
      })
    }
  }, [])

  // Charger les fichiers et dossiers
  const loadDirectory = async (path: string | null = null) => {
    if (!window.electronAPI || !window.electronAPI.fileManager) {
      setError('API Electron non disponible. Assurez-vous que l\'application est lancée dans Electron.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.fileManager.listDirectory(path)
      if ('error' in result) {
        setError(result.error)
      } else {
        setItems(result.items)
        setCurrentPath(result.path)
      }
    } catch (err) {
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDirectory()
  }, [])

  // Ouvrir un dossier
  const openDirectory = (item: FileItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path)
    }
  }

  // Retour au dossier parent
  const goBack = () => {
    if (currentPath) {
      const parentPath = currentPath.split(/[/\\]/).slice(0, -1).join('/')
      loadDirectory(parentPath || null)
    }
  }

  // Créer un nouveau fichier ou dossier
  const handleCreate = async () => {
    if (!newItemName.trim() || !window.electronAPI) return

    try {
      let result
      if (createType === 'directory') {
        result = await window.electronAPI.fileManager.createDirectory(currentPath, newItemName)
      } else {
        result = await window.electronAPI.fileManager.createFile(currentPath, newItemName, '')
      }

      if ('error' in result) {
        setError(result.error)
      } else {
        setShowCreateDialog(false)
        setNewItemName('')
        loadDirectory(currentPath)
      }
    } catch (err) {
      setError('Erreur lors de la création')
    }
  }

  // Supprimer un élément
  const handleDelete = async (item: FileItem) => {
    if (!window.electronAPI || !confirm(`Supprimer "${item.name}" ?`)) return

    try {
      const result = await window.electronAPI.fileManager.deleteItem(item.path)
      if ('error' in result) {
        setError(result.error)
      } else {
        loadDirectory(currentPath)
      }
    } catch (err) {
      setError('Erreur lors de la suppression')
    }
  }

  // Renommer un élément
  const handleRename = async () => {
    if (!newName.trim() || !renameItem || !window.electronAPI) return

    try {
      const result = await window.electronAPI.fileManager.renameItem(renameItem.path, newName)
      if ('error' in result) {
        setError(result.error)
      } else {
        setShowRenameDialog(false)
        setRenameItem(null)
        setNewName('')
        loadDirectory(currentPath)
      }
    } catch (err) {
      setError('Erreur lors du renommage')
    }
  }

  // Ouvrir un fichier pour édition
  const handleOpenFile = async (item: FileItem) => {
    if (!item.isFile || !window.electronAPI) return

    try {
      const result = await window.electronAPI.fileManager.readFile(item.path)
      if ('error' in result) {
        setError(result.error)
      } else {
        setEditingFile(item)
        setFileContent(result.content)
        setHasUnsavedChanges(false)
      }
    } catch (err) {
      setError('Erreur lors de l\'ouverture du fichier')
    }
  }

  // Sauvegarder le fichier
  const handleSaveFile = useCallback(async () => {
    if (!editingFile || !window.electronAPI) return

    setIsSaving(true)
    try {
      const result = await window.electronAPI.fileManager.writeFile(editingFile.path, fileContent)
      if ('error' in result) {
        setError(result.error)
      } else {
        setHasUnsavedChanges(false)
        // Recharger la liste pour mettre à jour la date de modification
        loadDirectory(currentPath)
        alert('Fichier enregistré avec succès!')
      }
    } catch (err) {
      setError('Erreur lors de l\'enregistrement du fichier')
    } finally {
      setIsSaving(false)
    }
  }, [editingFile, fileContent, currentPath])

  // Fermer l'éditeur
  const handleCloseEditor = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer ?')) {
        return
      }
    }
    setEditingFile(null)
    setFileContent('')
    setHasUnsavedChanges(false)
  }

  // Raccourci clavier Ctrl+S pour sauvegarder
  useEffect(() => {
    if (!editingFile) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges) {
          handleSaveFile()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingFile, hasUnsavedChanges, handleSaveFile])

  // Formater la taille
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Gestionnaire de fichiers
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Dossier de base : <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">{basePath}</code>
          </p>
        </div>

        {/* Barre d'outils */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={goBack}
            disabled={!currentPath}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Retour
          </button>
          <button
            onClick={() => {
              setCreateType('directory')
              setShowCreateDialog(true)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            + Nouveau dossier
          </button>
          <button
            onClick={() => {
              setCreateType('file')
              setShowCreateDialog(true)
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            + Nouveau fichier
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            🔄 Actualiser
          </button>
        </div>

        {/* Chemin actuel */}
        {currentPath && (
          <div className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Chemin : <code className="bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">{currentPath || '/'}</code>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Liste des fichiers */}
        {loading ? (
          <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">Chargement...</div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-black dark:text-white">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-black dark:text-white">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-black dark:text-white">Taille</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-black dark:text-white">Modifié</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-black dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.path}
                    className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDirectory(item)}
                        className="flex items-center gap-2 text-left hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        {item.isDirectory ? (
                          <span className="text-2xl">📁</span>
                        ) : (
                          <span className="text-2xl">📄</span>
                        )}
                        <span className="font-medium text-black dark:text-white">{item.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.isDirectory ? 'Dossier' : 'Fichier'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {item.isFile ? formatSize(item.size) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {new Date(item.modified).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {item.isFile && (
                          <button
                            onClick={() => handleOpenFile(item)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Éditer
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRenameItem(item)
                            setNewName(item.name)
                            setShowRenameDialog(true)
                          }}
                          className="px-3 py-1 text-sm bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Renommer
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                      Dossier vide
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Dialog de création */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                Créer un {createType === 'directory' ? 'dossier' : 'fichier'}
              </h2>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={`Nom du ${createType === 'directory' ? 'dossier' : 'fichier'}`}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg mb-4 bg-white dark:bg-zinc-800 text-black dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setShowCreateDialog(false)
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateDialog(false)
                    setNewItemName('')
                  }}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dialog de renommage */}
        {showRenameDialog && renameItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-black dark:text-white mb-4">
                Renommer "{renameItem.name}"
              </h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nouveau nom"
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg mb-4 bg-white dark:bg-zinc-800 text-black dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') setShowRenameDialog(false)
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRenameDialog(false)
                    setRenameItem(null)
                    setNewName('')
                  }}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRename}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Renommer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Éditeur de fichier */}
        {editingFile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
              {/* Header de l'éditeur */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div>
                    <h2 className="text-xl font-bold text-black dark:text-white">
                      {editingFile.name}
                    </h2>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {editingFile.path}
                      {hasUnsavedChanges && (
                        <span className="ml-2 text-orange-500">● Modifications non enregistrées</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveFile}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        💾 Enregistrer
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCloseEditor}
                    className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700"
                  >
                    ✕ Fermer
                  </button>
                </div>
              </div>

              {/* Zone d'édition */}
              <div className="flex-1 overflow-hidden">
                <textarea
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  className="w-full h-full p-4 bg-white dark:bg-zinc-900 text-black dark:text-white border-0 focus:outline-none font-mono text-sm resize-none"
                  placeholder="Tapez votre texte ici..."
                  spellCheck={false}
                />
              </div>

              {/* Footer avec info */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <div>
                    {fileContent.length} caractères • {fileContent.split('\n').length} lignes
                  </div>
                  <div>
                    <kbd className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded text-xs">Ctrl+S</kbd> pour enregistrer
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

