import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  terminateChild,
  windowsTaskkillArguments,
} from '../src/host-lifecycle.js'

class FakeChild extends EventEmitter {
  exitCode = null
  signalCode = null
  signals = []
  pid = 4242

  constructor({ resistTerm = false } = {}) {
    super()
    this.resistTerm = resistTerm
  }

  kill(signal) {
    this.signals.push(signal)
    if (signal === 'SIGTERM' && this.resistTerm) return true
    this.signalCode = signal
    this.emit('exit', null, signal)
    return true
  }
}

test('host termination waits for a graceful exit', async () => {
  const child = new FakeChild()
  await terminateChild(child, { graceMs: 10, platform: 'darwin' })
  assert.deepEqual(child.signals, ['SIGTERM'])
})

test('host termination performs SIGKILL before resolving when SIGTERM is ignored', async () => {
  const child = new FakeChild({ resistTerm: true })
  await terminateChild(child, { graceMs: 1, platform: 'darwin' })
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'])
})

test('Windows taskkill arguments target descendants before optional force', () => {
  assert.deepEqual(windowsTaskkillArguments(4242, { force: false }), ['/PID', '4242', '/T'])
  assert.deepEqual(windowsTaskkillArguments(4242, { force: true }), ['/PID', '4242', '/T', '/F'])
})

test('Windows termination force-escalates when graceful taskkill fails', async () => {
  const child = new FakeChild({ resistTerm: true })
  const attempts = []
  const killTree = async (pid, { force }) => {
    attempts.push({ pid, force })
    if (!force) throw Object.assign(new Error('graceful taskkill failed'), { code: 1 })
    child.emit('exit', 1, null)
  }

  await terminateChild(child, { graceMs: 10, platform: 'win32', killTree })
  assert.deepEqual(attempts.map(attempt => attempt.force), [false, true])
})

test('Windows termination escalates across the complete Host process tree', async () => {
  const child = new FakeChild({ resistTerm: true })
  const attempts = []
  const killTree = async (pid, { force }) => {
    attempts.push({ pid, force })
    if (force) child.emit('exit', 1, null)
  }

  await terminateChild(child, { graceMs: 1, platform: 'win32', killTree })

  assert.deepEqual(attempts, [
    { pid: 4242, force: false },
    { pid: 4242, force: true },
  ])
  assert.deepEqual(child.signals, [])
})

test('Windows termination waits for taskkill completion after the root exits', async () => {
  const child = new FakeChild({ resistTerm: true })
  let releaseForce
  const forceCompleted = new Promise(resolve => { releaseForce = resolve })
  let resolved = false
  const killTree = async (pid, { force }) => {
    if (!force) return
    child.emit('exit', 1, null)
    await forceCompleted
  }

  const termination = terminateChild(child, { graceMs: 1, platform: 'win32', killTree })
    .then(() => { resolved = true })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(resolved, false)
  releaseForce()
  await termination
  assert.equal(resolved, true)
})
