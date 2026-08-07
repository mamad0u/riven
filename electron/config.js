// Persistance de la config app (riven-config.json dans userData).
// Extrait de main.js — même comportement, aucune logique modifiée.

function createConfigStore({ app, path, fs }) {
  const configFilePath = () => path.join(app.getPath('userData'), 'riven-config.json')

  const loadAppConfig = () => {
    try {
      const raw = fs.readFileSync(configFilePath(), 'utf8')
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  const saveAppConfig = (config) => {
    try {
      fs.writeFileSync(configFilePath(), JSON.stringify(config, null, 2), 'utf8')
    } catch (err) {
      console.error('Erreur sauvegarde config:', err)
    }
  }

  return { loadAppConfig, saveAppConfig }
}

module.exports = { createConfigStore }
