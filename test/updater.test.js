import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { quitAfterHostStop, runAutoUpdateCheck } from '../src/updater.js'

test('a packaged app checks for updates once', async () => {
  let calls = 0
  let notified
  const result = await runAutoUpdateCheck({
    isPackaged: true,
    isSmoke: false,
    checkForUpdates: async () => {
      calls += 1
      return { updateInfo: { version: '0.2.0' }, downloadPromise: Promise.resolve() }
    },
    notifyDownloaded: updateInfo => { notified = updateInfo.version },
    reportError: () => assert.fail('unexpected update error'),
  })

  assert.equal(result, true)
  assert.equal(calls, 1)
  assert.equal(notified, '0.2.0')
})

test('development and smoke runs never contact the update service', async () => {
  let calls = 0
  const checkForUpdates = async () => { calls += 1 }

  assert.equal(await runAutoUpdateCheck({
    isPackaged: false,
    isSmoke: false,
    checkForUpdates,
    notifyDownloaded: () => assert.fail('unexpected update notification'),
    reportError: () => {},
  }), false)
  assert.equal(await runAutoUpdateCheck({
    isPackaged: true,
    isSmoke: true,
    checkForUpdates,
    notifyDownloaded: () => assert.fail('unexpected update notification'),
    reportError: () => {},
  }), false)
  assert.equal(calls, 0)
})

test('an update-service failure is reported without failing the app', async () => {
  const failure = new Error('offline')
  let reported
  const result = await runAutoUpdateCheck({
    isPackaged: true,
    isSmoke: false,
    checkForUpdates: async () => { throw failure },
    notifyDownloaded: () => assert.fail('unexpected update notification'),
    reportError: error => { reported = error },
  })

  assert.equal(result, false)
  assert.equal(reported, failure)
})

test('a download failure after a successful feed check is handled', async () => {
  const failure = new Error('download failed after feed check')
  let reported
  const result = await runAutoUpdateCheck({
    isPackaged: true,
    isSmoke: false,
    checkForUpdates: async () => ({
      updateInfo: { version: '0.2.0' },
      downloadPromise: Promise.reject(failure),
    }),
    notifyDownloaded: () => assert.fail('unexpected update notification'),
    reportError: error => { reported = error },
  })

  assert.equal(result, false)
  assert.equal(reported, failure)
})

test('deferred macOS install keeps quit blocked until native updater authorization', () => {
  const updateEvents = new EventEmitter()
  const nativeUpdateEvents = new EventEmitter()
  const calls = []
  let quitAuthorized = false
  let fallback
  let fallbackCancelled = false
  const action = quitAfterHostStop({
    updateDownloaded: true,
    quitAndInstall: () => calls.push('install'),
    authorizeQuit: () => { quitAuthorized = true },
    quit: () => calls.push('quit'),
    reportError: error => assert.fail(error),
    updateEvents,
    nativeUpdateEvents,
    scheduleFallback: handler => {
      fallback = handler
      return () => { fallbackCancelled = true }
    },
  })

  assert.equal(action, 'install-update')
  assert.deepEqual(calls, ['install'])
  assert.equal(quitAuthorized, false)
  assert.equal(typeof fallback, 'function')

  nativeUpdateEvents.emit('before-quit-for-update')
  assert.equal(quitAuthorized, true)
  assert.equal(fallbackCancelled, true)
  assert.deepEqual(calls, ['install'])
})

test('ordinary quit is authorized immediately without a downloaded update', () => {
  const calls = []
  const action = quitAfterHostStop({
    updateDownloaded: false,
    quitAndInstall: () => calls.push('install'),
    authorizeQuit: () => calls.push('authorize'),
    quit: () => calls.push('quit'),
    reportError: error => assert.fail(error),
  })

  assert.equal(action, 'quit')
  assert.deepEqual(calls, ['authorize', 'quit'])
})

test('an asynchronous installer error is reported before authorized safe quit', () => {
  const failure = new Error('Squirrel staging failed')
  const updateEvents = new EventEmitter()
  const nativeUpdateEvents = new EventEmitter()
  const calls = []
  let reported
  let fallback
  const action = quitAfterHostStop({
    updateDownloaded: true,
    quitAndInstall: () => calls.push('install'),
    authorizeQuit: () => calls.push('authorize'),
    quit: () => calls.push('quit'),
    reportError: error => { reported = error },
    updateEvents,
    nativeUpdateEvents,
    scheduleFallback: handler => {
      fallback = handler
      return () => calls.push('cancel-fallback')
    },
  })

  assert.equal(action, 'install-update')
  assert.equal(typeof fallback, 'function')
  updateEvents.emit('error', failure)
  assert.equal(reported, failure)
  assert.deepEqual(calls, ['install', 'cancel-fallback', 'authorize', 'quit'])
})

test('an installer readiness timeout reports failure and safely quits', () => {
  const updateEvents = new EventEmitter()
  const nativeUpdateEvents = new EventEmitter()
  const calls = []
  let fallback
  let reported
  quitAfterHostStop({
    updateDownloaded: true,
    quitAndInstall: () => calls.push('install'),
    authorizeQuit: () => calls.push('authorize'),
    quit: () => calls.push('quit'),
    reportError: error => { reported = error },
    updateEvents,
    nativeUpdateEvents,
    scheduleFallback: handler => {
      fallback = handler
      return () => calls.push('cancel-fallback')
    },
  })

  fallback()
  assert.match(reported.message, /timed out/i)
  assert.deepEqual(calls, ['install', 'cancel-fallback', 'authorize', 'quit'])
})
