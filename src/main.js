/**
 * DeepSeek Harness Desktop — Electron main process (the whole v0.1 product).
 *
 * Supervises one official dsh host (`dsh web`, OS-assigned port) and presents
 * its Web UI in one BrowserWindow. The payload is the pinned, unmodified
 * `@deepseek-ai/dsh` npm release; this file owns only lifecycle: spawn,
 * readiness, restart with backoff, teardown, single instance, and a headless
 * `--smoke` acceptance mode (readiness + page load ⇒ exit 0).
 *
 * The host runs on Electron's bundled Node via ELECTRON_RUN_AS_NODE, so users
 * install nothing. If a native-addon ABI mismatch ever surfaces, set
 * DSH_DESKTOP_NODE=/path/to/node to run the host on an external runtime
 * instead — the smoke run is where such a mismatch shows up first.
 */
import { app, BrowserWindow, Notification, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { createHostEnvironment } from './host-environment.js'
import { terminateChild } from './host-lifecycle.js'
import { runAutoUpdateCheck } from './updater.js'
import { installWindowSecurity } from './window-security.js'

const require = createRequire(import.meta.url)
const { autoUpdater } = electronUpdater
const reportUpdateError = error => console.error('Auto-update failed:', error)
autoUpdater.on('error', reportUpdateError)

/** Absolute path of the pinned payload's CLI entry (resolved, never guessed; the package ships no exports map, so the classic subpath applies). */
const DSH_BIN = require.resolve('@deepseek-ai/dsh/lib/bin.js')
/** Clears Electron's Node-mode marker before the official host loads or spawns user commands. */
const HOST_BOOTSTRAP = fileURLToPath(new URL('./host-bootstrap.js', import.meta.url))

/** Matches the host's readiness line, e.g. `dsh web: http://127.0.0.1:52144`. */
const READY_LINE = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/

const SMOKE = process.argv.includes('--smoke')
/** SIGTERM → SIGKILL escalation window for host teardown, ms. */
const KILL_TIMEOUT_MS = 5000
/** Host crash restart backoff: base, factor 2, cap — resets on readiness. */
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 10_000

/** @type {import('node:child_process').ChildProcess | undefined} */
let host
/** @type {BrowserWindow | undefined} */
let win
let hostUrl = ''
let backoffMs = BACKOFF_BASE_MS
let quitting = false
let quitReady = false
let quitPromise
let hostStopPromise

/** Minimal splash shown until the host's readiness line arrives. */
const SPLASH = 'data:text/html,' + encodeURIComponent(
  '<body style="background:#111;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">'
  + '<div>Starting DeepSeek Harness…</div></body>')

/**
 * Spawn the pinned host and resolve its serving URL from the readiness line.
 * Crash-restarts with capped exponential backoff until the app quits.
 */
function startHost() {
  const nodeOverride = process.env.DSH_DESKTOP_NODE
  const cmd = nodeOverride || process.execPath
  const args = ['--expose-internals', HOST_BOOTSTRAP, DSH_BIN, 'web', '--port', '0']
  const env = createHostEnvironment({
    appPath: app.getAppPath(),
    electronPath: process.execPath,
    baseEnv: process.env,
    nodeOverride,
  })
  env.HARNESS_DESKTOP_PARENT_FD = '3'
  host = spawn(cmd, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  })
  let sawReady = false

  const onLine = (/** @type {Buffer} */ chunk) => {
    const text = chunk.toString()
    if (!SMOKE) process.stdout.write(text)
    const m = READY_LINE.exec(text)
    if (m && !sawReady) {
      sawReady = true
      backoffMs = BACKOFF_BASE_MS
      hostUrl = m[1]
      void win?.loadURL(hostUrl)
    }
  }
  host.stdout?.on('data', onLine)
  host.stderr?.on('data', onLine)

  host.on('exit', (code, signal) => {
    host = undefined
    if (quitting) return
    if (SMOKE) {
      console.error(`SMOKE FAIL: host exited early (code ${code}, signal ${signal})`)
      app.exit(1)
      return
    }
    const wait = backoffMs
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS)
    const detail = `The host stopped unexpectedly (code ${code ?? 'null'}, signal ${signal ?? 'null'}). Restarting in ${wait / 1000}s…`
    const restartPage = 'data:text/html,' + encodeURIComponent(
      '<body style="background:#111;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">'
      + `<div>${detail}</div></body>`)
    win?.loadURL(restartPage).catch(() => {})
    setTimeout(() => { if (!quitting) startHost() }, wait)
  })
}

/** SIGTERM the host, await exit, and escalate to SIGKILL after {@link KILL_TIMEOUT_MS}. */
function stopHost() {
  if (hostStopPromise) return hostStopPromise
  const h = host
  if (!h) return Promise.resolve()
  host = undefined
  hostStopPromise = terminateChild(h, { graceMs: KILL_TIMEOUT_MS })
    .finally(() => { hostStopPromise = undefined })
  return hostStopPromise
}

function exitAfterHost(code) {
  if (quitPromise) return quitPromise
  quitting = true
  quitPromise = stopHost()
    .catch(error => console.error('Host shutdown failed:', error))
    .then(() => app.exit(code))
  return quitPromise
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    show: !SMOKE,
    backgroundColor: '#111111',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  installWindowSecurity({
    window: win,
    getHostUrl: () => hostUrl,
    openExternal: url => shell.openExternal(url),
  })
  win.on('closed', () => { win = undefined })
  win.webContents.on('did-finish-load', () => {
    if (SMOKE && hostUrl && win?.webContents.getURL().startsWith(hostUrl)) {
      console.log('SMOKE OK', hostUrl)
      void exitAfterHost(0)
    }
  })
  void win.loadURL(hostUrl || SPLASH)
}

const lock = app.requestSingleInstanceLock()
if (!lock) {
  if (SMOKE) console.error('SMOKE FAIL: another instance is already running')
  process.exit(SMOKE ? 1 : 0)
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    if (process.platform === 'darwin') app.focus({ steal: true })
    win.focus()
  })
  app.whenReady().then(() => {
    startHost()
    createWindow()
    void runAutoUpdateCheck({
      isPackaged: app.isPackaged,
      isSmoke: SMOKE,
      checkForUpdates: () => autoUpdater.checkForUpdates(),
      notifyDownloaded: updateInfo => {
        if (!Notification.isSupported()) return
        new Notification({
          title: 'A new update is ready to install',
          body: `DeepSeek Harness Desktop ${updateInfo.version} will be installed on exit.`,
        }).show()
      },
      reportError: reportUpdateError,
    })
    if (SMOKE) setTimeout(() => {
      console.error('SMOKE FAIL: timeout')
      void exitAfterHost(1)
    }, 90_000)
  })
  app.on('window-all-closed', () => {
    app.quit()
  })
  app.on('before-quit', event => {
    if (quitReady) return
    event.preventDefault()
    quitting = true
    if (quitPromise) return
    quitPromise = stopHost()
      .catch(error => console.error('Host shutdown failed:', error))
      .then(() => {
        quitReady = true
        app.quit()
      })
  })
}
