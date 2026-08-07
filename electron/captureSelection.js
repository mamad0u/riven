const { clipboard } = require('electron')

const VK_SHIFT = 0x10
const VK_CONTROL = 0x11
const VK_MENU = 0x12
const VK_C = 0x43
const KEYEVENTF_KEYUP = 0x0002
const WM_COPY = 0x0301

let winApi = null

function loadWinApi() {
  if (winApi !== null) return winApi
  if (process.platform !== 'win32') {
    winApi = false
    return null
  }

  try {
    const koffi = require('koffi')
    const user32 = koffi.load('user32.dll')

    winApi = {
      koffi,
      GetForegroundWindow: user32.func('GetForegroundWindow', 'uintptr', []),
      SetForegroundWindow: user32.func('SetForegroundWindow', 'bool', ['uintptr']),
      IsWindow: user32.func('IsWindow', 'bool', ['uintptr']),
      BringWindowToTop: user32.func('BringWindowToTop', 'bool', ['uintptr']),
      ShowWindow: user32.func('ShowWindow', 'bool', ['uintptr', 'int']),
      GetAsyncKeyState: user32.func('GetAsyncKeyState', 'int16', ['int']),
      SendMessage: user32.func('SendMessageW', 'intptr', ['uintptr', 'uint32', 'uintptr', 'intptr']),
      keybd_event: user32.func('keybd_event', 'void', ['uint8', 'uint8', 'uint32', 'uintptr']),
    }
    console.log('→ Win32 capture native (koffi) chargée')
    return winApi
  } catch (e) {
    console.error('→ Impossible de charger koffi/user32:', e.message)
    winApi = false
    return null
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function toHwnd(v) {
  if (v == null) return 0
  if (typeof v === 'bigint') return Number(v)
  return Number(v) || 0
}

function isKeyDown(api, vk) {
  return (api.GetAsyncKeyState(vk) & 0x8000) !== 0
}

async function waitModifiersReleased(api, maxMs = 300) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (!isKeyDown(api, VK_MENU) && !isKeyDown(api, VK_SHIFT) && !isKeyDown(api, VK_CONTROL)) {
      return true
    }
    await sleep(12)
  }
  return false
}

function getForegroundHwndFast() {
  const api = loadWinApi()
  if (!api) return null
  try {
    return toHwnd(api.GetForegroundWindow()) || null
  } catch (e) {
    console.error('GetForegroundWindow failed:', e.message)
    return null
  }
}

async function pollClipboardUntilChanged(marker, maxMs = 300) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const now = clipboard.readText() || ''
    if (now && now !== marker) return now
    await sleep(16)
  }
  const finalText = clipboard.readText() || ''
  return finalText && finalText !== marker ? finalText : ''
}

/**
 * Capture rapide sans PowerShell. Appeler AVANT d'afficher Riven.
 */
async function captureSelectedTextFast(findElectronWindow) {
  const previous = clipboard.readText() || ''

  if (process.platform !== 'win32') {
    return previous
  }

  const api = loadWinApi()
  const hwnd = getForegroundHwndFast()
  console.log('→ HWND foreground (native):', hwnd)

  if (hwnd && findElectronWindow) {
    const electronWin = findElectronWindow(hwnd)
    if (electronWin) {
      try {
        const text = await electronWin.webContents.executeJavaScript(`
          (function() {
            const sel = window.getSelection && window.getSelection();
            if (sel && sel.toString()) return sel.toString();
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && typeof el.selectionStart === 'number') {
              return el.value.substring(el.selectionStart, el.selectionEnd);
            }
            return '';
          })()
        `)
        if (typeof text === 'string' && text.trim()) {
          try {
            clipboard.writeText(text)
          } catch {}
          return text
        }
      } catch (e) {
        console.error('Erreur sélection Electron:', e.message)
      }
    }
  }

  if (!api || !hwnd) {
    return previous.trim() ? previous : ''
  }

  await waitModifiersReleased(api, 280)
  await sleep(20)

  if (!api.IsWindow(hwnd)) {
    return previous.trim() ? previous : ''
  }

  try {
    api.ShowWindow(hwnd, 9)
    api.BringWindowToTop(hwnd)
    api.SetForegroundWindow(hwnd)
  } catch (e) {
    console.error('focus externe failed:', e.message)
  }
  await sleep(30)

  const marker = `__riven_${Date.now()}__`
  try {
    clipboard.writeText(marker)
  } catch {
    clipboard.clear()
  }

  try {
    api.SendMessage(hwnd, WM_COPY, 0, 0)
  } catch (e) {
    console.error('WM_COPY failed:', e.message)
  }

  let text = await pollClipboardUntilChanged(marker, 160)

  if (!text) {
    try {
      api.keybd_event(VK_CONTROL, 0, 0, 0)
      api.keybd_event(VK_C, 0, 0, 0)
      api.keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0)
      api.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
    } catch (e) {
      console.error('keybd_event failed:', e.message)
    }
    text = await pollClipboardUntilChanged(marker, 280)
  }

  if (text) {
    console.log('→ capture native OK (longueur):', text.length)
    return text
  }

  if (previous.trim() && previous !== marker) {
    try {
      clipboard.writeText(previous)
    } catch {}
    console.log('→ fallback presse-papier (longueur):', previous.length)
    return previous
  }

  try {
    if ((clipboard.readText() || '') === marker) clipboard.clear()
  } catch {}

  console.log('→ capture native vide')
  return ''
}

function captureSelectedTextWithTimeout(findElectronWindow, ms = 800) {
  let settled = false
  return Promise.race([
    captureSelectedTextFast(findElectronWindow).then((t) => {
      settled = true
      return t || ''
    }),
    new Promise((resolve) => {
      setTimeout(() => {
        if (!settled) {
          console.warn('Timeout capture rapide après', ms, 'ms')
          const clip = clipboard.readText() || ''
          resolve(clip.startsWith('__riven_') ? '' : clip)
        }
      }, ms)
    }),
  ])
}

module.exports = {
  getForegroundHwndFast,
  captureSelectedTextFast,
  captureSelectedTextWithTimeout,
  loadWinApi,
}
