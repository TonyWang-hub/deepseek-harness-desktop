import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
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
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })
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

async function childPids(parentPid) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid='])
  return stdout.trim().split('\n').map(line => line.trim().split(/\s+/).map(Number))
    .filter(([, parent]) => parent === parentPid)
    .map(([pid]) => pid)
}

async function hostPid(parentPid) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,command='])
  for (const line of stdout.trim().split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    if (match && Number(match[2]) === parentPid
      && /@deepseek-ai\/dsh\/lib\/bin\.js web --port 0/.test(match[3])) {
      return Number(match[1])
    }
  }
  return undefined
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
