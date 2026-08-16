import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createConnection } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const STANDARD_APP_PATH = '/Applications/DeepSeek Harness Desktop.app'
const DEFAULT_TIMEOUT_MS = 20 * 60_000

function parseFlags(argv) {
  const allowed = new Set([
    '--allow-app-mutation',
    '--app',
    '--from',
    '--to',
    '--zip',
    '--sha256',
    '--runtime',
    '--timeout-ms',
  ])
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!allowed.has(argument)) throw new Error(`Unknown public update argument: ${argument}`)
    if (values.has(argument)) throw new Error(`Duplicate public update argument: ${argument}`)
    if (argument === '--allow-app-mutation') {
      values.set(argument, true)
      continue
    }
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new Error(`Invalid public update argument: ${argument}`)
    }
    values.set(argument, argv[index + 1])
    index += 1
  }
  return values
}

/**
 * Parse the deliberately strict CLI contract for the post-public macOS update
 * proof. The exact Applications path and explicit mutation acknowledgement
 * prevent this destructive acceptance from being mistaken for a normal test.
 */
export function parsePublicUpdateArguments(
  argv,
  { platform = process.platform, arch = process.arch } = {},
) {
  if (platform !== 'darwin') throw new Error('Public update proof requires macOS')
  const values = parseFlags(argv)
  if (values.get('--allow-app-mutation') !== true) {
    throw new Error('Public update proof requires --allow-app-mutation')
  }
  const required = ['--app', '--from', '--to', '--zip', '--sha256', '--runtime']
  for (const name of required) {
    if (!values.get(name)) throw new Error(`Missing required public update argument: ${name}`)
  }

  const appPath = path.resolve(values.get('--app'))
  if (appPath !== STANDARD_APP_PATH) {
    throw new Error(`Public update proof requires the standard Applications path: ${STANDARD_APP_PATH}`)
  }
  const fromVersion = values.get('--from')
  const toVersion = values.get('--to')
  const versionPattern = /^\d+\.\d+\.\d+$/
  if (!versionPattern.test(fromVersion) || !versionPattern.test(toVersion)) {
    throw new Error('Public update versions must use numeric major.minor.patch form')
  }
  if (fromVersion === toVersion) throw new Error('Public update source and target versions must differ')

  const zipPath = path.resolve(values.get('--zip'))
  const expectedZipName = `DeepSeek-Harness-Desktop-${toVersion}-mac-${arch}.zip`
  if (path.basename(zipPath) !== expectedZipName) {
    throw new Error(`Public update target ZIP name must be ${expectedZipName}`)
  }
  const expectedSha256 = values.get('--sha256').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error('Public update SHA-256 must contain exactly 64 hexadecimal characters')
  }
  const runtimeRoot = path.resolve(values.get('--runtime'))
  if (runtimeRoot === appPath || runtimeRoot.startsWith(`${appPath}${path.sep}`)) {
    throw new Error('Public update runtime must stay outside the application bundle')
  }
  const timeoutValue = values.get('--timeout-ms')
  const timeoutMs = timeoutValue === undefined ? DEFAULT_TIMEOUT_MS : Number(timeoutValue)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) {
    throw new Error('Public update timeout must be an integer of at least 1000 milliseconds')
  }

  return {
    appPath,
    fromVersion,
    toVersion,
    zipPath,
    expectedSha256,
    runtimeRoot,
    timeoutMs,
  }
}

function hashFile(filename, algorithm, encoding) {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm)
    const input = createReadStream(filename)
    input.once('error', reject)
    hash.once('error', reject)
    input.on('data', chunk => hash.update(chunk))
    input.once('end', () => resolve(hash.digest(encoding)))
  })
}

/**
 * Verify a public update ZIP before placing it in electron-updater's isolated
 * cache. The SHA-512 metadata is the exact cache contract used by
 * DownloadedUpdateHelper; the public SHA-256 remains the independent release
 * inventory check.
 */
export async function preparePublicUpdateCache({
  homeDir,
  zipPath,
  expectedSha256,
}) {
  const actualSha256 = await hashFile(zipPath, 'sha256', 'hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Public update ZIP SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}`)
  }
  const sha512 = await hashFile(zipPath, 'sha512', 'base64')
  const pendingDir = path.join(
    homeDir,
    'Library/Caches/deepseek-harness-desktop-updater/pending',
  )
  await rm(pendingDir, { recursive: true, force: true })
  await mkdir(pendingDir, { recursive: true, mode: 0o700 })
  const fileName = path.basename(zipPath)
  const cachedZipPath = path.join(pendingDir, fileName)
  const updateInfoPath = path.join(pendingDir, 'update-info.json')
  await copyFile(zipPath, cachedZipPath)
  await writeFile(updateInfoPath, `${JSON.stringify({ fileName, sha512 })}\n`, { mode: 0o600 })

  return {
    cachedZipPath,
    updateInfoPath,
    sha512,
  }
}

const execFileAsync = promisify(execFile)

async function waitUntil(check, description, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await check()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  const detail = lastError ? `: ${lastError.message}` : ''
  throw new Error(`Timed out waiting for ${description}${detail}`)
}

function control(socketPath, command) {
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
      try {
        const parsed = JSON.parse(response.slice(0, newline))
        if (!parsed.ok) reject(new Error(parsed.error))
        else resolve(parsed.value)
      } catch (error) {
        reject(error)
      }
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

async function bundleVersion(appPath) {
  const plistPath = path.join(appPath, 'Contents/Info.plist')
  const { stdout } = await execFileAsync('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleShortVersionString',
    plistPath,
  ])
  return stdout.trim()
}

async function applicationPids(appExecutable) {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,command='])
  const pids = []
  for (const line of stdout.trim().split('\n')) {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line)
    if (match && match[2].includes(appExecutable)) pids.push(Number(match[1]))
  }
  return pids
}

function captureOutput(child) {
  let output = ''
  const append = chunk => {
    output = `${output}${chunk.toString()}`.slice(-64 * 1024)
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  return () => output
}

function childExitPromise(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}

async function ensurePrivateRuntime(runtimeRoot) {
  try {
    const metadata = await stat(runtimeRoot)
    if (!metadata.isDirectory()) throw new Error('Public update runtime root must be a directory')
    if ((await readdir(runtimeRoot)).length !== 0) {
      throw new Error('Public update runtime root must be empty')
    }
    await chmod(runtimeRoot, 0o700)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await mkdir(runtimeRoot, { recursive: true, mode: 0o700 })
  }
}

async function terminateApplication(appExecutable) {
  const initial = await applicationPids(appExecutable)
  for (const pid of initial) {
    try { process.kill(pid, 'SIGTERM') } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  try {
    await waitUntil(async () => (await applicationPids(appExecutable)).length === 0, 'test application cleanup', 10_000)
  } catch {
    for (const pid of await applicationPids(appExecutable)) {
      try { process.kill(pid, 'SIGKILL') } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
  }
}

async function waitForChildExit(exitPromise, timeoutMs) {
  return Promise.race([
    exitPromise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for source application exit')), timeoutMs)
      timer.unref?.()
    }),
  ])
}

async function waitForHostRelease(snapshot, description) {
  await waitUntil(
    () => !processExists(snapshot.hostPid),
    `${description} process cleanup`,
    30_000,
  )
  await waitUntil(async () => {
    try {
      await fetch(snapshot.hostUrl, { signal: AbortSignal.timeout(1_000) })
      return false
    } catch {
      return true
    }
  }, `${description} port release`, 30_000)
}

/**
 * Run the destructive, post-public installed update proof. The caller owns
 * backup/restore of the real Applications bundle and native ShipIt cache; this
 * function owns only the isolated app run and updater cache.
 */
export async function runPublicUpdateProof(options) {
  const {
    appPath,
    fromVersion,
    toVersion,
    zipPath,
    expectedSha256,
    runtimeRoot,
    timeoutMs,
  } = options
  const appExecutable = path.join(appPath, 'Contents/MacOS/DeepSeek Harness Desktop')
  const socketPath = path.join(runtimeRoot, 'control.sock')
  let child
  let ownsApplication = false
  let readOutput = () => ''
  let baselineHost
  let updatedHost

  try {
    if (await bundleVersion(appPath) !== fromVersion) {
      throw new Error(`Installed source application is not version ${fromVersion}`)
    }
    const running = await applicationPids(appExecutable)
    if (running.length !== 0) {
      throw new Error(`Public update source application is already running: ${running.join(', ')}`)
    }
    await ensurePrivateRuntime(runtimeRoot)
    const homeDir = path.join(runtimeRoot, 'home')
    await mkdir(homeDir, { recursive: true, mode: 0o700 })
    await preparePublicUpdateCache({ homeDir, zipPath, expectedSha256 })

    child = spawn(appExecutable, [
      `--user-data-dir=${path.join(runtimeRoot, 'electron')}`,
    ], {
      env: {
        ...process.env,
        HOME: homeDir,
        DSH_HOME: path.join(runtimeRoot, 'dsh'),
        DSH_DESKTOP_ACCEPTANCE_SOCKET: socketPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    ownsApplication = true
    readOutput = captureOutput(child)
    const exitPromise = childExitPromise(child)

    baselineHost = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.hostPid && snapshot.hostUrl ? snapshot : false
    }, 'source application Host readiness', timeoutMs)
    await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.desktopState === 'updating' ? snapshot : false
    }, `downloaded public v${toVersion} update`, timeoutMs, 1_000)

    await control(socketPath, 'quit')
    await waitForChildExit(exitPromise, timeoutMs)
    await waitForHostRelease(baselineHost, 'source Host')
    await waitUntil(
      async () => await bundleVersion(appPath) === toVersion,
      `installed v${toVersion} application`,
      timeoutMs,
      1_000,
    )

    updatedHost = await waitUntil(async () => {
      const snapshot = await control(socketPath, 'snapshot')
      return snapshot.hostPid && snapshot.hostUrl ? snapshot : false
    }, 'automatically relaunched target application Host readiness', timeoutMs)
    if (updatedHost.hostPid === baselineHost.hostPid) {
      throw new Error('Updated application reused the source Host PID')
    }

    await control(socketPath, 'quit')
    await waitUntil(
      async () => (await applicationPids(appExecutable)).length === 0,
      'target application exit',
      30_000,
    )
    await waitForHostRelease(updatedHost, 'target Host')

    return {
      fromVersion,
      toVersion,
      baselineHostPid: baselineHost.hostPid,
      updatedHostPid: updatedHost.hostPid,
      installedVersion: await bundleVersion(appPath),
      automaticRelaunch: true,
      baselineHostExited: true,
      baselinePortReleased: true,
      finalHostExited: true,
      finalPortReleased: true,
    }
  } catch (error) {
    const output = readOutput()
    if (output) error.message = `${error.message}\n--- application output ---\n${output}`
    throw error
  } finally {
    if (ownsApplication) {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
      await terminateApplication(appExecutable)
      if (updatedHost?.hostPid && processExists(updatedHost.hostPid)) {
        try { process.kill(updatedHost.hostPid, 'SIGKILL') } catch (error) {
          if (error.code !== 'ESRCH') throw error
        }
      }
    }
  }
}

const invokedAsScript = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  try {
    const options = parsePublicUpdateArguments(process.argv.slice(2))
    const result = await runPublicUpdateProof(options)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  }
}
