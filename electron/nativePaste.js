// Logique native Windows (win32) de capture/restauration de focus et de
// collage externe, basée sur des scripts PowerShell temporaires invoquant
// l'API user32/kernel32, plus le handler IPC restore-focus-and-paste qui
// orchestre tout ça avec le contenu à coller.
// Extrait de main.js — même comportement, aucune logique modifiée.
//
// focusState est un objet partagé PAR RÉFÉRENCE avec main.js (toggleSidebar
// notamment). Il ne doit jamais être réassigné depuis ce module, seulement
// muté en place (focusState.xxx = ...), pour rester synchronisé avec main.js.

function createNativePaste({
  exec,
  execSync,
  fs,
  path,
  os,
  ipcMain,
  focusState,
  getMainWindow,
  getSidebarWindow,
  getCaptureWindow,
}) {
  // Fonction pour sauvegarder la fenêtre système active (Windows)
  const saveActiveWindow = () => {
    if (process.platform === 'win32') {
      console.log('Tentative de sauvegarde de la fenêtre active...')

      // Créer un script PowerShell temporaire
      const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@
$hwnd = [Win32]::GetForegroundWindow()
Write-Output $hwnd.ToInt64()
`

      const tempFile = path.join(os.tmpdir(), `electron-save-window-${Date.now()}.ps1`)

      fs.writeFileSync(tempFile, psScript, 'utf8')

      exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        // Nettoyer le fichier temporaire
        try {
          fs.unlinkSync(tempFile)
        } catch (e) {
          // Ignorer les erreurs de suppression
        }

        if (error) {
          console.error('Erreur lors de la sauvegarde de la fenêtre active:', error.message)
          if (stderr) {
            console.error('Stderr:', stderr.substring(0, 200))
          }
          return
        }

        if (stdout) {
          const trimmed = stdout.trim()
          console.log('Sortie PowerShell (raw):', trimmed)
          const handle = parseInt(trimmed)
          console.log('Handle parsé:', handle)

          if (!isNaN(handle) && handle !== 0) {
            focusState.lastActiveWindowHandle = handle
            console.log('✓ Fenêtre système active sauvegardée, handle:', handle)
          } else {
            console.log('✗ Handle invalide:', handle)
          }
        } else {
          console.log('✗ Aucune sortie de PowerShell')
        }
      })
    } else {
      console.log('Platform non-Windows, sauvegarde de fenêtre ignorée')
    }
  }

  // Fonction pour restaurer le focus sur la fenêtre système sauvegardée (Windows)
  const restoreActiveWindow = () => {
    if (process.platform === 'win32') {
      if (!focusState.lastActiveWindowHandle) {
        console.log('✗ Aucun handle de fenêtre sauvegardé, impossible de restaurer le focus')
        return
      }

      console.log('Tentative de restauration du focus sur handle:', focusState.lastActiveWindowHandle)

      const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
}
'@
$hwnd = New-Object IntPtr(${focusState.lastActiveWindowHandle})
if ([Win32]::IsWindow($hwnd)) {
  $result = [Win32]::SetForegroundWindow($hwnd)
  if ($result) {
    Write-Output "OK"
  } else {
    Write-Output "SETFOREGROUND_FAILED"
  }
} else {
  Write-Output "WINDOW_NOT_FOUND"
}
`

      const tempFile = path.join(os.tmpdir(), `electron-restore-window-${Date.now()}.ps1`)

      fs.writeFileSync(tempFile, psScript, 'utf8')

      exec(`powershell -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        // Nettoyer le fichier temporaire
        try {
          fs.unlinkSync(tempFile)
        } catch (e) {
          // Ignorer les erreurs de suppression
        }

        if (error) {
          console.error('Erreur lors de la restauration du focus:', error.message)
          if (stderr) {
            console.error('Stderr:', stderr.substring(0, 200))
          }
          return
        }

        if (stdout) {
          const result = stdout.trim()
          console.log('Résultat PowerShell:', result)
          if (result === 'OK') {
            console.log('✓ Focus restauré sur la fenêtre système, handle:', focusState.lastActiveWindowHandle)
          } else if (result === 'SETFOREGROUND_FAILED') {
            console.log('✗ SetForegroundWindow a échoué (peut nécessiter des permissions élevées)')
          } else {
            console.log('✗ La fenêtre système n\'existe plus ou ne peut pas être restaurée:', result)
            focusState.lastActiveWindowHandle = null
          }
        } else {
          console.log('✗ Aucune sortie de PowerShell lors de la restauration')
        }
      })
    } else {
      console.log('Platform non-Windows, restauration de focus ignorée')
    }
  }

  // Capture SYNCHRONE du HWND de la fenêtre active AVANT d'afficher l'overlay
  // (execSync bloque ~300-500ms mais c'est acceptable avant d'ouvrir l'overlay)
  const getForegroundWindowHandleSync = () => {
    if (process.platform !== 'win32') return null

    const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class HwndCapture {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@
[HwndCapture]::GetForegroundWindow().ToInt64()`

    const tempFile = path.join(os.tmpdir(), `hwnd-${Date.now()}.ps1`)
    try {
      fs.writeFileSync(tempFile, psScript, 'utf8')
      const result = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
        { timeout: 3000 }
      ).toString().trim()
      try { fs.unlinkSync(tempFile) } catch {}
      const handle = parseInt(result)
      if (!isNaN(handle) && handle !== 0) {
        console.log('✓ HWND capturé (sync):', handle)
        return handle
      }
    } catch (e) {
      try { fs.unlinkSync(tempFile) } catch {}
      console.error('Erreur capture HWND sync:', e.message)
    }
    return null
  }

  const getNativeHwnd = (win) => {
    if (!win || win.isDestroyed()) return null
    try {
      const buf = win.getNativeWindowHandle()
      if (buf.length >= 8) return Number(buf.readBigUInt64LE(0))
      return buf.readUInt32LE(0)
    } catch {
      return null
    }
  }

  const findElectronWindowByHwnd = (hwnd) => {
    if (!hwnd) return null
    for (const win of [getMainWindow(), getSidebarWindow(), getCaptureWindow()]) {
      if (getNativeHwnd(win) === hwnd) return win
    }
    return null
  }

  // Restaurer le focus sur une fenêtre externe et simuler Ctrl+V pour coller
  const pasteToExternalWindow = (hwnd) => {
    if (process.platform !== 'win32' || !hwnd) return

    console.log('Tentative de collage dans la fenêtre externe, handle:', hwnd)

    const psScript = `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FocusPaste {
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("kernel32.dll")]
  public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")]
  public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
$hwnd = New-Object IntPtr(${hwnd})
if (-not [FocusPaste]::IsWindow($hwnd)) {
  Write-Output "WINDOW_NOT_FOUND"
  exit
}
# AttachThreadInput : contourne la protection Windows contre le vol de focus
$targetPid = 0
$targetThread = [FocusPaste]::GetWindowThreadProcessId($hwnd, [ref]$targetPid)
$currentThread = [FocusPaste]::GetCurrentThreadId()
[FocusPaste]::AttachThreadInput($currentThread, $targetThread, $true)
[FocusPaste]::ShowWindow($hwnd, 9)
[FocusPaste]::BringWindowToTop($hwnd)
$ok = [FocusPaste]::SetForegroundWindow($hwnd)
[FocusPaste]::AttachThreadInput($currentThread, $targetThread, $false)
Start-Sleep -Milliseconds 150
# Simuler Ctrl+V dans la fenêtre qui a maintenant le focus
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^v")
if ($ok) { Write-Output "OK" } else { Write-Output "SETFOREGROUND_FAILED" }`

    const tempFile = path.join(os.tmpdir(), `paste-${Date.now()}.ps1`)
    fs.writeFileSync(tempFile, psScript, 'utf8')

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      try { fs.unlinkSync(tempFile) } catch {}
      if (error) {
        console.error('Erreur collage externe:', error.message)
        return
      }
      const result = stdout.trim()
      if (result === 'OK') {
        console.log('✓ Ctrl+V envoyé à la fenêtre externe, handle:', hwnd)
      } else if (result === 'SETFOREGROUND_FAILED') {
        console.log('✗ SetForegroundWindow a échoué (Ctrl+V peut quand même avoir fonctionné)')
      } else {
        console.log('✗ Résultat paste externe:', result)
      }
    })
  }

  // Handler pour restaurer le focus et coller
  ipcMain.on('restore-focus-and-paste', async (event, content) => {
    console.log('restore-focus-and-paste appelé avec:', content?.substring(0, 50) + '...')
    console.log('lastFocusedWindow:', focusState.lastFocusedWindow ? 'existe' : 'null')
    console.log('lastActiveElementInfo:', focusState.lastActiveElementInfo)
    console.log('lastActiveWindowHandle:', focusState.lastActiveWindowHandle)

    // Cas 1 : C'était une fenêtre Electron - on peut exécuter du JavaScript directement
    if (focusState.lastFocusedWindow && !focusState.lastFocusedWindow.isDestroyed()) {
      console.log('Cas 1 : Fenêtre Electron détectée, insertion directe du texte')
      focusState.lastFocusedWindow.focus()

      // Attendre que la fenêtre Electron reçoive le focus
      setTimeout(() => {
        if (focusState.lastFocusedWindow && !focusState.lastFocusedWindow.isDestroyed()) {
          // Vérifier que le document est chargé
          focusState.lastFocusedWindow.webContents.executeJavaScript('document.readyState').then((readyState) => {
            if (readyState !== 'complete') {
              console.log('Document pas encore chargé, attente...')
              return
            }

            // Étape 1 : Focus sur l'élémentmes 
            const focusScript = `
              (function() {
                try {
                  const savedInfo = ${JSON.stringify(focusState.lastActiveElementInfo || {})};
                  let targetElement = null;
                  
                  // Essayer de retrouver l'élément sauvegardé
                  if (savedInfo && savedInfo.tagName) {
                    if (savedInfo.id) {
                      targetElement = document.getElementById(savedInfo.id);
                    } else if (savedInfo.name) {
                      targetElement = document.querySelector(savedInfo.tagName.toLowerCase() + '[name="' + savedInfo.name + '"]');
                    } else if (savedInfo.className) {
                      // Ne pas utiliser les classes Tailwind dans le sélecteur car elles contiennent des caractères invalides (:)
                      // À la place, chercher tous les éléments du même type et vérifier manuellement les classes
                      const allElements = document.querySelectorAll(savedInfo.tagName.toLowerCase());
                      for (let i = 0; i < allElements.length; i++) {
                        const el = allElements[i];
                        // Vérifier si l'élément a le même type et les mêmes classes
                        if ((!savedInfo.type || el.type === savedInfo.type) &&
                            el.className === savedInfo.className) {
                          targetElement = el;
                          break;
                        }
                      }
                    }
                    
                    if (targetElement && (
                      targetElement.tagName !== savedInfo.tagName ||
                      (savedInfo.type && targetElement.type !== savedInfo.type)
                    )) {
                      targetElement = null;
                    }
                  }
                  
                  if (!targetElement) {
                    targetElement = document.activeElement;
                  }
                  
                  if (!targetElement || (
                    targetElement.tagName !== 'INPUT' && 
                    targetElement.tagName !== 'TEXTAREA' &&
                    !targetElement.isContentEditable
                  )) {
                    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, [contenteditable="true"]');
                    if (inputs.length > 0) {
                      for (let i = inputs.length - 1; i >= 0; i--) {
                        if (!inputs[i].disabled && !inputs[i].readOnly) {
                          targetElement = inputs[i];
                          break;
                        }
                      }
                    }
                  }
                  
                  if (targetElement) {
                    targetElement.focus();
                    return targetElement.tagName + (targetElement.id ? '#' + targetElement.id : '') + (targetElement.name ? '[name="' + targetElement.name + '"]' : '');
                  }
                  return null;
                } catch (error) {
                  console.error('Erreur dans focusScript:', error);
                  return 'ERROR: ' + error.message;
                }
              })();
            `

            focusState.lastFocusedWindow.webContents.executeJavaScript(focusScript).then((elementInfo) => {
              console.log('Élément ciblé:', elementInfo)

              if (elementInfo && elementInfo.startsWith('ERROR:')) {
                console.error('Erreur lors du focus:', elementInfo)
                return
              }

              // Étape 2 : Insérer le texte après un court délai
              setTimeout(() => {
                if (focusState.lastFocusedWindow && !focusState.lastFocusedWindow.isDestroyed()) {
                  const pasteScript = `
                    (function() {
                      try {
                        const textToPaste = ${JSON.stringify(content || '')};
                        const activeElement = document.activeElement;
                        
                        let targetElement = activeElement;
                        
                        // Si l'élément actif n'est pas un input, chercher le dernier input/textarea
                        if (!targetElement || (
                          targetElement.tagName !== 'INPUT' && 
                          targetElement.tagName !== 'TEXTAREA' &&
                          !targetElement.isContentEditable
                        )) {
                          const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, [contenteditable="true"]');
                          if (inputs.length > 0) {
                            for (let i = inputs.length - 1; i >= 0; i--) {
                              if (!inputs[i].disabled && !inputs[i].readOnly) {
                                targetElement = inputs[i];
                                break;
                              }
                            }
                          }
                        }
                        
                        if (targetElement) {
                          // S'assurer que l'élément a le focus
                          if (document.activeElement !== targetElement) {
                            targetElement.focus();
                          }
                          
                          // Insérer le texte selon le type d'élément
                          if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
                            const input = targetElement;
                            const start = input.selectionStart !== null ? input.selectionStart : input.value.length;
                            const end = input.selectionEnd !== null ? input.selectionEnd : input.value.length;
                            const value = input.value || '';
                            const newValue = value.substring(0, start) + textToPaste + value.substring(end);
                            
                            // Utiliser Object.getOwnPropertyDescriptor pour définir la valeur (pour React)
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set || 
                                                           Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                            
                            if (nativeInputValueSetter) {
                              nativeInputValueSetter.call(input, newValue);
                            } else {
                              input.value = newValue;
                            }
                            
                            // Définir la position du curseur
                            const newCursorPos = start + textToPaste.length;
                            try {
                              input.setSelectionRange(newCursorPos, newCursorPos);
                            } catch (e) {
                              // Ignorer les erreurs de sélection
                            }
                            
                            // Déclencher les événements pour que React/autres frameworks détectent le changement
                            try {
                              const inputEvent = new InputEvent('input', {
                                bubbles: true,
                                cancelable: true,
                                inputType: 'insertText',
                                data: textToPaste
                              });
                              input.dispatchEvent(inputEvent);
                            } catch (e) {
                              const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                              input.dispatchEvent(inputEvent);
                            }
                            
                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                            input.dispatchEvent(changeEvent);
                            
                            console.log('Texte collé dans input:', targetElement.tagName, newValue.substring(0, 50));
                            return true;
                          } else if (targetElement.isContentEditable) {
                            // Pour les éléments contenteditable
                            if (document.activeElement !== targetElement) {
                              targetElement.focus();
                            }
                            
                            const selection = window.getSelection();
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              range.deleteContents();
                              const textNode = document.createTextNode(textToPaste);
                              range.insertNode(textNode);
                              range.setStartAfter(textNode);
                              selection.removeAllRanges();
                              selection.addRange(range);
                              
                              targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                            } else {
                              targetElement.textContent = (targetElement.textContent || '') + textToPaste;
                              targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                            
                            console.log('Texte collé dans contenteditable');
                            return true;
                          }
                        }
                        
                        console.log('Aucun élément cible trouvé');
                        return false;
                      } catch (error) {
                        console.error('Erreur dans pasteScript:', error);
                        return 'ERROR: ' + error.message;
                      }
                    })();
                  `

                  focusState.lastFocusedWindow.webContents.executeJavaScript(pasteScript).then((result) => {
                    if (result && typeof result === 'string' && result.startsWith('ERROR:')) {
                      console.error('Erreur lors du collage:', result)
                    } else {
                      console.log('Texte collé, résultat:', result)
                    }
                  }).catch((err) => {
                    console.error('Erreur lors du collage:', err)
                  })
                }
              }, 200)
            }).catch((err) => {
              console.error('Erreur lors du focus:', err)
            })
          }).catch((err) => {
            console.error('Erreur lors de la vérification du document:', err)
          })
        }
      }, 500)
    } else if (focusState.lastActiveWindowHandle) {
      // Cas 2 : Fenêtre externe (navigateur, Cursor, Word, etc.)
      // Le contenu est déjà dans le presse-papier via copyToClipboard()
      // On restaure le focus + on simule Ctrl+V automatiquement
      console.log('Cas 2 : Collage automatique dans la fenêtre externe, handle:', focusState.lastActiveWindowHandle)
      pasteToExternalWindow(focusState.lastActiveWindowHandle)
    } else {
      console.log('Aucune fenêtre à restaurer')
    }
  })

  return {
    saveActiveWindow,
    restoreActiveWindow,
    getForegroundWindowHandleSync,
    findElectronWindowByHwnd,
    pasteToExternalWindow,
  }
}

module.exports = { createNativePaste }
