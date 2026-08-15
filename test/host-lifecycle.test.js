import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { terminateChild } from '../src/host-lifecycle.js'

class FakeChild extends EventEmitter {
  exitCode = null
  signalCode = null
  signals = []

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
  await terminateChild(child, { graceMs: 10 })
  assert.deepEqual(child.signals, ['SIGTERM'])
})

test('host termination performs SIGKILL before resolving when SIGTERM is ignored', async () => {
  const child = new FakeChild({ resistTerm: true })
  await terminateChild(child, { graceMs: 1 })
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'])
})
