/**
 * Check for a packaged-app update without making startup depend on the network.
 *
 * @param {{isPackaged: boolean, isSmoke: boolean, checkForUpdates: () => Promise<{updateInfo: unknown, downloadPromise?: Promise<unknown>} | null>, notifyDownloaded: (updateInfo: unknown) => void, reportError: (error: unknown) => void}} options
 * @returns {Promise<boolean>} whether the update check completed successfully
 */
export async function runAutoUpdateCheck({
  isPackaged,
  isSmoke,
  checkForUpdates,
  notifyDownloaded,
  reportError,
}) {
  if (!isPackaged || isSmoke) return false
  try {
    const result = await checkForUpdates()
    if (result?.downloadPromise) {
      await result.downloadPromise
      notifyDownloaded(result.updateInfo)
    }
    return true
  } catch (error) {
    reportError(error)
    return false
  }
}

const scheduleInstallFallback = handler => {
  const timer = setTimeout(handler, 5 * 60_000)
  timer.unref?.()
  return () => clearTimeout(timer)
}

/**
 * Complete an already requested app quit after Host shutdown.
 * A downloaded macOS update may still be moving from electron-updater's cache
 * into native Squirrel. Keep ordinary quits blocked until Electron emits its
 * explicit before-quit-for-update authorization; fall back to a safe quit on
 * an updater error or a bounded readiness timeout.
 *
 * @param {{updateDownloaded: boolean, quitAndInstall: () => void, authorizeQuit: () => void, quit: () => void, reportError: (error: unknown) => void, updateEvents?: NodeJS.EventEmitter, nativeUpdateEvents?: NodeJS.EventEmitter, scheduleFallback?: (handler: () => void) => () => void}} options
 * @returns {'install-update' | 'quit'}
 */
export function quitAfterHostStop({
  updateDownloaded,
  quitAndInstall,
  authorizeQuit,
  quit,
  reportError,
  updateEvents,
  nativeUpdateEvents,
  scheduleFallback = scheduleInstallFallback,
}) {
  if (!updateDownloaded) {
    authorizeQuit()
    quit()
    return 'quit'
  }

  let settled = false
  let cancelFallback = () => {}
  const cleanup = () => {
    cancelFallback()
    nativeUpdateEvents.removeListener('before-quit-for-update', allowUpdateQuit)
    updateEvents.removeListener('error', failAndQuit)
  }
  const allowUpdateQuit = () => {
    if (settled) return
    settled = true
    cleanup()
    authorizeQuit()
  }
  const failAndQuit = error => {
    if (settled) return
    settled = true
    cleanup()
    reportError(error)
    authorizeQuit()
    quit()
  }

  nativeUpdateEvents.once('before-quit-for-update', allowUpdateQuit)
  updateEvents.once('error', failAndQuit)
  cancelFallback = scheduleFallback(() => {
    failAndQuit(new Error('Timed out waiting for the native updater to authorize quit'))
  })
  try {
    quitAndInstall()
    return 'install-update'
  } catch (error) {
    failAndQuit(error)
    return 'quit'
  }
}
