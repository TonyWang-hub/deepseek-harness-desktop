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
