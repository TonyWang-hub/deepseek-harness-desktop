import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'
import test from 'node:test'

const require = createRequire(import.meta.url)
const electron = require('electron')
const execFileAsync = promisify(execFile)
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function launch(args, testRoot, envOverrides = {}) {
  const child = spawn(electron, [appRoot, `--user-data-dir=${path.join(testRoot, 'electron')}`, ...args], {
    cwd: appRoot,
    env: { ...process.env, DSH_HOME: path.join(testRoot, 'dsh'), ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => {
    output += chunk.toString()
    if (process.env.DSH_TEST_ECHO === '1') process.stderr.write(chunk)
  })
  child.stderr.on('data', chunk => {
    output += chunk.toString()
    if (process.env.DSH_TEST_ECHO === '1') process.stderr.write(chunk)
  })
  return { child, output: () => output }
}

async function waitUntil(predicate, description, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function waitForExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode }
  }
  return Promise.race([
    new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for process exit')), timeoutMs)),
  ])
}

async function control(socketPath, command) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath)
    let response = ''
    socket.setEncoding('utf8')
    socket.setTimeout(10_000, () => socket.destroy(new Error(`Timed out waiting for control command: ${command}`)))
    socket.once('error', reject)
    socket.on('data', chunk => {
      response += chunk
      const newline = response.indexOf('\n')
      if (newline === -1) return
      socket.end()
      const parsed = JSON.parse(response.slice(0, newline))
      if (!parsed.ok) reject(new Error(parsed.error))
      else resolve(parsed.value)
    })
    socket.once('connect', () => socket.write(`${JSON.stringify({ command })}\n`))
  })
}

async function childPids(parentPid) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid='])
  return stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
    .filter(([, parent]) => parent === parentPid)
    .map(([pid]) => pid)
}

async function hostPids(parentPid) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,command='])
  const matches = []
  for (const line of stdout.trim().split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    if (match && Number(match[2]) === parentPid
      && /@deepseek-ai\/dsh\/lib\/bin\.js web --port 0/.test(match[3])) {
      matches.push(Number(match[1]))
    }
  }
  return matches
}

async function hostPid(parentPid) {
  return (await hostPids(parentPid))[0]
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

function readyUrls(output) {
  return [...output.matchAll(/dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/g)].map(match => match[1])
}

async function stopProcessTree(child) {
  if (!child.pid) return
  for (const pid of await childPids(child.pid)) {
    try { process.kill(pid, 'SIGTERM') } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  try {
    await waitForExit(child, 5_000)
  } catch {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await waitForExit(child)
  }
}

test('smoke rejects a false pass while another instance owns the app lock', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-lock-'))
  const first = launch([], testRoot)
  try {
    await waitUntil(() => /dsh web:\s+http:\/\/127\.0\.0\.1:\d+/.test(first.output()), 'first host readiness')

    const second = launch(['--smoke'], testRoot)
    const result = await waitForExit(second.child)

    assert.equal(result.code, 1, second.output())
    assert.match(second.output(), /SMOKE FAIL: another instance is already running/)
  } finally {
    await stopProcessTree(first.child)
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('an unexpectedly killed host restarts without waiting for user input', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-restart-'))
  const desktop = launch([], testRoot)
  try {
    const firstUrl = await waitUntil(() => readyUrls(desktop.output())[0], 'first host readiness')
    const firstHostPid = await waitUntil(() => hostPid(desktop.child.pid), 'first host process')

    process.kill(firstHostPid, 'SIGKILL')

    let secondUrl
    try {
      secondUrl = await waitUntil(() => readyUrls(desktop.output())[1], 'replacement host readiness', 15_000)
    } catch (error) {
      error.message += `\nmain exit=${desktop.child.exitCode} signal=${desktop.child.signalCode}\n${desktop.output()}`
      throw error
    }
    const secondHostPid = await waitUntil(async () => {
      const pid = await hostPid(desktop.child.pid)
      return pid && pid !== firstHostPid ? pid : undefined
    }, 'replacement host process')

    assert.equal(desktop.child.exitCode, null)
    assert.notEqual(secondHostPid, firstHostPid)
    assert.notEqual(secondUrl, firstUrl)
    let httpReady
    try {
      httpReady = await waitUntil(async () => {
        try {
          return (await fetch(secondUrl)).ok
        } catch {
          return false
        }
      }, 'replacement host HTTP readiness', 15_000)
    } catch (error) {
      error.message += `\nmain exit=${desktop.child.exitCode} signal=${desktop.child.signalCode}`
        + `\ncurrent host=${await hostPid(desktop.child.pid)}`
        + `\nready URLs=${JSON.stringify(readyUrls(desktop.output()))}`
        + `\n${desktop.output()}`
      throw error
    }
    assert.equal(httpReady, true)
  } finally {
    await stopProcessTree(desktop.child)
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('repeated Host spawn errors open the recovery circuit without crashing Electron', { timeout: 60_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-spawn-error-'))
  const desktop = launch([], testRoot, {
    DSH_DESKTOP_NODE: path.join(testRoot, 'missing-node'),
  })
  try {
    await waitUntil(
      () => /Host recovery circuit opened after 3 failures/.test(desktop.output()),
      'spawn failure recovery circuit',
      15_000,
    )
    assert.equal(desktop.child.exitCode, null, desktop.output())
    assert.equal((desktop.output().match(/Host launch failed: ENOENT/g) ?? []).length, 3)
  } finally {
    await stopProcessTree(desktop.child)
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('macOS resume distinguishes page, network, and Host recovery', {
  skip: process.platform !== 'darwin',
  timeout: 120_000,
}, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-resume-'))
  const socketPath = path.join(testRoot, 'control.sock')
  const diagnosticSecret = 'ghp_diagnostic_secret_should_never_appear'
  const desktop = launch([], testRoot, {
    DSH_DESKTOP_ACCEPTANCE_SOCKET: socketPath,
    DSH_DESKTOP_DIAGNOSTIC_SECRET: diagnosticSecret,
  })
  let latestUrl
  try {
    const initial = await waitUntil(async () => {
      try {
        const snapshot = await control(socketPath, 'snapshot')
        return snapshot.desktopState === 'ready'
          && snapshot.hostUrl
          && snapshot.pageLoadCount >= 2
          && snapshot.windowUrl.startsWith(snapshot.hostUrl)
          ? snapshot
          : undefined
      } catch {
        return undefined
      }
    }, 'resume acceptance Host readiness', 20_000)
    latestUrl = initial.hostUrl
    assert.equal(initial.crashCount, 0)

    const diagnostics = await control(socketPath, 'diagnostics')
    assert.equal(diagnostics.application.officialPayloadVersion, '0.1.0-rc.6')
    assert.equal(diagnostics.desktop.state, 'ready')
    assert.equal(diagnostics.desktop.hostPid, initial.hostPid)
    assert.equal(diagnostics.desktop.hostPort, Number(new URL(initial.hostUrl).port))
    assert.equal(diagnostics.runtimeTools.every(tool => tool.status === 'ok'), true)
    const serializedDiagnostics = JSON.stringify(diagnostics)
    assert.equal(serializedDiagnostics.includes(testRoot), false)
    assert.equal(serializedDiagnostics.includes(diagnosticSecret), false)
    assert.equal(serializedDiagnostics.includes(socketPath), false)

    assert.deepEqual(await control(socketPath, 'save-diagnostics'), { fileName: 'diagnostics.json' })
    const diagnosticPath = path.join(testRoot, 'diagnostics.json')
    assert.equal((await stat(diagnosticPath)).mode & 0o777, 0o600)
    const savedDiagnostics = await readFile(diagnosticPath, 'utf8')
    const savedReport = JSON.parse(savedDiagnostics)
    assert.equal(savedReport.schemaVersion, 1)
    assert.deepEqual(savedReport.application, diagnostics.application)
    assert.equal(savedReport.desktop.hostPid, initial.hostPid)
    assert.equal(savedDiagnostics.includes(testRoot), false)
    assert.equal(savedDiagnostics.includes(diagnosticSecret), false)

    await control(socketPath, 'resume')
    const reloaded = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'ready' && snapshot.pageLoadCount > initial.pageLoadCount
        ? snapshot
        : undefined
    }, 'page-only wake recovery', 15_000)
    assert.equal(reloaded.windowId, initial.windowId)
    assert.equal(reloaded.hostPid, initial.hostPid)
    assert.equal(reloaded.hostUrl, initial.hostUrl)

    await control(socketPath, 'offline-resume')
    const offline = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'disconnected' ? snapshot : undefined
    }, 'offline wait state', 10_000)
    assert.equal(offline.hostPid, initial.hostPid)
    assert.equal(offline.hostUrl, initial.hostUrl)
    assert.equal(offline.crashCount, 0)

    await control(socketPath, 'online')
    const online = await control(socketPath, 'snapshot')
    assert.equal(online.desktopState, 'ready')
    assert.equal(online.hostPid, initial.hostPid)
    assert.equal(online.hostUrl, initial.hostUrl)

    await control(socketPath, 'unhealthy-resume')
    const restarted = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'ready'
        && snapshot.hostPid !== initial.hostPid
        && snapshot.hostUrl !== initial.hostUrl
        ? snapshot
        : undefined
    }, 'unhealthy Host replacement', 20_000)
    latestUrl = restarted.hostUrl
    assert.equal(restarted.windowId, initial.windowId)
    assert.equal(restarted.crashCount, 0)
    assert.equal(processExists(initial.hostPid), false)
    assert.deepEqual(await hostPids(desktop.child.pid), [restarted.hostPid])

    await control(socketPath, 'quit')
    assert.equal((await waitForExit(desktop.child)).code, 0, desktop.output())
    await assert.rejects(fetch(latestUrl))
  } finally {
    await stopProcessTree(desktop.child)
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('real window residency, tray restore, crash circuit, retry, and quit share one Host lifecycle', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-resident-'))
  const socketPath = path.join(testRoot, 'control.sock')
  const desktop = launch([], testRoot, { DSH_DESKTOP_ACCEPTANCE_SOCKET: socketPath })
  let lastUrl
  try {
    const initial = await waitUntil(async () => {
      try {
        const snapshot = await control(socketPath, 'snapshot')
        return snapshot.hostUrl ? snapshot : undefined
      } catch {
        return undefined
      }
    }, 'acceptance control and Host readiness', 10_000)
    lastUrl = initial.hostUrl
    assert.equal(initial.windowVisible, true)
    assert.equal(initial.desktopState, 'ready')
    assert.equal(Number.isInteger(initial.windowId), true)
    assert.equal((await fetch(lastUrl)).ok, true)

    await control(socketPath, 'close-window')
    const hidden = await control(socketPath, 'snapshot')
    assert.equal(hidden.windowVisible, false)
    assert.equal(hidden.hostPid, initial.hostPid)
    assert.equal((await fetch(lastUrl)).ok, true)

    await control(socketPath, 'tray-open')
    const restored = await control(socketPath, 'snapshot')
    assert.equal(restored.windowVisible, true)
    assert.equal(restored.windowId, initial.windowId)
    assert.equal(restored.hostPid, initial.hostPid)

    let previousPid = initial.hostPid
    for (let crash = 1; crash <= 2; crash += 1) {
      await control(socketPath, 'crash-host')
      const restarted = await waitUntil(async () => {
        const snapshot = await control(socketPath, 'snapshot')
        return snapshot.hostPid && snapshot.hostPid !== previousPid && snapshot.hostUrl !== lastUrl
          ? snapshot
          : undefined
      }, `Host restart ${crash}`, 30_000)
      assert.equal(restarted.desktopState, 'ready')
      previousPid = restarted.hostPid
      lastUrl = restarted.hostUrl
    }

    await control(socketPath, 'crash-host')
    const stopped = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.recoveryOpen && !snapshot.hostPid ? snapshot : undefined
    }, 'open crash circuit', 45_000)
    assert.equal(stopped.windowVisible, true)
    assert.equal(stopped.desktopState, 'circuit-open')

    await control(socketPath, 'retry')
    const recovered = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.hostPid && snapshot.hostUrl !== lastUrl && !snapshot.recoveryOpen
        ? snapshot
        : undefined
    }, 'manual Host recovery', 30_000)
    lastUrl = recovered.hostUrl
    assert.equal(recovered.desktopState, 'ready')
    assert.equal((await fetch(lastUrl)).ok, true)

    await control(socketPath, 'quit')
    const result = await waitForExit(desktop.child)
    assert.equal(result.code, 0, desktop.output())
    await assert.rejects(fetch(lastUrl))
    await waitUntil(() => !processExists(recovered.hostPid), 'Host exit after explicit quit', 10_000)
  } finally {
    await stopProcessTree(desktop.child)
    await rm(socketPath, { force: true })
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('the host exits when its desktop parent is killed', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-parent-death-'))
  const desktop = launch([], testRoot)
  let childHostPid
  try {
    const url = await waitUntil(() => readyUrls(desktop.output())[0], 'host readiness')
    childHostPid = await waitUntil(() => hostPid(desktop.child.pid), 'host process')

    process.kill(desktop.child.pid, 'SIGKILL')
    await waitForExit(desktop.child)
    await waitUntil(() => !processExists(childHostPid), 'host exit after parent death', 10_000)
    await assert.rejects(fetch(url))
  } finally {
    if (childHostPid && processExists(childHostPid)) process.kill(childHostPid, 'SIGTERM')
    await stopProcessTree(desktop.child)
    await rm(testRoot, { recursive: true, force: true })
  }
})
