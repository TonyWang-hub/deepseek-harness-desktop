function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Render a local, script-free Host failure page.
 *
 * @param {{detail: string, retryDelayMs?: number}} options
 */
export function createCrashPage({ detail, retryDelayMs }) {
  const action = retryDelayMs === undefined
    ? '<p><a href="dsh-desktop://retry">Retry</a> · <a href="dsh-desktop://quit">Quit</a></p>'
    : `<p>Restarting in ${retryDelayMs / 1000}s…</p>`
  const html = '<body style="background:#111;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">'
    + `<main><p>${escapeHtml(detail)}</p>${action}</main></body>`
  return `data:text/html,${encodeURIComponent(html)}`
}

/**
 * Handle the two local actions exposed by the script-free crash page.
 *
 * @param {{webContents: Electron.WebContents, getRecoveryUrl: () => string, retry: () => void, quit: () => void}} options
 */
export function installCrashActions({ webContents, getRecoveryUrl, retry, quit }) {
  webContents.on('will-navigate', (event, url) => {
    const recoveryUrl = getRecoveryUrl()
    if (!recoveryUrl || webContents.getURL() !== recoveryUrl) return
    if (url === 'dsh-desktop://retry') {
      event.preventDefault()
      retry()
    } else if (url === 'dsh-desktop://quit') {
      event.preventDefault()
      quit()
    }
  })
}

/**
 * Track Host exits and decide whether another automatic restart is safe.
 *
 * @param {{baseDelayMs: number, maxDelayMs: number, crashWindowMs: number, crashLimit: number}} options
 */
export function createCrashRecovery({ baseDelayMs, maxDelayMs, crashWindowMs, crashLimit }) {
  /** @type {number[]} */
  let exits = []
  const prune = now => {
    exits = exits.filter(timestamp => now - timestamp < crashWindowMs)
  }

  return {
    recordExit(now = Date.now()) {
      prune(now)
      exits.push(now)
      const crashCount = exits.length
      if (crashCount >= crashLimit) return { action: 'stop', crashCount }
      return {
        action: 'restart',
        delayMs: Math.min(baseDelayMs * (2 ** (crashCount - 1)), maxDelayMs),
        crashCount,
      }
    },
    count(now = Date.now()) {
      prune(now)
      return exits.length
    },
    reset() {
      exits = []
    },
  }
}
