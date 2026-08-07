const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const fssync = require('fs')

const TRASH_DIR = '.riven-trash'

let customBasePath = null

const getDefaultBasePath = () => {
  if (process.platform === 'win32') {
    return 'C:\\my-app'
  }
  return path.join(require('os').homedir(), 'my-app')
}

const getBasePath = () => {
  return customBasePath || getDefaultBasePath()
}

const setBasePath = (nextPath) => {
  if (!nextPath || typeof nextPath !== 'string') {
    throw new Error('Chemin invalide')
  }
  const resolved = path.resolve(nextPath)
  if (!fssync.existsSync(resolved)) {
    throw new Error('Le dossier n\'existe pas')
  }
  const stat = fssync.statSync(resolved)
  if (!stat.isDirectory()) {
    throw new Error('Le chemin n\'est pas un dossier')
  }
  customBasePath = resolved
  return resolved
}

const getTrashRoot = () => path.join(getBasePath(), TRASH_DIR)

/** Resolve a relative path under base and ensure it cannot escape. */
const resolveInsideBase = (relativePath = '') => {
  const basePath = getBasePath()
  const resolved = relativePath
    ? path.resolve(basePath, relativePath)
    : path.resolve(basePath)
  const rel = path.relative(basePath, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Chemin non autorisé')
  }
  return resolved
}

const assertInsideBase = (absolutePath) => {
  const basePath = getBasePath()
  const resolved = path.resolve(absolutePath)
  const rel = path.relative(basePath, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Chemin non autorisé')
  }
  return resolved
}

const isTrashEntry = (name, relativeFromBase) => {
  if (name === TRASH_DIR) return true
  const normalized = relativeFromBase.replace(/\\/g, '/')
  return normalized === TRASH_DIR || normalized.startsWith(`${TRASH_DIR}/`)
}

const toFileItem = async (fullPath, basePath) => {
  const stats = await fs.stat(fullPath)
  return {
    name: path.basename(fullPath),
    path: path.relative(basePath, fullPath),
    fullPath,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
  }
}

const initializeBaseDirectory = async () => {
  const basePath = getBasePath()
  await fs.mkdir(basePath, { recursive: true })
  await fs.mkdir(getTrashRoot(), { recursive: true })
  return basePath
}

const listDirectory = async (dirPath = null) => {
  try {
    const basePath = getBasePath()
    const targetPath = resolveInsideBase(dirPath || '')
    const items = await fs.readdir(targetPath, { withFileTypes: true })

    const result = []
    for (const item of items) {
      const fullPath = path.join(targetPath, item.name)
      const relativePath = path.relative(basePath, fullPath)
      if (isTrashEntry(item.name, relativePath)) continue
      result.push(await toFileItem(fullPath, basePath))
    }

    return {
      path: dirPath || '',
      items: result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      }),
    }
  } catch (error) {
    throw new Error(`Erreur lors de la lecture du dossier : ${error.message}`)
  }
}

const listAllFiles = async () => {
  try {
    const basePath = getBasePath()
    const collected = []

    const walk = async (dirAbs) => {
      let entries
      try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const fullPath = path.join(dirAbs, entry.name)
        const relativePath = path.relative(basePath, fullPath)
        if (isTrashEntry(entry.name, relativePath)) continue
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else if (entry.isFile()) {
          collected.push(await toFileItem(fullPath, basePath))
        }
      }
    }

    await walk(basePath)
    collected.sort((a, b) => a.name.localeCompare(b.name))
    return { items: collected }
  } catch (error) {
    throw new Error(`Erreur lors du listing des fichiers : ${error.message}`)
  }
}

const createDirectory = async (dirPath, name) => {
  try {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new Error('Nom de dossier invalide')
    }
    const basePath = getBasePath()
    const parentPath = resolveInsideBase(dirPath || '')
    const newDirPath = assertInsideBase(path.join(parentPath, name))
    await fs.mkdir(newDirPath, { recursive: true })
    return { success: true, path: path.relative(basePath, newDirPath) }
  } catch (error) {
    throw new Error(`Erreur lors de la création du dossier : ${error.message}`)
  }
}

const createFile = async (dirPath, name, content = '') => {
  try {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new Error('Nom de fichier invalide')
    }
    const basePath = getBasePath()
    const parentPath = resolveInsideBase(dirPath || '')
    const newFilePath = assertInsideBase(path.join(parentPath, name))
    await fs.writeFile(newFilePath, content, 'utf8')
    return { success: true, path: path.relative(basePath, newFilePath) }
  } catch (error) {
    throw new Error(`Erreur lors de la création du fichier : ${error.message}`)
  }
}

const readFile = async (filePath) => {
  try {
    const fullPath = resolveInsideBase(filePath)
    const content = await fs.readFile(fullPath, 'utf8')
    return { success: true, content }
  } catch (error) {
    throw new Error(`Erreur lors de la lecture du fichier : ${error.message}`)
  }
}

const writeFile = async (filePath, content) => {
  try {
    const fullPath = resolveInsideBase(filePath)
    await fs.writeFile(fullPath, content, 'utf8')
    return { success: true }
  } catch (error) {
    throw new Error(`Erreur lors de l'écriture du fichier : ${error.message}`)
  }
}

const deleteItem = async (itemPath) => {
  try {
    const fullPath = resolveInsideBase(itemPath)
    await fs.rm(fullPath, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    throw new Error(`Erreur lors de la suppression : ${error.message}`)
  }
}

const renameItem = async (itemPath, newName) => {
  try {
    if (!newName || newName.includes('/') || newName.includes('\\') || newName === '.' || newName === '..') {
      throw new Error('Nom invalide')
    }
    const basePath = getBasePath()
    const fullPath = resolveInsideBase(itemPath)
    const newFullPath = assertInsideBase(path.join(path.dirname(fullPath), newName))
    await fs.rename(fullPath, newFullPath)
    return { success: true, newPath: path.relative(basePath, newFullPath) }
  } catch (error) {
    throw new Error(`Erreur lors du renommage : ${error.message}`)
  }
}

const uniqueRestorePath = async (desiredRelativePath) => {
  const basePath = getBasePath()
  let candidate = desiredRelativePath
  let abs = path.join(basePath, candidate)
  if (!(await pathExists(abs))) return candidate

  const ext = path.extname(desiredRelativePath)
  const baseName = path.basename(desiredRelativePath, ext)
  const dir = path.dirname(desiredRelativePath)
  let i = 1
  while (true) {
    const nextName = `${baseName} (${i})${ext}`
    candidate = dir === '.' ? nextName : path.join(dir, nextName)
    abs = path.join(basePath, candidate)
    if (!(await pathExists(abs))) return candidate
    i += 1
  }
}

const pathExists = async (p) => {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

const moveToTrash = async (itemPath) => {
  try {
    const basePath = getBasePath()
    const fullPath = resolveInsideBase(itemPath)
    const relative = path.relative(basePath, fullPath)
    if (isTrashEntry(path.basename(fullPath), relative)) {
      throw new Error('Impossible de supprimer la poubelle')
    }

    const stats = await fs.stat(fullPath)
    const id = crypto.randomUUID()
    const trashEntryDir = path.join(getTrashRoot(), id)
    await fs.mkdir(trashEntryDir, { recursive: true })

    const contentDest = path.join(trashEntryDir, 'content')
    await fs.rename(fullPath, contentDest)

    const meta = {
      id,
      originalPath: relative.replace(/\\/g, '/'),
      name: path.basename(fullPath),
      deletedAt: new Date().toISOString(),
      isDirectory: stats.isDirectory(),
    }
    await fs.writeFile(path.join(trashEntryDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8')
    return { success: true, id }
  } catch (error) {
    throw new Error(`Erreur lors du déplacement vers la poubelle : ${error.message}`)
  }
}

const listTrash = async () => {
  try {
    const trashRoot = getTrashRoot()
    await fs.mkdir(trashRoot, { recursive: true })
    const entries = await fs.readdir(trashRoot, { withFileTypes: true })
    const items = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const metaPath = path.join(trashRoot, entry.name, 'meta.json')
      try {
        const raw = await fs.readFile(metaPath, 'utf8')
        const meta = JSON.parse(raw)
        items.push({
          id: meta.id || entry.name,
          name: meta.name,
          originalPath: meta.originalPath,
          deletedAt: meta.deletedAt,
          isDirectory: !!meta.isDirectory,
        })
      } catch {
        // skip broken entries
      }
    }

    items.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)))
    return { items }
  } catch (error) {
    throw new Error(`Erreur lors du listing de la poubelle : ${error.message}`)
  }
}

const restoreFromTrash = async (id) => {
  try {
    if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new Error('Id poubelle invalide')
    }
    const basePath = getBasePath()
    const trashEntryDir = path.join(getTrashRoot(), id)
    assertInsideBase(trashEntryDir)

    const metaPath = path.join(trashEntryDir, 'meta.json')
    const contentPath = path.join(trashEntryDir, 'content')
    const raw = await fs.readFile(metaPath, 'utf8')
    const meta = JSON.parse(raw)

    const desired = meta.originalPath.replace(/\//g, path.sep)
    const restoredRelative = await uniqueRestorePath(desired)
    const destAbs = resolveInsideBase(restoredRelative)

    await fs.mkdir(path.dirname(destAbs), { recursive: true })
    await fs.rename(contentPath, destAbs)
    await fs.rm(trashEntryDir, { recursive: true, force: true })

    return { success: true, restoredPath: path.relative(basePath, destAbs).replace(/\\/g, '/') }
  } catch (error) {
    throw new Error(`Erreur lors de la restauration : ${error.message}`)
  }
}

const purgeTrashItem = async (id) => {
  try {
    if (!id || id.includes('/') || id.includes('\\') || id.includes('..')) {
      throw new Error('Id poubelle invalide')
    }
    const trashEntryDir = path.join(getTrashRoot(), id)
    assertInsideBase(trashEntryDir)
    await fs.rm(trashEntryDir, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    throw new Error(`Erreur lors de la suppression définitive : ${error.message}`)
  }
}

const searchFiles = async (searchQuery) => {
  try {
    const basePath = getBasePath()
    const results = []
    const query = searchQuery.toLowerCase().trim()

    if (!query) {
      return { items: [] }
    }

    const searchRecursive = async (dirPath) => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true })

        for (const item of items) {
          const fullPath = path.join(dirPath, item.name)
          const relativePath = path.relative(basePath, fullPath)
          if (isTrashEntry(item.name, relativePath)) continue

          try {
            assertInsideBase(fullPath)
          } catch {
            continue
          }

          if (item.name.toLowerCase().includes(query)) {
            results.push(await toFileItem(fullPath, basePath))
          }

          if (item.isDirectory()) {
            await searchRecursive(fullPath)
          }
        }
      } catch (error) {
        console.error(`Erreur lors de la recherche dans ${dirPath}:`, error.message)
      }
    }

    await searchRecursive(basePath)

    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return { items: results }
  } catch (error) {
    throw new Error(`Erreur lors de la recherche : ${error.message}`)
  }
}

/** Copie un fichier externe dans le dossier de base (racine). */
const importExternalFile = async (absoluteSourcePath) => {
  const basePath = getBasePath()
  const name = path.basename(absoluteSourcePath)
  let destName = name
  let destPath = path.join(basePath, destName)
  let i = 1
  const ext = path.extname(name)
  const stem = path.basename(name, ext)
  while (fssync.existsSync(destPath)) {
    destName = `${stem} (${i})${ext}`
    destPath = path.join(basePath, destName)
    i += 1
  }
  await fs.copyFile(absoluteSourcePath, destPath)
  const relative = path.relative(basePath, destPath)
  return {
    success: true,
    path: relative,
    fullPath: destPath,
    name: destName,
  }
}

module.exports = {
  TRASH_DIR,
  initializeBaseDirectory,
  listDirectory,
  listAllFiles,
  createDirectory,
  createFile,
  readFile,
  writeFile,
  deleteItem,
  renameItem,
  moveToTrash,
  listTrash,
  restoreFromTrash,
  purgeTrashItem,
  getBasePath,
  setBasePath,
  getDefaultBasePath,
  searchFiles,
  importExternalFile,
}
