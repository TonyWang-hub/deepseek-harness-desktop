import assert from 'node:assert/strict'
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

test('quitting after an update download explicitly installs it', () => {
  const calls = []
  const action = quitAfterHostStop({
    updateDownloaded: true,
    quitAndInstall: () => calls.push('install'),
    quit: () => calls.push('quit'),
    reportError: error => assert.fail(error),
  })

  assert.equal(action, 'install-update')
  assert.deepEqual(calls, ['install'])
})

test('ordinary quit remains unchanged without a downloaded update', () => {
  const calls = []
  const action = quitAfterHostStop({
    updateDownloaded: false,
    quitAndInstall: () => calls.push('install'),
    quit: () => calls.push('quit'),
    reportError: error => assert.fail(error),
  })

  assert.equal(action, 'quit')
  assert.deepEqual(calls, ['quit'])
})

test('a synchronous installer failure is reported before safe quit', () => {
  const failure = new Error('installer unavailable')
  const calls = []
  let reported
  const action = quitAfterHostStop({
    updateDownloaded: true,
    quitAndInstall: () => { throw failure },
    quit: () => calls.push('quit'),
    reportError: error => { reported = error },
  })

  assert.equal(action, 'quit')
  assert.equal(reported, failure)
  assert.deepEqual(calls, ['quit'])
})
