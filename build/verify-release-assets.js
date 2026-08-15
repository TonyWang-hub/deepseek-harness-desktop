import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { load } from 'js-yaml'

const ARCHITECTURES = ['arm64', 'x64']
const PAYLOAD_EXTENSIONS = ['dmg', 'zip']
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

function assertVersion(version) {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid release version: ${version}`)
}

function payloadNames(version) {
  return ARCHITECTURES.flatMap(arch => PAYLOAD_EXTENSIONS.map(extension =>
    `DeepSeek-Harness-Desktop-${version}-mac-${arch}.${extension}`))
}

/**
 * Return the complete flat GitHub Release inventory for one version.
 *
 * @param {string} version
 * @returns {string[]}
 */
export function expectedReleaseAssetNames(version) {
  assertVersion(version)
  return [
    ...payloadNames(version).flatMap(filename => [filename, `${filename}.blockmap`]),
    'latest-mac.yml',
    'SHA256SUMS.txt',
  ].sort()
}

function hashFile(filename, algorithm, encoding) {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm)
    const stream = createReadStream(filename)
    stream.on('error', reject)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest(encoding)))
  })
}

async function assertInventory(releaseDir, expectedNames, optionalNames = []) {
  const entries = await readdir(releaseDir, { withFileTypes: true })
  const expected = new Set(expectedNames)
  const optional = new Set(optionalNames)
  const actual = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name))
  const missing = expectedNames.filter(filename => !actual.has(filename))
  const unexpected = entries
    .filter(entry => !expected.has(entry.name) && !optional.has(entry.name) || !entry.isFile())
    .map(entry => entry.isFile() ? entry.name : `${entry.name} (not a file)`)
    .sort()
  if (missing.length || unexpected.length) {
    const details = [
      ...(unexpected.length ? [unexpected.join(', ')] : []),
      ...(missing.length ? [`missing ${missing.join(', ')}`] : []),
    ]
    throw new Error(`Unexpected release asset inventory: ${details.join('; ')}`)
  }
}

/**
 * Write deterministic SHA-256 checksums for every downloadable release file.
 *
 * @param {{releaseDir: string, version: string}} options
 * @returns {Promise<void>}
 */
export async function writeReleaseChecksums({ releaseDir, version }) {
  const checksumName = 'SHA256SUMS.txt'
  const filenames = expectedReleaseAssetNames(version).filter(filename => filename !== checksumName)
  await assertInventory(releaseDir, filenames, [checksumName])
  const lines = []
  for (const filename of filenames) {
    const checksum = await hashFile(path.join(releaseDir, filename), 'sha256', 'hex')
    lines.push(`${checksum}  ${filename}`)
  }
  await writeFile(path.join(releaseDir, checksumName), `${lines.join('\n')}\n`)
}

async function verifyUpdateMetadata(releaseDir, version) {
  const metadata = load(await readFile(path.join(releaseDir, 'latest-mac.yml'), 'utf8'))
  if (!metadata || metadata.version !== version || !Array.isArray(metadata.files)) {
    throw new Error('Invalid latest-mac.yml release metadata')
  }
  const expectedPayloads = payloadNames(version).sort()
  const entriesByName = new Map()
  for (const entry of metadata.files) {
    if (!entry || typeof entry.url !== 'string' || path.basename(entry.url) !== entry.url
      || typeof entry.sha512 !== 'string' || !Number.isSafeInteger(entry.size)) {
      throw new Error('Invalid latest-mac.yml file entry')
    }
    if (entriesByName.has(entry.url)) throw new Error(`Duplicate update metadata: ${entry.url}`)
    entriesByName.set(entry.url, entry)
  }
  const actualPayloads = [...entriesByName.keys()].sort()
  if (!expectedPayloads.every((filename, index) => actualPayloads[index] === filename)
    || actualPayloads.length !== expectedPayloads.length) {
    throw new Error(`Unexpected latest-mac.yml files: ${actualPayloads.join(', ')}`)
  }
  for (const filename of expectedPayloads) {
    const entry = entriesByName.get(filename)
    const artifact = path.join(releaseDir, filename)
    const artifactStat = await stat(artifact)
    const sha512 = await hashFile(artifact, 'sha512', 'base64')
    if (!artifactStat.isFile() || artifactStat.size !== entry.size || sha512 !== entry.sha512) {
      throw new Error(`Update metadata does not match ${filename}`)
    }
  }
  const fallbackName = `DeepSeek-Harness-Desktop-${version}-mac-x64.zip`
  const fallback = entriesByName.get(fallbackName)
  if (metadata.path !== fallbackName || metadata.sha512 !== fallback.sha512) {
    throw new Error('latest-mac.yml fallback does not match the x64 ZIP')
  }
}

async function verifyChecksums(releaseDir, expectedNames) {
  const contents = await readFile(path.join(releaseDir, 'SHA256SUMS.txt'), 'utf8')
  const entries = new Map()
  for (const line of contents.trimEnd().split('\n')) {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(line)
    if (!match || entries.has(match[2])) throw new Error('Invalid SHA256SUMS.txt entry')
    entries.set(match[2], match[1])
  }
  const actualNames = [...entries.keys()].sort()
  if (!expectedNames.every((filename, index) => actualNames[index] === filename)
    || actualNames.length !== expectedNames.length) {
    throw new Error(`Unexpected SHA256SUMS.txt files: ${actualNames.join(', ')}`)
  }
  for (const filename of expectedNames) {
    const actual = await hashFile(path.join(releaseDir, filename), 'sha256', 'hex')
    if (entries.get(filename) !== actual) throw new Error(`SHA256SUMS.txt does not match ${filename}`)
  }
}

/**
 * Verify the exact release inventory and both updater and human checksums.
 *
 * @param {{releaseDir: string, version: string}} options
 * @returns {Promise<void>}
 */
export async function verifyReleaseAssets({ releaseDir, version }) {
  const expectedNames = expectedReleaseAssetNames(version)
  await assertInventory(releaseDir, expectedNames)
  await verifyUpdateMetadata(releaseDir, version)
  await verifyChecksums(releaseDir, expectedNames.filter(filename => filename !== 'SHA256SUMS.txt'))
}

async function main() {
  const [command, releaseDir, version] = process.argv.slice(2)
  if (!['prepare', 'verify'].includes(command) || !releaseDir || !version) {
    throw new Error('Usage: verify-release-assets.js <prepare|verify> <release-directory> <version>')
  }
  if (command === 'prepare') await writeReleaseChecksums({ releaseDir, version })
  await verifyReleaseAssets({ releaseDir, version })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
