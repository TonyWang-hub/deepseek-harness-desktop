import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import test from 'node:test'

import { cleanupFailedElectronLaunch } from '../acceptance/helpers/fixture-host.js'

test('failed Electron launch cleanup terminates the process it already started', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  })
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve)
    child.once('error', reject)
  })

  await cleanupFailedElectronLaunch({ child })

  assert.notEqual(child.signalCode, null)
})
