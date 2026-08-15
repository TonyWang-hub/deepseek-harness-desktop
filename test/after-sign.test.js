import assert from 'node:assert/strict'
import test from 'node:test'

import afterSign, { verifyMacReleaseApp } from '../build/after-sign.js'

test('release verification requires a valid signature, Gatekeeper assessment, and notarization ticket', async () => {
  const calls = []
  await verifyMacReleaseApp({
    appPath: '/tmp/DeepSeek Harness Desktop.app',
    execFile: async (command, args) => { calls.push([command, args]) },
  })

  assert.deepEqual(calls, [
    ['codesign', ['--verify', '--deep', '--strict', '--verbose=2', '/tmp/DeepSeek Harness Desktop.app']],
    ['spctl', ['--assess', '--type', 'execute', '--verbose=4', '/tmp/DeepSeek Harness Desktop.app']],
    ['xcrun', ['stapler', 'validate', '/tmp/DeepSeek Harness Desktop.app']],
  ])
})

test('release verification fails when notarization was skipped', async () => {
  await assert.rejects(
    verifyMacReleaseApp({
      appPath: '/tmp/DeepSeek Harness Desktop.app',
      execFile: async (command) => {
        if (command === 'xcrun') throw new Error('does not have a ticket stapled to it')
      },
    }),
    /does not have a ticket stapled to it/,
  )
})

test('explicit local unsigned builds skip release verification', async () => {
  const previous = process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED
  process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED = '1'
  try {
    await afterSign({ electronPlatformName: 'darwin' })
  } finally {
    if (previous === undefined) delete process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED
    else process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED = previous
  }
})
