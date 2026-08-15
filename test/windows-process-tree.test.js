import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

import { terminateChild } from '../src/host-lifecycle.js'

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

async function waitUntil(check, description, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function readPid(stream) {
  stream.setEncoding('utf8')
  let output = ''
  for await (const chunk of stream) {
    output += chunk
    const newline = output.indexOf('\n')
    if (newline !== -1) return Number(output.slice(0, newline).trim())
  }
  throw new Error('Windows process-tree fixture exited before reporting its child PID')
}

test('Windows taskkill shutdown removes the real Host root and descendants', {
  skip: process.platform !== 'win32',
  timeout: 30_000,
}, async () => {
  assert.equal(process.arch, 'x64')
  const script = `
    const { spawn } = require('node:child_process')
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    })
    console.log(child.pid)
    setInterval(() => {}, 1000)
  `
  const root = spawn(process.execPath, ['-e', script], {
    stdio: ['ignore', 'pipe', 'inherit'],
    windowsHide: true,
  })
  const descendantPid = await readPid(root.stdout)
  assert.equal(processExists(root.pid), true)
  assert.equal(processExists(descendantPid), true)

  try {
    await terminateChild(root, { graceMs: 1000 })
    await waitUntil(
      () => !processExists(root.pid) && !processExists(descendantPid),
      'root and descendant process exit',
    )
  } finally {
    if (processExists(descendantPid)) process.kill(descendantPid, 'SIGKILL')
    if (processExists(root.pid)) process.kill(root.pid, 'SIGKILL')
  }
})
