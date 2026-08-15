import assert from 'node:assert/strict'
import test from 'node:test'

import { runAutoUpdateCheck } from '../src/updater.js'

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
