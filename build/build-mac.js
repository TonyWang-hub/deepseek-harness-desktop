import { spawnSync } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TARGETS = new Set(['arm64', 'x64'])

async function targetPackages(projectDir, target) {
  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8'))
  if (!lock.packages || typeof lock.packages !== 'object') throw new Error('package-lock.json has no package inventory')
  return Object.entries(lock.packages)
    .filter(([relativePath, metadata]) => relativePath.startsWith('node_modules/')
      && metadata.dev !== true
      && metadata.os?.includes('darwin')
      && metadata.cpu?.includes(target))
    .map(([relativePath]) => relativePath)
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
}

/**
 * Reject cross-architecture packaging from an install that cannot execute the target's native modules.
 *
 * @param {{projectDir: string, target: string, platform: string, architecture: string}} options
 * @returns {Promise<void>}
 */
export async function assertMacTargetInstall({ projectDir, target, platform, architecture }) {
  if (!TARGETS.has(target)) throw new Error(`Unsupported macOS target: ${target}`)
  if (platform !== 'darwin') throw new Error('macOS packages must be built on macOS')
  if (architecture !== target) throw new Error(`The ${target} package requires an ${target} Node process and clean install`)
  for (const relativePath of await targetPackages(projectDir, target)) {
    try {
      await access(path.join(projectDir, relativePath))
    } catch {
      throw new Error(`The ${target} install is missing ${relativePath}`)
    }
  }
}

/**
 * Build arguments for one architecture-isolated electron-builder invocation.
 *
 * @param {'arm64' | 'x64'} target
 * @param {{unsigned: boolean}} options
 * @returns {string[]}
 */
export function builderArguments(target, { unsigned }) {
  const args = ['--mac', `--${target}`, '--publish', 'never', `-c.directories.output=dist/${target}`]
  if (unsigned) args.push('-c.forceCodeSigning=false', '-c.mac.notarize=false')
  return args
}

/**
 * Disable local signing identity discovery only for an explicitly unsigned build.
 *
 * @param {NodeJS.ProcessEnv} baseEnv
 * @param {{unsigned: boolean}} options
 * @returns {NodeJS.ProcessEnv}
 */
export function builderEnvironment(baseEnv, { unsigned }) {
  if (!unsigned) return { ...baseEnv }
  return { ...baseEnv, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
}

/**
 * Resolve the app bundle produced by electron-builder for one macOS architecture.
 *
 * @param {string} projectDir
 * @param {'arm64' | 'x64'} target
 * @returns {string}
 */
export function packagedAppPath(projectDir, target) {
  const outputDirectory = target === 'arm64' ? 'mac-arm64' : 'mac'
  return path.join(projectDir, 'dist', target, outputDirectory, 'DeepSeek Harness Desktop.app')
}

/**
 * Resolve the disk image produced by electron-builder for one macOS architecture.
 *
 * @param {string} projectDir
 * @param {'arm64' | 'x64'} target
 * @param {string} version
 * @returns {string}
 */
export function packagedDmgPath(projectDir, target, version) {
  return path.join(projectDir, 'dist', target, `DeepSeek-Harness-Desktop-${version}-mac-${target}.dmg`)
}

async function main() {
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const target = process.argv[2]
  const packageMetadata = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8'))
  await assertMacTargetInstall({
    projectDir,
    target,
    platform: process.platform,
    architecture: process.arch,
  })

  const nativeProbe = spawnSync(process.execPath, ['-e', "require('node-pty');require('sharp');require('koffi')"], {
    cwd: projectDir,
    encoding: 'utf8',
  })
  if (nativeProbe.status !== 0) throw new Error(`The ${target} native runtime probe failed: ${nativeProbe.stderr.trim()}`)

  const builder = path.join(projectDir, 'node_modules/electron-builder/cli.js')
  const unsigned = process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED === '1'
  const result = spawnSync(process.execPath, [builder, ...builderArguments(target, { unsigned })], {
    cwd: projectDir,
    env: builderEnvironment(process.env, { unsigned }),
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  const acceptance = spawnSync(process.execPath, ['--test', 'acceptance/packaged.test.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      DSH_DESKTOP_PACKAGED_APP: packagedAppPath(projectDir, target),
      DSH_DESKTOP_PACKAGED_DMG: packagedDmgPath(projectDir, target, packageMetadata.version),
    },
    stdio: 'inherit',
  })
  if (acceptance.error) throw acceptance.error
  if (acceptance.status !== 0) process.exit(acceptance.status ?? 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
