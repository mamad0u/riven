'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileItem } from '@/electron.d'
import { ensureMdExtension } from '../lib/moduleInsert'

export interface Tab {
  id: string
  file: FileItem | null
  content: string
  fileName: string
  hasUnsavedChanges: boolean
  isUnsavedNewFile: boolean
  isEditingFileName: boolean
}

export function useEditorTabs() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t)))
  }, [])

  const openFile = useCallback(async (file: FileItem): Promise<string | null> => {
    if (!window.electronAPI) return null

    const existing = tabsRef.current.find((t) => t.file?.path === file.path && t.file.path !== '')
    if (existing) {
      setActiveTabId(existing.id)
      return existing.id
    }

    try {
      const result = await window.electronAPI.fileManager.readFile(file.path)
      if ('error' in result) return null

      // Re-check after await in case another open raced
      const raced = tabsRef.current.find((t) => t.file?.path === file.path && t.file.path !== '')
      if (raced) {
        setActiveTabId(raced.id)
        return raced.id
      }

      const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newTab: Tab = {
        id: tabId,
        file,
        content: result.content,
        fileName: file.name,
        hasUnsavedChanges: false,
        isUnsavedNewFile: false,
        isEditingFileName: false,
      }
      let resolvedId = tabId
      setTabs((prev) => {
        const again = prev.find((t) => t.file?.path === file.path && t.file.path !== '')
        if (again) {
          resolvedId = again.id
          return prev
        }
        return [...prev, newTab]
      })
      setActiveTabId(resolvedId)
      return resolvedId    } catch (err) {
      console.error(err)
      return null
    }
  }, [])

  const createNewTab = useCallback(() => {
    const defaultFileName = 'nouveau-fichier.md'
    const tabId = `tab-${Date.now()}`
    const virtualFile: FileItem = {
      name: defaultFileName,
      path: '',
      fullPath: '',
      isDirectory: false,
      isFile: true,
      size: 0,
      created: new Date(),
      modified: new Date(),
    }
    const newTab: Tab = {
      id: tabId,
      file: virtualFile,
      content: '',
      fileName: defaultFileName,
      hasUnsavedChanges: false,
      isUnsavedNewFile: true,
      isEditingFileName: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(tabId)
    return tabId
  }, [])

  const closeTab = useCallback((tabId: string): boolean => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return false
    if (tab.hasUnsavedChanges) {
      if (!confirm(`Modifications non enregistrées dans "${tab.fileName}". Fermer ?`)) return false
    }
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId) {
        const idx = prev.findIndex((t) => t.id === tabId)
        if (newTabs.length > 0) {
          const newIdx = idx < newTabs.length ? idx : newTabs.length - 1
          setActiveTabId(newTabs[newIdx].id)
        } else {
          setActiveTabId(null)
        }
      }
      return newTabs
    })
    return true
  }, [tabs, activeTabId])

  const closeTabsForPath = useCallback((filePath: string) => {
    setTabs((prev) => {
      const prefix = filePath.endsWith('/') ? filePath : `${filePath}/`
      const remaining = prev.filter((t) => {
        const p = t.file?.path
        if (!p) return true
        return p !== filePath && !p.startsWith(prefix)
      })
      if (remaining.length !== prev.length) {
        const stillActive = remaining.find((t) => t.id === activeTabId)
        if (!stillActive) {
          setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
        }
      }
      return remaining
    })
  }, [activeTabId])

  const updateTabFilePath = useCallback((oldPath: string, newPath: string) => {
    const newName = newPath.replace(/\\/g, '/').split('/').pop() || newPath
    setTabs((prev) =>
      prev.map((t) => {
        if (!t.file?.path) return t
        if (t.file.path === oldPath) {
          return {
            ...t,
            file: { ...t.file, path: newPath, fullPath: newPath, name: newName },
            fileName: newName,
          }
        }
        const prefix = oldPath.endsWith('/') ? oldPath : `${oldPath}/`
        if (t.file.path.startsWith(prefix)) {
          const remapped = newPath + t.file.path.slice(oldPath.length)
          const remappedName = remapped.replace(/\\/g, '/').split('/').pop() || remapped
          return {
            ...t,
            file: { ...t.file, path: remapped, fullPath: remapped, name: remappedName },
            fileName: remappedName,
          }
        }
        return t
      })
    )
  }, [])

  const saveFile = useCallback(async () => {
    if (!activeTab || !window.electronAPI) return
    const tab = activeTab
    const finalFileName = ensureMdExtension(tab.fileName.trim() || 'nouveau-fichier', {
      replaceTxt: tab.isUnsavedNewFile || !tab.file?.path,
    })
    setIsSaving(true)
    try {
      let filePath = tab.file?.path || ''
      let finalFile = tab.file

      if (tab.isUnsavedNewFile || !tab.file?.path) {
        const createResult = await window.electronAPI.fileManager.createFile(null, finalFileName, tab.content)
        if ('error' in createResult) { alert(createResult.error); return }
        filePath = createResult.path
        finalFile = {
          ...(tab.file || {} as FileItem),
          name: finalFileName,
          path: filePath,
          fullPath: filePath,
          isDirectory: false,
          isFile: true,
          size: tab.content.length,
          created: new Date(),
          modified: new Date(),
        }
        updateTab(tab.id, { file: finalFile, fileName: finalFileName, hasUnsavedChanges: false, isUnsavedNewFile: false, isEditingFileName: false })
      } else {
        if (tab.file.name !== finalFileName) {
          const renameResult = await window.electronAPI.fileManager.renameItem(tab.file.path, finalFileName)
          if ('error' in renameResult) { alert(renameResult.error); return }
          filePath = renameResult.newPath
          finalFile = { ...tab.file, name: finalFileName, path: filePath, fullPath: filePath }
          updateTab(tab.id, { file: finalFile, fileName: finalFileName, isEditingFileName: false })
        }
        const writeResult = await window.electronAPI.fileManager.writeFile(filePath, tab.content)
        if ('error' in writeResult) { alert(writeResult.error); return }
        updateTab(tab.id, { hasUnsavedChanges: false, isEditingFileName: false })
      }
    } catch {
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setIsSaving(false)
    }
  }, [activeTab, updateTab])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeTab && (activeTab.hasUnsavedChanges || activeTab.isUnsavedNewFile)) saveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, saveFile])

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    updateTab,
    openFile,
    createNewTab,
    closeTab,
    closeTabsForPath,
    updateTabFilePath,
    saveFile,
    isSaving,
  }
}
