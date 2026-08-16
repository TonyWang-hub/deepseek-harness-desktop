import assert from 'node:assert/strict'
import { constants } from 'node:fs'
import test from 'node:test'

import {
  buildDiagnosticReport,
  checkRuntimeTools,
  saveDiagnosticReport,
} from '../src/diagnostics.js'

test('diagnostic report contains only allowlisted operational data', () => {
  const report = buildDiagnosticReport({
    now: () => new Date('2026-08-16T00:00:00.000Z'),
    application: {
      version: '0.4.0',
      packaged: true,
      payloadVersion: '0.1.0-rc.6',
      ignoredToken: 'ghp_super_secret',
    },
    system: {
      platform: 'darwin',
      release: '25.0.0',
      arch: 'arm64',
      electron: '43.4.0',
      node: '24.17.0',
      homeDirectory: '/Users/alice',
    },
    desktop: {
      state: { name: 'ready', since: 1234, detail: { reason: 'resume', token: 'secret' } },
      hostRunning: true,
      hostPid: 4242,
      hostPort: 52144,
      hostUrl: 'http://127.0.0.1:52144/session/private',
      dshHome: '/Users/alice/.local/share/dsh',
      dshHomeConfigured: true,
      updateReady: false,
      sessionText: 'private conversation',
    },
    tools: [
      { name: 'electron-node', status: 'ok', path: '/Applications/private/Electron' },
      { name: 'pnpm', status: 'missing', error: '/Users/alice/private/pnpm missing' },
    ],
  })

  assert.deepEqual(report, {
    schemaVersion: 1,
    createdAt: '2026-08-16T00:00:00.000Z',
    application: {
      version: '0.4.0',
      packaged: true,
      officialPayloadVersion: '0.1.0-rc.6',
    },
    system: {
      platform: 'darwin',
      release: '25.0.0',
      arch: 'arm64',
      electron: '43.4.0',
      node: '24.17.0',
    },
    desktop: {
      state: 'ready',
      stateSince: 1234,
      hostRunning: true,
      hostPid: 4242,
      hostPort: 52144,
      dshHomeConfigured: true,
      updateReady: false,
    },
    runtimeTools: [
      { name: 'electron-node', status: 'ok' },
      { name: 'pnpm', status: 'missing' },
    ],
  })

  const serialized = JSON.stringify(report)
  for (const secret of [
    'ghp_super_secret',
    '/Users/alice',
    'private conversation',
    '/session/private',
    'secret',
  ]) {
    assert.equal(serialized.includes(secret), false, `diagnostics leaked ${secret}`)
  }
})

test('runtime checks never return inspected filesystem paths or raw errors', async () => {
  const checked = []
  const tools = await checkRuntimeTools([
    { name: 'official-dsh', path: '/private/payload/bin.js', mode: 'readable' },
    { name: 'pnpm', path: '/private/runtime/pnpm', mode: 'executable' },
  ], {
    access: async (path, mode) => {
      checked.push([path, mode])
      if (path.endsWith('pnpm')) throw Object.assign(new Error(`missing ${path}`), { code: 'ENOENT' })
    },
  })

  assert.deepEqual(checked, [
    ['/private/payload/bin.js', constants.R_OK],
    ['/private/runtime/pnpm', constants.X_OK],
  ])
  assert.deepEqual(tools, [
    { name: 'official-dsh', status: 'ok' },
    { name: 'pnpm', status: 'missing' },
  ])
  assert.equal(JSON.stringify(tools).includes('/private/'), false)
})

test('saved diagnostics are formatted and forced to owner-only permissions', async () => {
  const calls = []
  const report = { schemaVersion: 1 }
  await saveDiagnosticReport('/tmp/diagnostics.json', report, {
    writeFile: async (filePath, content, options) => calls.push(['write', filePath, content, options]),
    chmod: async (filePath, mode) => calls.push(['chmod', filePath, mode]),
  })

  assert.deepEqual(calls, [
    ['write', '/tmp/diagnostics.json', '{\n  "schemaVersion": 1\n}\n', { encoding: 'utf8', mode: 0o600 }],
    ['chmod', '/tmp/diagnostics.json', 0o600],
  ])
})
