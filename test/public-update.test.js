import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  captureOwnedHostProcess,
  parsePublicUpdateArguments,
  preparePublicUpdateCache,
  requestAcceptanceControl,
  runPublicUpdateProof,
  terminateOwnedApplicationProcesses,
  terminateOwnedHostProcesses,
} from '../acceptance/public-update.js'

const standardApp = '/Applications/DeepSeek Harness Desktop.app'
const validSha512 = Buffer.alloc(64, 1).toString('base64')

function validArguments(overrides = {}) {
  const values = {
    app: standardApp,
    from: '0.4.1',
    to: '0.4.2',
    zip: '/tmp/DeepSeek-Harness-Desktop-0.4.2-mac-arm64.zip',
    sha256: 'a'.repeat(64),
    sha512: validSha512,
    runtime: '/tmp/dsh-public-update-proof',
    ...overrides,
  }
  return [
    '--allow-app-mutation',
    '--app', values.app,
    '--from', values.from,
    '--to', values.to,
    '--zip', values.zip,
    '--sha256', values.sha256,
    '--sha512', values.sha512,
    '--runtime', values.runtime,
  ]
}

test('public update proof requires an explicit exact-path mutation contract', () => {
  assert.throws(
    () => parsePublicUpdateArguments(validArguments().slice(1), { platform: 'darwin', arch: 'arm64' }),
    /--allow-app-mutation/,
  )
  assert.throws(
    () => parsePublicUpdateArguments(validArguments({ app: '/tmp/Test.app' }), { platform: 'darwin', arch: 'arm64' }),
    /standard Applications path/,
  )
  assert.throws(
    () => parsePublicUpdateArguments(validArguments({ runtime: `${standardApp}/Contents/update-proof` }), { platform: 'darwin', arch: 'arm64' }),
    /runtime.*outside the application/i,
  )

  const options = parsePublicUpdateArguments(validArguments(), { platform: 'darwin', arch: 'arm64' })
  assert.deepEqual(options, {
    appPath: standardApp,
    fromVersion: '0.4.1',
    toVersion: '0.4.2',
    zipPath: '/tmp/DeepSeek-Harness-Desktop-0.4.2-mac-arm64.zip',
    expectedSha256: 'a'.repeat(64),
    expectedSha512: validSha512,
    runtimeRoot: '/tmp/dsh-public-update-proof',
    timeoutMs: 20 * 60_000,
  })
})

test('public update proof rejects ambiguous versions and payload names', () => {
  assert.throws(
    () => parsePublicUpdateArguments([...validArguments(), '--unexpected', 'value'], { platform: 'darwin', arch: 'arm64' }),
    /Unknown public update argument/,
  )
  assert.throws(
    () => parsePublicUpdateArguments([...validArguments(), '--to', '0.4.3'], { platform: 'darwin', arch: 'arm64' }),
    /Duplicate public update argument/,
  )
  assert.throws(
    () => parsePublicUpdateArguments(validArguments({ to: '0.4.1', zip: '/tmp/DeepSeek-Harness-Desktop-0.4.1-mac-arm64.zip' }), { platform: 'darwin', arch: 'arm64' }),
    /must differ/,
  )
  assert.throws(
    () => parsePublicUpdateArguments(validArguments({ zip: '/tmp/wrong.zip' }), { platform: 'darwin', arch: 'arm64' }),
    /target ZIP name/,
  )
  assert.throws(
    () => parsePublicUpdateArguments(validArguments(), { platform: 'linux', arch: 'arm64' }),
    /macOS/,
  )
})

test('public update cache verifies SHA-256 and writes electron-updater SHA-512 metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-cache-'))
  const zipPath = path.join(root, 'DeepSeek-Harness-Desktop-0.4.2-mac-arm64.zip')
  const bytes = Buffer.from('signed public update fixture')
  await writeFile(zipPath, bytes)
  const expectedSha256 = createHash('sha256').update(bytes).digest('hex')
  const expectedSha512 = createHash('sha512').update(bytes).digest('base64')

  try {
    const result = await preparePublicUpdateCache({
      homeDir: path.join(root, 'home'),
      zipPath,
      expectedSha256,
      expectedSha512,
    })
    assert.equal(result.sha512, expectedSha512)
    assert.deepEqual(await readFile(result.cachedZipPath), bytes)
    assert.deepEqual(JSON.parse(await readFile(result.updateInfoPath, 'utf8')), {
      fileName: path.basename(zipPath),
      sha512: expectedSha512,
    })
    assert.equal((await stat(result.updateInfoPath)).mode & 0o777, 0o600)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('public update cache fails closed before writing a mismatched payload', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-cache-'))
  const zipPath = path.join(root, 'DeepSeek-Harness-Desktop-0.4.2-mac-arm64.zip')
  await writeFile(zipPath, 'tampered')
  try {
    await assert.rejects(preparePublicUpdateCache({
      homeDir: path.join(root, 'home'),
      zipPath,
      expectedSha256: '0'.repeat(64),
      expectedSha512: validSha512,
    }), /SHA-256 mismatch/)
    await assert.rejects(stat(path.join(
      root,
      'home/Library/Caches/deepseek-harness-desktop-updater/pending',
    )), error => error.code === 'ENOENT')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('public update cache rejects a ZIP that disagrees with published SHA-512', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-cache-'))
  const zipPath = path.join(root, 'DeepSeek-Harness-Desktop-0.4.2-mac-arm64.zip')
  const bytes = Buffer.from('public checksum disagreement')
  await writeFile(zipPath, bytes)
  try {
    await assert.rejects(preparePublicUpdateCache({
      homeDir: path.join(root, 'home'),
      zipPath,
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
      expectedSha512: validSha512,
    }), /SHA-512 mismatch/)
    await assert.rejects(stat(path.join(
      root,
      'home/Library/Caches/deepseek-harness-desktop-updater/pending',
    )), error => error.code === 'ENOENT')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('acceptance control request has a bounded timeout', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-control-'))
  const socketPath = path.join(root, 'stalled.sock')
  const connections = new Set()
  const server = createServer(socket => {
    connections.add(socket)
    socket.once('close', () => connections.delete(socket))
  })
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(socketPath, resolve)
    })
    await assert.rejects(
      requestAcceptanceControl(socketPath, 'snapshot', 50),
      /Timed out.*snapshot/,
    )
  } finally {
    for (const socket of connections) socket.destroy()
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test('cleanup terminates only application PIDs owned by the proof', {
  skip: process.platform !== 'darwin',
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-owned-'))
  const executable = path.join(root, 'Shared.app/Contents/MacOS/DeepSeek Harness Desktop')
  const children = []
  try {
    await mkdir(path.dirname(executable), { recursive: true })
    await writeFile(executable, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
    await chmod(executable, 0o755)
    children.push(spawn(executable, { stdio: 'ignore' }))
    children.push(spawn(executable, { stdio: 'ignore' }))
    await new Promise(resolve => setTimeout(resolve, 200))

    await terminateOwnedApplicationProcesses({
      appExecutable: executable,
      ownedPids: new Set([children[0].pid]),
      timeoutMs: 2_000,
    })
    assert.throws(() => process.kill(children[0].pid, 0), error => error.code === 'ESRCH')
    assert.doesNotThrow(() => process.kill(children[1].pid, 0))
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
    await rm(root, { recursive: true, force: true })
  }
})

test('Host cleanup validates identity, escalates, and leaves an unowned peer running', {
  skip: process.platform !== 'darwin',
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-host-'))
  const executable = path.join(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const children = []
  try {
    await mkdir(path.dirname(executable), { recursive: true })
    await writeFile(executable, `#!/usr/bin/env node
process.on('SIGTERM', () => {})
setInterval(() => {}, 1000)
`)
    await chmod(executable, 0o755)
    children.push(spawn(executable, ['web', '--port', '0'], { stdio: 'ignore' }))
    children.push(spawn(executable, ['web', '--port', '0'], { stdio: 'ignore' }))
    await new Promise(resolve => setTimeout(resolve, 200))
    const ownedHost = await captureOwnedHostProcess(children[0].pid, process.pid)

    await terminateOwnedHostProcesses({
      ownedHosts: [ownedHost],
      timeoutMs: 200,
    })
    assert.throws(() => process.kill(children[0].pid, 0), error => error.code === 'ESRCH')
    assert.doesNotThrow(() => process.kill(children[1].pid, 0))
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
    await rm(root, { recursive: true, force: true })
  }
})

test('a source-version rejection never terminates an application the proof did not launch', {
  skip: process.platform !== 'darwin',
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-public-update-ownership-'))
  const appPath = path.join(root, 'Unowned.app')
  const executable = path.join(appPath, 'Contents/MacOS/DeepSeek Harness Desktop')
  const plist = path.join(appPath, 'Contents/Info.plist')
  let child
  try {
    await mkdir(path.dirname(executable), { recursive: true })
    await writeFile(executable, '#!/usr/bin/env node\nsetInterval(() => {}, 1000)\n')
    await chmod(executable, 0o755)
    await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>0.4.0</string></dict></plist>\n`)
    child = spawn(executable, { stdio: 'ignore' })
    await new Promise(resolve => setTimeout(resolve, 200))

    await assert.rejects(runPublicUpdateProof({
      appPath,
      fromVersion: '0.4.1',
      toVersion: '0.4.2',
      zipPath: path.join(root, 'unused.zip'),
      expectedSha256: '0'.repeat(64),
      expectedSha512: validSha512,
      runtimeRoot: path.join(root, 'runtime'),
      timeoutMs: 2_000,
    }), /not version 0\.4\.1/)
    assert.doesNotThrow(() => process.kill(child.pid, 0))
  } finally {
    if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await rm(root, { recursive: true, force: true })
  }
})
