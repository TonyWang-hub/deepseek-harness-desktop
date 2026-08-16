const scheduleNativeReadyFallback = handler => {
  const timer = setTimeout(handler, 10 * 60_000)
  timer.unref?.()
  return () => clearTimeout(timer)
}

function observeNativeUpdateReady(events) {
  let settled = false
  let resolveReady
  let rejectReady
  let cancelFallback = () => {}
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // The native error can arrive while checkForUpdates is still pending. Mark
  // the promise handled immediately; runAutoUpdateCheck still awaits and
  // reports the original rejection once transfer handling reaches it.
  void ready.catch(() => {})
  const cleanup = () => {
    cancelFallback()
    events.removeListener('update-downloaded', succeed)
    events.removeListener('error', fail)
  }
  const succeed = () => {
    if (settled) return
    settled = true
    cleanup()
    resolveReady()
  }
  const fail = error => {
    if (settled) return
    settled = true
    cleanup()
    rejectReady(error)
  }
  events.once('update-downloaded', succeed)
  events.once('error', fail)

  return {
    ready,
    armFallback(scheduleFallback) {
      if (settled) return
      const cancel = scheduleFallback(() => {
        fail(new Error('Timed out waiting for native updater readiness'))
      })
      if (settled) cancel()
      else cancelFallback = cancel
    },
    cancel() {
      if (settled) return
      settled = true
      cleanup()
      resolveReady()
    },
  }
}

/**
 * Check for a packaged-app update without making startup depend on the network.
 * On macOS, electron-updater's download promise only represents completion of
 * its local proxy response. Native Squirrel must separately emit
 * update-downloaded before the update is exposed as installable.
 *
 * @param {{isPackaged: boolean, isSmoke: boolean, checkForUpdates: () => Promise<{updateInfo: unknown, downloadPromise?: Promise<unknown>} | null>, notifyDownloaded: (updateInfo: unknown) => void, reportError: (error: unknown) => void, nativeUpdateEvents?: NodeJS.EventEmitter, scheduleNativeReadyFallback?: (handler: () => void) => () => void}} options
 * @returns {Promise<boolean>} whether the update check completed successfully
 */
export async function runAutoUpdateCheck({
  isPackaged,
  isSmoke,
  checkForUpdates,
  notifyDownloaded,
  reportError,
  nativeUpdateEvents,
  scheduleNativeReadyFallback: scheduleReadyFallback = scheduleNativeReadyFallback,
}) {
  if (!isPackaged || isSmoke) return false
  const nativeReady = nativeUpdateEvents
    ? observeNativeUpdateReady(nativeUpdateEvents)
    : undefined
  try {
    const result = await checkForUpdates()
    if (result?.downloadPromise) {
      await result.downloadPromise
      if (nativeReady) {
        nativeReady.armFallback(scheduleReadyFallback)
        await nativeReady.ready
      }
      notifyDownloaded(result.updateInfo)
    }
    nativeReady?.cancel()
    return true
  } catch (error) {
    nativeReady?.cancel()
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
