import { execFile, spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { chromium } from 'playwright-core'

import { normalizeParityHistory } from './normalize-session.js'
import { isExpectedParityApproval } from './parity-contract.js'

const require = createRequire(import.meta.url)
const electronExecutable = require('electron')
const execFileAsync = promisify(execFile)
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dshBin = require.resolve('@deepseek-ai/dsh/lib/bin.js')
const parityPatch = path.join(appRoot, 'fixtures/parity/cordis.patch.yml')
const parityPlugin = path.join(appRoot, 'fixtures/plugins/parity-probe')
const parityWorkspace = path.join(appRoot, 'fixtures/parity/workspace')
const browserEntry = path.join(appRoot, 'acceptance/helpers/browser-entry.js')

async function waitUntil(check, description, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function replayScenario(page, workspace) {
  await page.exposeFunction('__dshValidateParityApproval', (frame, sessionId) => (
    isExpectedParityApproval(frame, sessionId)
  ))
  const events = await page.evaluate(async workspacePath => {
    const request = async (method, payload) => {
      const rpcId = crypto.randomUUID()
      const response = await fetch(`/api/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`${method} transport failed with HTTP ${response.status}`)
      const envelope = await response.json()
      if (envelope.rpcId !== rpcId) throw new Error(`${method} returned a mismatched rpcId`)
      if (!envelope.result?.ok) throw new Error(`${method} failed: ${JSON.stringify(envelope.result?.error)}`)
      return envelope.result.value
    }
    const socket = new WebSocket(`${location.origin.replace('http:', 'ws:')}/api/events.mux`)
    await Promise.race([
      new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true })
        socket.addEventListener('error', reject, { once: true })
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('event socket timeout')), 10_000)),
    ])
    const pendingResponses = new Set()
    let socketFailure
    let sessionId
    socket.addEventListener('message', event => {
      let envelope
      try {
        envelope = JSON.parse(event.data)
      } catch (error) {
        socketFailure = error
        return
      }
      if (envelope.payload?.type !== 'approval/requested') return
      const response = (async () => {
        const expected = await window.__dshValidateParityApproval(envelope.payload, sessionId)
        if (!expected) throw new Error(`unexpected approval request: ${JSON.stringify(envelope.payload)}`)
        const receiptResponse = await fetch('/api/respond', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'client-response',
            rpcId: envelope.rpcId,
            result: {
              ok: true,
              value: {
                sessionId,
                approvalId: envelope.payload.approvalId,
                outcome: 'allowed-once',
              },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        })
        const receipt = await receiptResponse.json()
        if (receipt.accepted !== true) throw new Error(`approval response was not accepted: ${JSON.stringify(receipt)}`)
      })()
        .catch(error => { socketFailure = error })
        .finally(() => pendingResponses.delete(response))
      pendingResponses.add(response)
    })

    try {
      const createdWorkspace = await request('workspace.create', { path: workspacePath })
      const createdSession = await request('session.create', {
        workspaceId: createdWorkspace.workspace.workspaceId,
      })
      sessionId = createdSession.sessionId
      await request('session.prompt', {
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: 'Run the deterministic parity fixture.' }],
        clientTimeZone: 'UTC',
      })
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        if (socketFailure) throw socketFailure
        const history = await request('session.history', { sessionId })
        if (history.events.some(entry => entry.event.type === 'turn/end')) {
          await Promise.all(pendingResponses)
          if (socketFailure) throw socketFailure
          return history.events
        }
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('Timed out waiting for parity turn completion')
    } finally {
      socket.close()
    }
  }, workspace)
  return normalizeParityHistory(events, { workspace })
}

async function installParityPlugin(env) {
  await execFileAsync(electronExecutable, [
    dshBin,
    'plugin',
    '--profile',
    'web',
    'add',
    `file:${parityPlugin}`,
  ], {
    cwd: appRoot,
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    timeout: 60_000,
  })
}

function launchDirectHost(env) {
  const child = spawn(process.execPath, [
    dshBin,
    'web',
    '--patch',
    parityPatch,
    '--port',
    '0',
  ], {
    cwd: appRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })
  return { child, output: () => output }
}

function childStopped(child) {
  return child.exitCode !== null || child.signalCode !== null
}

async function waitForChildStop(child, timeoutMs) {
  if (childStopped(child)) return true
  return new Promise(resolve => {
    let settled = false
    const finish = value => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.off('exit', onExit)
      resolve(value)
    }
    const onExit = () => finish(true)
    const timer = setTimeout(() => finish(false), timeoutMs)
    child.once('exit', onExit)
    if (childStopped(child)) finish(true)
  })
}

async function stopChild(child) {
  if (childStopped(child)) return
  child.kill('SIGTERM')
  if (await waitForChildStop(child, 10_000)) return
  child.kill('SIGKILL')
  await waitForChildStop(child, 10_000)
}

export async function cleanupFailedElectronLaunch({ child, browser }) {
  await browser?.close().catch(() => {})
  await stopChild(child)
}

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : undefined
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  if (port === undefined) throw new Error('Failed to reserve a DevTools port')
  return port
}

async function launchElectron(args, env) {
  const port = await availablePort()
  const child = spawn(electronExecutable, [`--remote-debugging-port=${port}`, ...args], {
    cwd: appRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })
  const endpoint = `http://127.0.0.1:${port}`
  let browser
  try {
    await waitUntil(async () => {
      if (childStopped(child)) {
        throw new Error(`Electron entry exited before DevTools was ready:\n${output}`)
      }
      try {
        return (await fetch(`${endpoint}/json/version`, { signal: AbortSignal.timeout(2_000) })).ok
      } catch {
        return false
      }
    }, 'Electron DevTools endpoint')
    browser = await chromium.connectOverCDP(endpoint)
    const page = await waitUntil(() => (
      browser.contexts().flatMap(context => context.pages())[0]
    ), 'Electron browser window')
    return { browser, child, page, output: () => output }
  } catch (error) {
    await cleanupFailedElectronLaunch({ child, browser })
    throw error
  }
}

async function closeElectron(application, entry) {
  if (!application) return
  if (entry === 'desktop') {
    await application.page.evaluate(() => { window.location.href = 'dsh-desktop://quit' }).catch(() => {})
    await Promise.race([
      new Promise(resolve => application.child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 10_000)),
    ])
  }
  await stopChild(application.child)
  await application.browser.close().catch(() => {})
}

async function assertLoadedEntry(page) {
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//, { timeout: 90_000 })
  const marker = await page.evaluate(async () => {
    const response = await fetch('/parity-probe')
    return response.json()
  })
  if (marker.plugin !== 'parity-probe' || marker.model !== 'parity-model') {
    throw new Error(`parity plugin marker mismatch: ${JSON.stringify(marker)}`)
  }
}

/**
 * Run one isolated real-Host fixture through either a direct browser entry or
 * the supervised desktop entry.
 *
 * @param {'browser' | 'desktop'} entry
 */
export async function runParityEntry(entry) {
  const root = await mkdtemp(path.join(tmpdir(), `dsh-desktop-parity-${entry}-`))
  const workspace = path.join(root, 'workspace')
  await cp(parityWorkspace, workspace, { recursive: true })
  const env = {
    ...process.env,
    DSH_HOME: path.join(root, 'dsh'),
    DSH_TELEMETRY_DISABLED: '1',
    PARITY_WORKSPACE: workspace,
    HARNESS_DESKTOP_ELECTRON: electronExecutable,
    PATH: `${path.join(appRoot, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
  }
  let directHost
  let application
  try {
    await installParityPlugin(env)
    let baseUrl
    if (entry === 'browser') {
      directHost = launchDirectHost(env)
      baseUrl = await waitUntil(() => (
        /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(directHost.output())?.[1]
      ), 'direct parity Host readiness')
      application = await launchElectron([
        browserEntry,
        `--user-data-dir=${path.join(root, 'electron')}`,
      ], { ...env, PARITY_URL: baseUrl })
    } else {
      application = await launchElectron([
        appRoot,
        '--fixture-parity',
        `--user-data-dir=${path.join(root, 'electron')}`,
      ], env)
    }
    await assertLoadedEntry(application.page)
    return await replayScenario(application.page, workspace)
  } finally {
    await closeElectron(application, entry)
    if (directHost) await stopChild(directHost.child)
    await rm(root, { recursive: true, force: true })
  }
}
