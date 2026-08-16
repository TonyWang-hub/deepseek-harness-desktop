import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  createConnectionRecovery,
  installMacConnectionRecovery,
} from '../src/connection-recovery.js'
import { createDesktopState } from '../src/desktop-state.js'

function readyState() {
  const state = createDesktopState()
  state.transition('ready')
  return state
}

test('a healthy Host after resume reloads only the page transport', async () => {
  const state = readyState()
  let probes = 0
  let reloads = 0
  let restarts = 0
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => true,
    hasHostTarget: () => true,
    probeHost: async () => { probes += 1; return true },
    reloadPage: async () => { reloads += 1 },
    restartHost: async () => { restarts += 1 },
  })

  assert.deepEqual(await recovery.recover('resume'), { action: 'page-reloaded' })
  assert.equal(state.get().name, 'ready')
  assert.equal(probes, 1)
  assert.equal(reloads, 1)
  assert.equal(restarts, 0)
})

test('healthy wake preserves an already downloaded update state', async () => {
  const state = readyState()
  state.transition('updating', { version: '0.4.0' })
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => true,
    hasHostTarget: () => true,
    probeHost: async () => true,
    reloadPage: async () => {},
    restartHost: async () => {},
    getReadyTransition: () => ({ name: 'updating', detail: { version: '0.4.0' } }),
  })

  await recovery.recover('resume')
  assert.deepEqual(state.get().detail, { version: '0.4.0' })
  assert.equal(state.get().name, 'updating')
})

test('offline recovery waits without probing, restarting, or opening the crash circuit', async () => {
  const state = readyState()
  const scheduled = []
  let probes = 0
  let restarts = 0
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => false,
    hasHostTarget: () => true,
    probeHost: async () => { probes += 1; return false },
    reloadPage: async () => {},
    restartHost: async () => { restarts += 1 },
    schedule: (callback, delayMs) => {
      scheduled.push({ callback, delayMs })
      return scheduled.length
    },
    cancel: () => {},
    retryDelayMs: 5000,
  })

  assert.deepEqual(await recovery.recover('resume'), { action: 'wait-for-network' })
  assert.equal(state.get().name, 'disconnected')
  assert.deepEqual(state.get().detail, { reason: 'offline' })
  assert.equal(probes, 0)
  assert.equal(restarts, 0)
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].delayMs, 5000)

  await recovery.recover('unlock-screen')
  assert.equal(scheduled.length, 1)
})

test('network loss during a failed probe does not restart the Host', async () => {
  const state = readyState()
  let online = true
  let restarts = 0
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => online,
    hasHostTarget: () => true,
    probeHost: async () => { online = false; return false },
    reloadPage: async () => {},
    restartHost: async () => { restarts += 1 },
    schedule: () => 1,
    cancel: () => {},
  })

  assert.deepEqual(await recovery.recover('resume'), { action: 'wait-for-network' })
  assert.equal(state.get().name, 'disconnected')
  assert.equal(restarts, 0)
})

test('an online but unreachable Host is restarted exactly once', async () => {
  const state = readyState()
  let releaseProbe
  const probe = new Promise(resolve => { releaseProbe = resolve })
  let restarts = 0
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => true,
    hasHostTarget: () => true,
    probeHost: () => probe,
    reloadPage: async () => {},
    restartHost: async () => { restarts += 1 },
  })

  const first = recovery.recover('resume')
  const second = recovery.recover('unlock-screen')
  assert.equal(first, second)
  releaseProbe(false)
  assert.deepEqual(await first, { action: 'host-restarted' })
  assert.equal(state.get().name, 'recovering')
  assert.equal(restarts, 1)
})

test('a Host invalidated during page reload cannot be marked ready', async () => {
  const state = readyState()
  let current = 'host-a'
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => true,
    getHostTarget: () => current,
    isHostTargetCurrent: target => target === current,
    probeHost: async () => true,
    reloadPage: async () => { current = 'host-b' },
    restartHost: async () => {},
  })

  assert.deepEqual(await recovery.recover('resume'), { action: 'stale-host' })
  assert.equal(state.get().name, 'recovering')
})

test('a stale probe cannot reload or restart a replacement Host', async () => {
  const state = readyState()
  let current = 'host-a'
  let reloads = 0
  let restarts = 0
  const recovery = createConnectionRecovery({
    state,
    isOnline: () => true,
    getHostTarget: () => current,
    isHostTargetCurrent: target => target === current,
    probeHost: async () => {
      current = 'host-b'
      state.transition('ready')
      return false
    },
    reloadPage: async () => { reloads += 1 },
    restartHost: async () => { restarts += 1 },
  })

  assert.deepEqual(await recovery.recover('resume'), { action: 'stale-host' })
  assert.equal(state.get().name, 'ready')
  assert.equal(reloads, 0)
  assert.equal(restarts, 0)
})

test('recovery leaves crash-stop and startup ownership unchanged', async () => {
  const circuit = readyState()
  circuit.transition('circuit-open')
  const blocked = createConnectionRecovery({
    state: circuit,
    isOnline: () => true,
    hasHostTarget: () => true,
    probeHost: async () => true,
    reloadPage: async () => {},
    restartHost: async () => {},
  })
  assert.deepEqual(await blocked.recover('resume'), { action: 'blocked', state: 'circuit-open' })

  const starting = createDesktopState()
  const waiting = createConnectionRecovery({
    state: starting,
    isOnline: () => true,
    hasHostTarget: () => false,
    probeHost: async () => true,
    reloadPage: async () => {},
    restartHost: async () => {},
  })
  assert.deepEqual(await waiting.recover('resume'), { action: 'host-not-ready' })
  assert.equal(starting.get().name, 'starting')
})

test('macOS resume and unlock events request recovery and can be removed', () => {
  const powerMonitor = new EventEmitter()
  const reasons = []
  const remove = installMacConnectionRecovery({
    platform: 'darwin',
    powerMonitor,
    recover: reason => { reasons.push(reason) },
  })
  powerMonitor.emit('resume')
  powerMonitor.emit('unlock-screen')
  assert.deepEqual(reasons, ['resume', 'unlock-screen'])
  remove()
  powerMonitor.emit('resume')
  assert.deepEqual(reasons, ['resume', 'unlock-screen'])
})
