import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

import { dump } from 'js-yaml'

import {
  expectedReleaseAssetNames,
  verifyReleaseAssets,
  writeReleaseChecksums,
} from '../build/verify-release-assets.js'

const VERSION = '0.2.0'
const execFile = promisify(execFileCallback)

function digest(algorithm, value) {
  return createHash(algorithm).update(value).digest(algorithm === 'sha512' ? 'base64' : 'hex')
}

async function writeFixture(root) {
  const files = []
  for (const arch of ['arm64', 'x64']) {
    for (const extension of ['dmg', 'zip']) {
      const url = `DeepSeek-Harness-Desktop-${VERSION}-mac-${arch}.${extension}`
      const content = `${arch}-${extension}-payload`
      await writeFile(path.join(root, url), content)
      await writeFile(path.join(root, `${url}.blockmap`), `${arch}-${extension}-blockmap`)
      files.push({ url, sha512: digest('sha512', content), size: Buffer.byteLength(content) })
    }
  }
  const fallback = files.find(file => file.url.endsWith('-x64.zip'))
  await writeFile(path.join(root, 'latest-mac.yml'), dump({
    version: VERSION,
    files,
    path: fallback.url,
    sha512: fallback.sha512,
    releaseDate: '2026-08-15T00:00:00.000Z',
  }, { lineWidth: -1, noRefs: true }))
}

async function withFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-release-assets-'))
  try {
    await writeFixture(root)
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('release verification accepts the exact dual-architecture asset set', async () => {
  await withFixture(async root => {
    await writeReleaseChecksums({ releaseDir: root, version: VERSION })
    await verifyReleaseAssets({ releaseDir: root, version: VERSION })

    const checksums = (await readFile(path.join(root, 'SHA256SUMS.txt'), 'utf8')).trim().split('\n')
    assert.equal(checksums.length, 9)
    assert.deepEqual(
      checksums.map(line => line.slice(66)),
      expectedReleaseAssetNames(VERSION).filter(filename => filename !== 'SHA256SUMS.txt'),
    )
  })
})

test('release asset CLI prepares and verifies a staged directory', async () => {
  await withFixture(async root => {
    const cli = fileURLToPath(new URL('../build/verify-release-assets.js', import.meta.url))
    await execFile(process.execPath, [cli, 'prepare', root, VERSION])
    await execFile(process.execPath, [cli, 'verify', root, VERSION])
    assert.match(await readFile(path.join(root, 'SHA256SUMS.txt'), 'utf8'), /latest-mac\.yml/)
  })
})

test('release verification rejects an unexpected asset', async () => {
  await withFixture(async root => {
    await writeReleaseChecksums({ releaseDir: root, version: VERSION })
    await writeFile(path.join(root, 'unreviewed.txt'), 'unexpected')

    await assert.rejects(
      verifyReleaseAssets({ releaseDir: root, version: VERSION }),
      /Unexpected release asset inventory: unreviewed\.txt/,
    )
  })
})

test('release verification rejects a payload that disagrees with update metadata', async () => {
  await withFixture(async root => {
    const payload = `DeepSeek-Harness-Desktop-${VERSION}-mac-arm64.zip`
    await writeFile(path.join(root, payload), 'tampered-after-metadata')
    await writeReleaseChecksums({ releaseDir: root, version: VERSION })

    await assert.rejects(
      verifyReleaseAssets({ releaseDir: root, version: VERSION }),
      new RegExp(`Update metadata does not match ${payload.replaceAll('.', '\\.')}`),
    )
  })
})

test('release verification rejects a tampered human checksum', async () => {
  await withFixture(async root => {
    await writeReleaseChecksums({ releaseDir: root, version: VERSION })
    const checksumFile = path.join(root, 'SHA256SUMS.txt')
    const checksums = await readFile(checksumFile, 'utf8')
    await writeFile(checksumFile, checksums.replace(/^[0-9a-f]/, value => value === '0' ? '1' : '0'))

    await assert.rejects(
      verifyReleaseAssets({ releaseDir: root, version: VERSION }),
      /SHA256SUMS\.txt does not match/,
    )
  })
})
