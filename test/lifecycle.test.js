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

function launch(args, testRoot) {
  const child = spawn(electron, [appRoot, `--user-data-dir=${path.join(testRoot, 'electron')}`, ...args], {
    cwd: appRoot,
    env: { ...process.env, DSH_HOME: path.join(testRoot, 'dsh') },
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
