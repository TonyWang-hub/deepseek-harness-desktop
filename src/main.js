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
import {
  app,
  autoUpdater as nativeAutoUpdater,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  net as electronNet,
  Notification,
  powerMonitor,
  shell,
  Tray,
} from 'electron'
import electronUpdater from 'electron-updater'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { release as osRelease } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { installAcceptanceControl } from './acceptance-control.js'
import {
  createConnectionRecovery,
  installMacConnectionRecovery,
} from './connection-recovery.js'
import {
  createCrashPage,
  createCrashRecovery,
  installCrashActions,
} from './crash-recovery.js'
import {
  buildDiagnosticReport,
  checkRuntimeTools,
  saveDiagnosticReport,
} from './diagnostics.js'
import { createDesktopState } from './desktop-state.js'
import {
  desktopIconPath,
  installDesktopMenus,
  installWindowResidency,
  showDesktopWindow,
} from './desktop-shell.js'
import { hostArguments } from './host-command.js'
import { observeHostFailure } from './host-failure.js'
import { createHostReadinessParser } from './host-readiness.js'
import { createHostEnvironment } from './host-environment.js'
import { terminateChild } from './host-lifecycle.js'
import { quitAfterHostStop, runAutoUpdateCheck } from './updater.js'
import { installWindowSecurity } from './window-security.js'

const require = createRequire(import.meta.url)
const { autoUpdater } = electronUpdater
const reportUpdateError = error => console.error('Auto-update failed:', error)
autoUpdater.on('error', reportUpdateError)

/** Absolute path of the pinned payload's CLI entry (resolved, never guessed; the package ships no exports map, so the classic subpath applies). */
const DSH_BIN = require.resolve('@deepseek-ai/dsh/lib/bin.js')
const DSH_VERSION = require('@deepseek-ai/dsh/package.json').version
/** Clears Electron's Node-mode marker before the official host loads or spawns user commands. */
const HOST_BOOTSTRAP = fileURLToPath(new URL('./host-bootstrap.js', import.meta.url))

/** Matches the host's readiness line, e.g. `dsh web: http://127.0.0.1:52144`. */
const READY_LINE = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/

const SMOKE = process.argv.includes('--smoke')
const FIXTURE_PARITY = process.argv.includes('--fixture-parity')
const FIXTURE_PARITY_PATCH = fileURLToPath(new URL('../fixtures/parity/cordis.patch.yml', import.meta.url))
/** SIGTERM → SIGKILL escalation window for host teardown, ms. */
const KILL_TIMEOUT_MS = 5000
/** Host crash circuit: stop after three exits inside one minute. */
const crashRecovery = createCrashRecovery({
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  crashWindowMs: 60_000,
  crashLimit: 3,
})
const desktopState = createDesktopState()
desktopState.subscribe(snapshot => console.log(`Desktop state: ${snapshot.name}`))

/** @type {import('node:child_process').ChildProcess | undefined} */
let host
/** @type {BrowserWindow | undefined} */
let win
/** @type {Tray | undefined} */
let tray
let acceptanceControl
let hostUrl = ''
let recoveryPageUrl = ''
let restartTimer
let quitting = false
let quitReady = false
let quitPromise
let hostStopPromise
let removeMacConnectionRecovery
let acceptanceOnlineOverride
let acceptanceForceProbeFailure = false
let pageLoadCount = 0
let downloadedUpdateVersion

function currentReadyTransition() {
  return downloadedUpdateVersion
    ? { name: 'updating', detail: { version: downloadedUpdateVersion } }
    : { name: 'ready' }
}

function transitionDesktopReady() {
  const next = currentReadyTransition()
  desktopState.transition(next.name, next.detail)
}

/** Minimal splash shown until the host's readiness line arrives. */
const SPLASH = 'data:text/html,' + encodeURIComponent(
  '<body style="background:#111;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">'
  + '<div>Starting DeepSeek Harness…</div></body>')

/**
 * Spawn the pinned host and resolve its serving URL from the readiness line.
 * Crash-restarts with capped exponential backoff until the recovery circuit opens.
 */
function startHost() {
  if (quitting || host) return
  const nodeOverride = process.env.DSH_DESKTOP_NODE
  const cmd = nodeOverride || process.execPath
  const args = hostArguments({
    bootstrap: HOST_BOOTSTRAP,
    dshBin: DSH_BIN,
    patchFiles: FIXTURE_PARITY ? [FIXTURE_PARITY_PATCH] : [],
  })
  const env = createHostEnvironment({
    appPath: app.getAppPath(),
    electronPath: process.execPath,
    baseEnv: process.env,
    nodeOverride,
  })
  env.HARNESS_DESKTOP_PARENT_FD = '3'
  const startedHost = spawn(cmd, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
  })
  host = startedHost
  let sawReady = false
  const onReady = url => {
    if (sawReady || quitting || host !== startedHost) return
    sawReady = true
    hostUrl = url
    recoveryPageUrl = ''
    transitionDesktopReady()
    void win?.loadURL(hostUrl)
  }
  const createParser = () => createHostReadinessParser({
    pattern: READY_LINE,
    writeOutput: text => { if (!SMOKE) process.stdout.write(text) },
    onReady,
  })
  const stdoutParser = createParser()
  const stderrParser = createParser()
  startedHost.stdout?.on('data', chunk => stdoutParser.push(chunk))
  startedHost.stderr?.on('data', chunk => stderrParser.push(chunk))

  observeHostFailure(startedHost, failure => {
    if (host !== startedHost) return
    host = undefined
    if (quitting) return
    if (failure.kind === 'error') {
      console.error(`Host launch failed: ${failure.code ?? 'unknown'}`)
    }
    if (SMOKE) {
      const reason = failure.kind === 'error'
        ? `spawn error ${failure.code ?? 'unknown'}`
        : `code ${failure.code}, signal ${failure.signal}`
      console.error(`SMOKE FAIL: host exited early (${reason})`)
      app.exit(1)
      return
    }
    const decision = crashRecovery.recordExit()
    const detail = failure.kind === 'error'
      ? 'The host process could not start.'
      : `The host stopped unexpectedly (code ${failure.code ?? 'null'}, signal ${failure.signal ?? 'null'}).`
    if (decision.action === 'stop') {
      desktopState.transition('circuit-open', { crashCount: decision.crashCount })
      console.error(`Host recovery circuit opened after ${decision.crashCount} failures`)
      const pageUrl = createCrashPage({ detail })
      recoveryPageUrl = pageUrl
      win?.loadURL(pageUrl).catch(() => {
        if (recoveryPageUrl === pageUrl) recoveryPageUrl = ''
      })
      return
    }
    desktopState.transition('recovering', { retryDelayMs: decision.delayMs })
    win?.loadURL(createCrashPage({ detail, retryDelayMs: decision.delayMs })).catch(() => {})
    restartTimer = setTimeout(() => {
      restartTimer = undefined
      if (!quitting) startHost()
    }, decision.delayMs)
  })
}

function retryHost() {
  if (quitting || host) return
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = undefined
  recoveryPageUrl = ''
  crashRecovery.reset()
  desktopState.transition('recovering', { reason: 'manual-retry' })
  startHost()
}

/** SIGTERM the host, await exit, and escalate to SIGKILL after {@link KILL_TIMEOUT_MS}. */
function stopHost() {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = undefined
  if (hostStopPromise) return hostStopPromise
  const h = host
  if (!h) return Promise.resolve()
  host = undefined
  hostStopPromise = terminateChild(h, { graceMs: KILL_TIMEOUT_MS })
    .finally(() => { hostStopPromise = undefined })
  return hostStopPromise
}

function currentHostTarget() {
  return host?.pid && hostUrl ? { child: host, url: hostUrl } : undefined
}

function isCurrentHostTarget(target) {
  return host === target.child && hostUrl === target.url
}

async function probeCurrentHost(target) {
  if (acceptanceForceProbeFailure) {
    acceptanceForceProbeFailure = false
    return false
  }
  const response = await electronNet.fetch(target.url, { signal: AbortSignal.timeout(3000) })
  return response.ok
}

async function reloadCurrentPage(target) {
  if (win && isCurrentHostTarget(target)) await win.loadURL(target.url)
}

async function restartUnhealthyHost(target) {
  if (quitting || desktopState.get().name === 'circuit-open' || !isCurrentHostTarget(target)) return
  hostUrl = ''
  recoveryPageUrl = ''
  await stopHost()
  if (!quitting) startHost()
}

async function createCurrentDiagnosticReport() {
  const appRoot = app.getAppPath()
  const executableSuffix = process.platform === 'win32' ? '.exe' : ''
  const tools = await checkRuntimeTools([
    { name: 'electron-node', path: process.execPath, mode: 'executable' },
    { name: 'desktop-node-launcher', path: path.join(appRoot, `bin/node${executableSuffix}`), mode: 'executable' },
    { name: 'desktop-pnpm-launcher', path: path.join(appRoot, `bin/pnpm${process.platform === 'win32' ? '.cmd' : ''}`), mode: 'executable' },
    { name: 'official-dsh', path: DSH_BIN, mode: 'readable' },
    { name: 'host-bootstrap', path: HOST_BOOTSTRAP, mode: 'readable' },
  ])
  const parsedPort = hostUrl ? Number(new URL(hostUrl).port) : undefined
  const state = desktopState.get()
  return buildDiagnosticReport({
    application: {
      version: app.getVersion(),
      packaged: app.isPackaged,
      payloadVersion: DSH_VERSION,
    },
    system: {
      platform: process.platform,
      release: osRelease(),
      arch: process.arch,
      electron: process.versions.electron,
      node: process.versions.node,
    },
    desktop: {
      state,
      hostRunning: Boolean(host?.pid),
      hostPid: host?.pid,
      hostPort: Number.isInteger(parsedPort) ? parsedPort : undefined,
      dshHomeConfigured: Boolean(process.env.DSH_HOME),
      updateReady: Boolean(downloadedUpdateVersion),
    },
    tools,
  })
}

async function exportCurrentDiagnostics() {
  const options = {
    title: 'Export DeepSeek Harness Diagnostics',
    defaultPath: 'DeepSeek-Harness-Diagnostics.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  }
  const selection = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (selection.canceled || !selection.filePath) return false
  try {
    await saveDiagnosticReport(selection.filePath, await createCurrentDiagnosticReport())
    return true
  } catch (error) {
    console.error(`Diagnostic export failed: ${error?.code ?? 'unknown'}`)
    await dialog.showMessageBox({
      type: 'error',
      message: 'Could not export diagnostics',
      detail: 'No diagnostic data was written. Please choose another location and try again.',
    })
    return false
  }
}

const connectionRecovery = createConnectionRecovery({
  state: desktopState,
  isOnline: () => acceptanceOnlineOverride ?? electronNet.isOnline(),
  getHostTarget: currentHostTarget,
  isHostTargetCurrent: isCurrentHostTarget,
  probeHost: probeCurrentHost,
  reloadPage: reloadCurrentPage,
  restartHost: restartUnhealthyHost,
  getReadyTransition: currentReadyTransition,
})

function exitAfterHost(code) {
  if (quitPromise) return quitPromise
  quitting = true
  desktopState.transition('quitting')
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
  installCrashActions({
    webContents: win.webContents,
    getRecoveryUrl: () => recoveryPageUrl,
    retry: retryHost,
    quit: () => app.quit(),
  })
  installWindowSecurity({
    window: win,
    getHostUrl: () => hostUrl,
    openExternal: url => shell.openExternal(url),
  })
  installWindowResidency({ window: win, isQuitting: () => quitting })
  win.on('closed', () => { win = undefined })
  win.webContents.on('did-finish-load', () => {
    pageLoadCount += 1
    if (SMOKE && hostUrl && win?.webContents.getURL().startsWith(hostUrl)) {
      console.log('SMOKE OK', hostUrl)
      void exitAfterHost(0)
    }
  })
  void win.loadURL(hostUrl || SPLASH)
  return win
}

function showWindow() {
  showDesktopWindow({
    getWindow: () => win,
    createWindow,
    platform: process.platform,
    focusApp: () => app.focus({ steal: true }),
  })
}

const lock = app.requestSingleInstanceLock()
if (!lock) {
  if (SMOKE) console.error('SMOKE FAIL: another instance is already running')
  process.exit(SMOKE ? 1 : 0)
} else {
  app.on('second-instance', showWindow)
  app.on('activate', showWindow)
  app.whenReady().then(() => {
    startHost()
    createWindow()
    if (!SMOKE) {
      tray = installDesktopMenus({
        app,
        Menu,
        Tray,
        nativeImage,
        platform: process.platform,
        iconPath: desktopIconPath({
          appPath: app.getAppPath(),
          resourcesPath: process.resourcesPath,
          isPackaged: app.isPackaged,
          platform: process.platform,
        }),
        showWindow,
        exportDiagnostics: () => { void exportCurrentDiagnostics() },
        quit: () => app.quit(),
      })
    }
    removeMacConnectionRecovery = installMacConnectionRecovery({
      platform: process.platform,
      powerMonitor,
      recover: connectionRecovery.recover,
    })
    acceptanceControl = installAcceptanceControl({
      socketPath: process.env.DSH_DESKTOP_ACCEPTANCE_SOCKET,
      handlers: {
        snapshot: () => ({
          windowVisible: win?.isVisible() ?? false,
          windowId: win?.id,
          windowUrl: win?.webContents.getURL(),
          desktopState: desktopState.get().name,
          crashCount: crashRecovery.count(),
          pageLoadCount,
          hostPid: host?.pid,
          hostUrl,
          recoveryOpen: Boolean(
            recoveryPageUrl && win?.webContents.getURL() === recoveryPageUrl,
          ),
        }),
        'close-window': () => win?.close(),
        'tray-open': () => {
          if (!tray) throw new Error('Tray is not installed')
          tray.emit('click')
        },
        diagnostics: () => createCurrentDiagnosticReport(),
        'save-diagnostics': async () => {
          const socketPath = process.env.DSH_DESKTOP_ACCEPTANCE_SOCKET
          if (!socketPath) throw new Error('Acceptance socket is not configured')
          const filePath = path.join(path.dirname(socketPath), 'diagnostics.json')
          await saveDiagnosticReport(filePath, await createCurrentDiagnosticReport())
          return { fileName: 'diagnostics.json' }
        },
        resume: () => powerMonitor.emit('resume'),
        'offline-resume': () => {
          acceptanceOnlineOverride = false
          powerMonitor.emit('resume')
        },
        online: () => {
          acceptanceOnlineOverride = true
          return connectionRecovery.recover('acceptance-online')
        },
        'unhealthy-resume': () => {
          acceptanceOnlineOverride = true
          acceptanceForceProbeFailure = true
          return connectionRecovery.recover('acceptance-unhealthy')
        },
        'crash-host': () => {
          if (!host?.pid) throw new Error('Host is not running')
          host.kill('SIGKILL')
        },
        retry: async () => {
          if (!win) throw new Error('Window is not available')
          await win.webContents.executeJavaScript(
            "window.location.href = 'dsh-desktop://retry'",
          )
        },
        quit: () => setImmediate(() => app.quit()),
      },
    })
    acceptanceControl?.ready.catch(error => console.error('Acceptance control failed:', error))
    void runAutoUpdateCheck({
      isPackaged: app.isPackaged,
      isSmoke: SMOKE,
      checkForUpdates: () => autoUpdater.checkForUpdates(),
      notifyDownloaded: updateInfo => {
        downloadedUpdateVersion = updateInfo.version
        if (desktopState.get().name === 'ready') {
          desktopState.transition('updating', { version: downloadedUpdateVersion })
        }
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
  app.on('before-quit', event => {
    if (quitReady) return
    event.preventDefault()
    quitting = true
    desktopState.transition('quitting')
    removeMacConnectionRecovery?.()
    removeMacConnectionRecovery = undefined
    connectionRecovery.dispose()
    acceptanceControl?.close()
    acceptanceControl = undefined
    if (quitPromise) return
    quitPromise = stopHost()
      .catch(error => console.error('Host shutdown failed:', error))
      .then(() => {
        quitAfterHostStop({
          updateDownloaded: Boolean(downloadedUpdateVersion),
          quitAndInstall: () => autoUpdater.quitAndInstall(),
          authorizeQuit: () => { quitReady = true },
          quit: () => app.quit(),
          reportError: reportUpdateError,
          updateEvents: autoUpdater,
          nativeUpdateEvents: nativeAutoUpdater,
        })
      })
  })
}
