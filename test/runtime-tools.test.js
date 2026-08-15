import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'

import { createHostEnvironment } from '../src/host-environment.js'

const require = createRequire(import.meta.url)
const electron = require('electron')
const dshBin = require.resolve('@deepseek-ai/dsh/lib/bin.js')
const execFileAsync = promisify(execFile)
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hostBootstrap = path.join(appRoot, 'src/host-bootstrap.js')

test('the host environment uses payload-local tools before ambient PATH', () => {
  const env = createHostEnvironment({
    appPath: '/Applications/DeepSeek Harness Desktop.app/Contents/Resources/app',
    electronPath: '/Applications/DeepSeek Harness Desktop.app/Contents/MacOS/DeepSeek Harness Desktop',
    baseEnv: { PATH: '/usr/bin:/bin', SAFE_VALUE: 'kept' },
    nodeOverride: undefined,
  })

  assert.equal(env.PATH, '/Applications/DeepSeek Harness Desktop.app/Contents/Resources/app/bin:/usr/bin:/bin')
  assert.equal(env.HARNESS_DESKTOP_ELECTRON,
    '/Applications/DeepSeek Harness Desktop.app/Contents/MacOS/DeepSeek Harness Desktop')
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(env.SAFE_VALUE, 'kept')
})

test('the bundled node and pnpm launchers use Electron without a global Node install', async () => {
  const binDir = path.join(appRoot, 'bin')
  for (const name of ['node', 'pnpm']) {
    assert.notEqual((await stat(path.join(binDir, name))).mode & 0o111, 0)
  }
  const env = { ...process.env, HARNESS_DESKTOP_ELECTRON: electron }
  const node = await execFileAsync(path.join(binDir, 'node'), ['--version'], { env })
  const pnpm = await execFileAsync(path.join(binDir, 'pnpm'), ['--version'], { env })
  const nestedElectronProbe = `
    const { spawnSync } = require('node:child_process')
    const nodeChild = spawnSync(process.execPath, ['--version'], { encoding: 'utf8' })
    const electronChild = spawnSync(process.env.HARNESS_DESKTOP_ELECTRON, ['--version'], { encoding: 'utf8' })
    console.log(JSON.stringify({
      marker: process.env.ELECTRON_RUN_AS_NODE,
      nodeChild: nodeChild.stdout.trim(),
      electronChild: electronChild.stdout.trim(),
    }))
  `
  const nestedNode = await execFileAsync(path.join(binDir, 'node'), ['-e', nestedElectronProbe], { env })
  const pnpmLauncher = await readFile(path.join(binDir, 'pnpm'), 'utf8')

  assert.match(node.stdout.trim(), /^v24\./)
  assert.equal(pnpm.stdout.trim(), '11.21.0')
  assert.deepEqual(JSON.parse(nestedNode.stdout), {
    nodeChild: 'v24.18.1',
    electronChild: 'v43.4.0',
  })
  assert.match(pnpmLauncher, /clear-electron-run-as-node\.cjs/)
})

test('official subprocess scrubbing retains the payload launcher runtime', () => {
  const previous = process.env.HARNESS_DESKTOP_ELECTRON
  process.env.HARNESS_DESKTOP_ELECTRON = electron
  try {
    const env = scrubbedParentEnv()
    assert.equal(env.HARNESS_DESKTOP_ELECTRON, electron)
  } finally {
    if (previous === undefined) delete process.env.HARNESS_DESKTOP_ELECTRON
    else process.env.HARNESS_DESKTOP_ELECTRON = previous
  }
})

test('the host bootstrap removes Electron run-as-Node mode before loading DSH', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-bootstrap-'))
  const fixture = path.join(fixtureRoot, 'fixture.mjs')
  try {
    await writeFile(fixture, `console.log(JSON.stringify({
      electronRunAsNode: process.env.ELECTRON_RUN_AS_NODE,
      argv: process.argv.slice(1),
    }))\n`)
    const result = await execFileAsync(electron, [hostBootstrap, fixture, 'web'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    assert.deepEqual(JSON.parse(result.stdout), {
      argv: [fixture, 'web'],
    })
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})

test('the official plugin command discovers the bundled pnpm launcher', { timeout: 30_000 }, async () => {
  const dshHome = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-plugin-'))
  try {
    const env = createHostEnvironment({
      appPath: appRoot,
      electronPath: electron,
      baseEnv: { ...process.env, DSH_HOME: dshHome },
      nodeOverride: undefined,
    })
    const result = await execFileAsync(electron, [dshBin, 'plugin', '--profile', 'web', '--version'], { env })
    assert.equal(result.stdout.trim(), '11.21.0')
  } finally {
    await rm(dshHome, { recursive: true, force: true })
  }
})
