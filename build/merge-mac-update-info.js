import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dump, load } from 'js-yaml'

function hashFile(filename) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    const stream = createReadStream(filename)
    stream.on('error', reject)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('base64')))
  })
}

async function readArchInfo(filename, arch) {
  const parsed = load(await readFile(filename, 'utf8'))
  if (!parsed || typeof parsed.version !== 'string' || !Array.isArray(parsed.files)) {
    throw new Error(`Invalid ${arch} update metadata`)
  }
  const files = []
  for (const file of parsed.files) {
    if (!file || typeof file.url !== 'string' || typeof file.sha512 !== 'string' || !Number.isSafeInteger(file.size)) {
      throw new Error(`Invalid ${arch} update file entry`)
    }
    if (path.basename(file.url) !== file.url || !file.url.includes(`-${arch}.`)) {
      throw new Error(`Invalid ${arch} update file name: ${file.url}`)
    }
    const artifact = path.join(path.dirname(filename), file.url)
    const stats = await lstat(artifact)
    if (!stats.isFile() || stats.size !== file.size || await hashFile(artifact) !== file.sha512) {
      throw new Error(`Update artifact does not match metadata: ${file.url}`)
    }
    files.push({ url: file.url, sha512: file.sha512, size: file.size })
  }
  if (!files.some(file => file.url.endsWith('.zip'))) throw new Error(`Missing ${arch} ZIP update`)
  return { version: parsed.version, releaseDate: parsed.releaseDate, files }
}

/**
 * Merge independently built macOS artifacts into the one dual-architecture updater manifest.
 *
 * @param {{arm64Info: string, x64Info: string, outputFile: string}} options
 * @returns {Promise<void>}
 */
export async function mergeMacUpdateInfo({ arm64Info, x64Info, outputFile }) {
  const [arm64, x64] = await Promise.all([
    readArchInfo(arm64Info, 'arm64'),
    readArchInfo(x64Info, 'x64'),
  ])
  if (arm64.version !== x64.version) {
    throw new Error(`macOS update version mismatch: ${arm64.version} != ${x64.version}`)
  }
  const files = [...arm64.files, ...x64.files]
    .sort((left, right) => left.url < right.url ? -1 : left.url > right.url ? 1 : 0)
  if (new Set(files.map(file => file.url)).size !== files.length) throw new Error('Duplicate macOS update artifact')
  const fallback = x64.files.find(file => file.url.endsWith('.zip'))
  const merged = {
    version: arm64.version,
    files,
    path: fallback.url,
    sha512: fallback.sha512,
    releaseDate: [arm64.releaseDate, x64.releaseDate].filter(Boolean).sort().at(-1),
  }
  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, dump(merged, { lineWidth: -1, noRefs: true }))
}

async function main() {
  const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  await mergeMacUpdateInfo({
    arm64Info: path.join(projectDir, 'dist/arm64/latest-mac.yml'),
    x64Info: path.join(projectDir, 'dist/x64/latest-mac.yml'),
    outputFile: path.join(projectDir, 'dist/latest-mac.yml'),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
