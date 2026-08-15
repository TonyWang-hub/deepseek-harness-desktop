import path from 'node:path'

/**
 * Locate the tray icon without coupling the desktop shell to one package layout.
 *
 * @param {{appPath: string, resourcesPath: string, isPackaged: boolean, platform: NodeJS.Platform}} options
 */
export function desktopIconPath({ appPath, resourcesPath, isPackaged, platform }) {
  if (!isPackaged) return path.join(appPath, 'build/icon-1024.png')
  if (platform === 'darwin') return path.join(resourcesPath, 'icon.icns')
  if (platform === 'win32') return path.join(resourcesPath, 'icon.ico')
  return path.join(resourcesPath, 'icon.png')
}

/**
 * Keep the single desktop window alive when the user closes it so the Host and
 * active sessions remain available from the tray.
 *
 * @param {{window: Electron.BrowserWindow, isQuitting: () => boolean}} options
 */
export function installWindowResidency({ window, isQuitting }) {
  window.on('close', event => {
    if (isQuitting()) return
    event.preventDefault()
    window.hide()
  })
}

/**
 * Restore or create the one application window and bring it to the foreground.
 *
 * @param {{getWindow: () => Electron.BrowserWindow | undefined, createWindow: () => Electron.BrowserWindow, platform: NodeJS.Platform, focusApp: () => void}} options
 */
export function showDesktopWindow({ getWindow, createWindow, platform, focusApp }) {
  const window = getWindow() ?? createWindow()
  if (window.isMinimized()) window.restore()
  window.show()
  if (platform === 'darwin') focusApp()
  window.focus()
}

function desktopMenuTemplate({ showWindow, quit }) {
  return [
    { label: 'Open', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: quit },
  ]
}

/**
 * Install the cross-platform tray menu and the matching macOS Dock menu.
 *
 * @param {{app: Electron.App, Menu: typeof Electron.Menu, Tray: typeof Electron.Tray, nativeImage: typeof Electron.nativeImage, platform: NodeJS.Platform, iconPath: string, showWindow: () => void, quit: () => void}} options
 */
export function installDesktopMenus({
  app,
  Menu,
  Tray,
  nativeImage,
  platform,
  iconPath,
  showWindow,
  quit,
}) {
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  if (platform === 'darwin') icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip('DeepSeek Harness Desktop')
  tray.setContextMenu(Menu.buildFromTemplate(desktopMenuTemplate({ showWindow, quit })))
  tray.on('click', showWindow)

  if (platform === 'darwin') {
    app.dock.setMenu(Menu.buildFromTemplate(desktopMenuTemplate({ showWindow, quit })))
  }
  return tray
}
