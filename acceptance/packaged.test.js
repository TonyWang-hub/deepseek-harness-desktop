import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageVersion = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8')).version
const appBundle = process.env.DSH_DESKTOP_PACKAGED_APP
  ?? path.join(projectDir, 'dist/arm64/mac-arm64/DeepSeek Harness Desktop.app')
const packagedDmg = process.env.DSH_DESKTOP_PACKAGED_DMG
  ?? path.join(projectDir, `dist/arm64/DeepSeek-Harness-Desktop-${packageVersion}-mac-arm64.dmg`)
const appRoot = path.join(appBundle, 'Contents/Resources/app')
const appExecutable = path.join(appBundle, 'Contents/MacOS/DeepSeek Harness Desktop')

test('the packaged app uses the project macOS icon', async () => {
  const plist = path.join(appBundle, 'Contents/Info.plist')
  const result = await execFileAsync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIconFile', plist])
  assert.equal(result.stdout.trim(), 'icon.icns')

  const source = await readFile(path.join(projectDir, 'build/icon.icns'))
  const packaged = await readFile(path.join(appBundle, 'Contents/Resources/icon.icns'))
  assert.deepEqual(packaged, source)
})

test('the packaged disk image uses the project volume icon', async () => {
  const mountRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-dmg-icon-'))
  let mounted = false
  try {
    await execFileAsync('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mountRoot, packagedDmg])
    mounted = true
    const source = await readFile(path.join(projectDir, 'build/icon.icns'))
    const packaged = await readFile(path.join(mountRoot, '.VolumeIcon.icns'))
    assert.deepEqual(packaged, source)
  } finally {
    if (mounted) await execFileAsync('hdiutil', ['detach', mountRoot])
    await rm(mountRoot, { recursive: true, force: true })
  }
})

async function exists(filename) {
  try {
    await access(filename)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function waitUntil(check, description, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function control(socketPath, command) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath)
    let response = ''
    socket.setEncoding('utf8')
    socket.once('error', reject)
    socket.on('data', chunk => {
      response += chunk
      const newline = response.indexOf('\n')
      if (newline === -1) return
      socket.end()
      const parsed = JSON.parse(response.slice(0, newline))
      if (!parsed.ok) reject(new Error(parsed.error))
      else resolve(parsed.value)
    })
    socket.once('connect', () => socket.write(`${JSON.stringify({ command })}\n`))
  })
}

function processExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

async function hostPids(parentPid) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,command='])
  const matches = []
  for (const line of stdout.trim().split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    if (match && Number(match[2]) === parentPid
      && /@deepseek-ai\/dsh\/lib\/bin\.js web --port 0/.test(match[3])) {
      matches.push(Number(match[1]))
    }
  }
  return matches
}

async function waitForExit(child, timeoutMs = 15_000) {
  if (child.exitCode !== null || child.signalCode !== null) return child.exitCode
  return Promise.race([
    new Promise(resolve => child.once('exit', code => resolve(code))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for packaged app exit')), timeoutMs)),
  ])
}

test('the packaged app contains the complete installed production tree as physical files', async () => {
  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8'))
  const missing = []
  for (const [relativePath, metadata] of Object.entries(lock.packages)) {
    if (!relativePath.startsWith('node_modules/') || metadata.dev === true) continue
    if (!await exists(path.join(projectDir, relativePath))) continue
    if (!await exists(path.join(appRoot, relativePath))) missing.push(relativePath)
  }

  assert.deepEqual(missing, [])
  assert.equal(await exists(path.join(appBundle, 'Contents/Resources/app.asar')), false)
  for (const relativePath of [
    'node_modules/@deepseek-ai/dsh/lib/bin.js',
    'node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html',
    'node_modules/pnpm/bin/pnpm.mjs',
    'bin/node',
    'bin/pnpm',
  ]) {
    assert.equal(await exists(path.join(appRoot, relativePath)), true, relativePath)
  }
  for (const relativePath of ['bin/node', 'bin/pnpm']) {
    assert.notEqual((await stat(path.join(appRoot, relativePath))).mode & 0o111, 0, relativePath)
  }
})

test('the packaged app completes smoke with clean data and releases its port', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-packaged-'))
  try {
    const result = await execFileAsync(appExecutable, [
      '--smoke',
      `--user-data-dir=${path.join(testRoot, 'electron')}`,
    ], {
      env: { ...process.env, DSH_HOME: path.join(testRoot, 'dsh') },
      timeout: 100_000,
    })
    assert.match(result.stdout, /^SMOKE OK http:\/\/127\.0\.0\.1:\d+$/m)
    const url = /SMOKE OK (http:\/\/127\.0\.0\.1:\d+)/.exec(result.stdout)?.[1]
    assert.ok(url)
    await assert.rejects(fetch(url))
  } finally {
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('the packaged tray keeps the Host resident, restores one window, and quits cleanly', { timeout: 120_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-packaged-resident-'))
  const socketPath = path.join(testRoot, 'control.sock')
  const diagnosticSecret = 'packaged_diagnostic_secret_should_never_appear'
  const child = spawn(appExecutable, [`--user-data-dir=${path.join(testRoot, 'electron')}`], {
    env: {
      ...process.env,
      DSH_HOME: path.join(testRoot, 'dsh'),
      DSH_DESKTOP_ACCEPTANCE_SOCKET: socketPath,
      DSH_DESKTOP_DIAGNOSTIC_SECRET: diagnosticSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += chunk.toString() })
  let hostUrl
  try {
    const initial = await waitUntil(async () => {
      try {
        const snapshot = await control(socketPath, 'snapshot')
        return snapshot.desktopState === 'ready'
          && snapshot.hostUrl
          && snapshot.pageLoadCount >= 2
          && snapshot.windowUrl.startsWith(snapshot.hostUrl)
          ? snapshot
          : undefined
      } catch {
        return undefined
      }
    }, 'packaged resident Host readiness', 30_000)
    hostUrl = initial.hostUrl
    assert.equal(Number.isInteger(initial.windowId), true)
    assert.equal(initial.desktopState, 'ready')
    assert.equal(initial.crashCount, 0)

    const diagnostics = await control(socketPath, 'diagnostics')
    assert.equal(diagnostics.application.packaged, true)
    assert.equal(diagnostics.application.officialPayloadVersion, '0.1.0-rc.6')
    assert.equal(diagnostics.desktop.hostPid, initial.hostPid)
    assert.equal(diagnostics.runtimeTools.every(tool => tool.status === 'ok'), true)
    const serializedDiagnostics = JSON.stringify(diagnostics)
    assert.equal(serializedDiagnostics.includes(testRoot), false)
    assert.equal(serializedDiagnostics.includes(diagnosticSecret), false)
    assert.equal(serializedDiagnostics.includes(socketPath), false)

    assert.deepEqual(await control(socketPath, 'save-diagnostics'), { fileName: 'diagnostics.json' })
    const diagnosticPath = path.join(testRoot, 'diagnostics.json')
    assert.equal((await stat(diagnosticPath)).mode & 0o777, 0o600)
    const savedDiagnostics = await readFile(diagnosticPath, 'utf8')
    const savedReport = JSON.parse(savedDiagnostics)
    assert.equal(savedReport.application.packaged, true)
    assert.equal(savedReport.desktop.hostPid, initial.hostPid)
    assert.equal(savedDiagnostics.includes(testRoot), false)
    assert.equal(savedDiagnostics.includes(diagnosticSecret), false)
    assert.equal(savedDiagnostics.includes(socketPath), false)

    await control(socketPath, 'resume')
    const reloaded = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'ready' && snapshot.pageLoadCount > initial.pageLoadCount
        ? snapshot
        : undefined
    }, 'packaged page-only wake recovery', 20_000)
    assert.equal(reloaded.windowId, initial.windowId)
    assert.equal(reloaded.hostPid, initial.hostPid)
    assert.equal(reloaded.hostUrl, initial.hostUrl)

    await control(socketPath, 'offline-resume')
    const offline = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'disconnected' ? snapshot : undefined
    }, 'packaged offline wait state', 10_000)
    assert.equal(offline.hostPid, initial.hostPid)
    assert.equal(offline.crashCount, 0)

    await control(socketPath, 'online')
    const online = await control(socketPath, 'snapshot')
    assert.equal(online.desktopState, 'ready')
    assert.equal(online.hostPid, initial.hostPid)

    await control(socketPath, 'unhealthy-resume')
    const active = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'ready'
        && snapshot.hostPid !== initial.hostPid
        && snapshot.hostUrl !== initial.hostUrl
        ? snapshot
        : undefined
    }, 'packaged unhealthy Host replacement', 30_000)
    assert.equal(active.windowId, initial.windowId)
    assert.equal(active.crashCount, 0)
    await waitUntil(() => !processExists(initial.hostPid), 'replaced packaged Host exit', 10_000)
    assert.deepEqual(await hostPids(child.pid), [active.hostPid])
    hostUrl = active.hostUrl

    await control(socketPath, 'close-window')
    const hidden = await control(socketPath, 'snapshot')
    assert.equal(hidden.windowVisible, false)
    assert.equal(hidden.hostPid, active.hostPid)
    assert.equal((await fetch(hostUrl)).ok, true)

    await control(socketPath, 'tray-open')
    const restored = await control(socketPath, 'snapshot')
    assert.equal(restored.windowVisible, true)
    assert.equal(restored.windowId, initial.windowId)
    assert.equal(restored.hostPid, active.hostPid)

    await control(socketPath, 'quit')
    assert.equal(await waitForExit(child), 0, output)
    await assert.rejects(fetch(hostUrl))
    await waitUntil(() => !processExists(active.hostPid), 'packaged Host exit after explicit quit', 10_000)
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await rm(socketPath, { force: true })
    await rm(testRoot, { recursive: true, force: true })
  }
})

test('the packaged runtime executes pnpm, ripgrep, native media/filesystem modules, and a real PTY', { timeout: 60_000 }, async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-packaged-tools-'))
  const dshBin = path.join(appRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  const runtimeEnv = {
    ...process.env,
    HARNESS_DESKTOP_ELECTRON: appExecutable,
    DSH_HOME: path.join(testRoot, 'dsh'),
    ELECTRON_RUN_AS_NODE: '1',
    PATH: `${path.join(appRoot, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
  }
  try {
    const plugin = await execFileAsync(appExecutable, [
      dshBin,
      'plugin',
      '--profile',
      'web',
      '--version',
    ], { cwd: appRoot, env: runtimeEnv })
    assert.equal(plugin.stdout.trim(), '11.21.0')

    const probe = String.raw`
      const { spawnSync } = require('node:child_process')
      const { rgPath } = require('@vscode/ripgrep')
      const sharp = require('sharp')
      const koffi = require('koffi')
      const pty = require('node-pty')
      ;(async () => {
        if (!sharp.versions?.vips || !koffi.os?.errno) process.exit(4)
        const { scrubbedParentEnv } = await import('@deepseek-ai/dsh-subprocess')
        const childEnv = scrubbedParentEnv()
        const childPnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8', env: childEnv })
        if (childPnpm.status !== 0 || childPnpm.stdout.trim() !== '11.21.0') process.exit(5)
        const nestedElectron = spawnSync('node', ['-e',
          "const {spawnSync}=require('node:child_process');"
          + "const nodeChild=spawnSync(process.execPath,['--version'],{encoding:'utf8'});"
          + "console.log(JSON.stringify({marker:process.env.ELECTRON_RUN_AS_NODE,nodeChild:nodeChild.stdout.trim()}))",
        ], { encoding: 'utf8', env: childEnv })
        if (nestedElectron.status !== 0
          || nestedElectron.stdout.trim() !== '{"nodeChild":"v24.18.1"}') process.exit(7)
        const rg = spawnSync(rgPath, ['--version'], { encoding: 'utf8' })
        if (rg.status !== 0 || !/^ripgrep /m.test(rg.stdout)) process.exit(2)
        const shell = pty.spawn('/bin/sh', ['-lc', 'printf PACKAGED_PTY_OK'], { cols: 80, rows: 24 })
        let output = ''
        shell.onData(chunk => { output += chunk })
        shell.onExit(() => {
          if (!output.includes('PACKAGED_PTY_OK')) process.exit(3)
          console.log('PACKAGED_TOOLS_OK')
        })
      })().catch(error => { console.error(error); process.exit(6) })
    `
    const tools = await execFileAsync(appExecutable, ['-e', probe], { cwd: appRoot, env: runtimeEnv })
    assert.equal(tools.stdout.trim(), 'PACKAGED_TOOLS_OK')
  } finally {
    await rm(testRoot, { recursive: true, force: true })
  }
})
