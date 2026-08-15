const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

function trustedOrigin(candidate, hostUrl) {
  if (!hostUrl) return false
  try {
    return new URL(candidate).origin === new URL(hostUrl).origin
  } catch {
    return false
  }
}

function openSafeExternal(url, openExternal) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return
  void openExternal(parsed.href).catch(error => console.error('Opening external URL failed:', error))
}

/**
 * Restrict one desktop window to its loopback app origin and the minimum web permission set.
 *
 * @param {{window: Electron.BrowserWindow, getHostUrl: () => string, openExternal: (url: string) => Promise<unknown>}} options
 * @returns {void}
 */
export function installWindowSecurity({ window, getHostUrl, openExternal }) {
  window.webContents.on('will-navigate', (event, url) => {
    if (trustedOrigin(url, getHostUrl())) return
    event.preventDefault()
    openSafeExternal(url, openExternal)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!trustedOrigin(url, getHostUrl())) openSafeExternal(url, openExternal)
    return { action: 'deny' }
  })

  const permissionAllowed = (permission, origin) => (
    ALLOWED_PERMISSIONS.has(permission) && trustedOrigin(origin, getHostUrl())
  )
  window.webContents.session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permissionAllowed(permission, details.requestingUrl))
  })
  window.webContents.session.setPermissionCheckHandler((_contents, permission, requestingOrigin) => (
    permissionAllowed(permission, requestingOrigin)
  ))
}
