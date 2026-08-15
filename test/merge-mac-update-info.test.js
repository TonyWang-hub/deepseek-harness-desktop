import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { load } from 'js-yaml'

import { mergeMacUpdateInfo } from '../build/merge-mac-update-info.js'

const sha512 = value => createHash('sha512').update(value).digest('base64')

async function writeArch(root, arch, version = '0.1.0') {
  const directory = path.join(root, arch)
  await mkdir(directory, { recursive: true })
  const files = []
  for (const extension of ['zip', 'dmg']) {
    const url = `DeepSeek-Harness-Desktop-${version}-mac-${arch}.${extension}`
    const content = `${arch}-${extension}`
    await writeFile(path.join(directory, url), content)
    files.push({ url, sha512: sha512(content), size: Buffer.byteLength(content) })
  }
  await writeFile(path.join(directory, 'latest-mac.yml'), [
    `version: ${version}`,
    'files:',
    ...files.flatMap(file => [
      `  - url: ${file.url}`,
      `    sha512: ${file.sha512}`,
      `    size: ${file.size}`,
    ]),
    `path: ${files[0].url}`,
    `sha512: ${files[0].sha512}`,
    `releaseDate: '2026-08-15T00:00:0${arch === 'arm64' ? '1' : '2'}.000Z'`,
    '',
  ].join('\n'))
  return path.join(directory, 'latest-mac.yml')
}

test('macOS update metadata contains verified files for both architectures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-update-'))
  try {
    const arm64Info = await writeArch(root, 'arm64')
    const x64Info = await writeArch(root, 'x64')
    const outputFile = path.join(root, 'latest-mac.yml')
    await mergeMacUpdateInfo({ arm64Info, x64Info, outputFile })

    const merged = load(await readFile(outputFile, 'utf8'))
    assert.equal(merged.version, '0.1.0')
    assert.equal(merged.files.length, 4)
    assert.equal(merged.files.filter(file => file.url.endsWith('-arm64.zip')).length, 1)
    assert.equal(merged.files.filter(file => file.url.endsWith('-x64.zip')).length, 1)
    assert.match(merged.path, /-x64\.zip$/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('macOS update metadata rejects mismatched release versions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-update-'))
  try {
    const arm64Info = await writeArch(root, 'arm64', '0.1.0')
    const x64Info = await writeArch(root, 'x64', '0.2.0')
    await assert.rejects(
      mergeMacUpdateInfo({ arm64Info, x64Info, outputFile: path.join(root, 'latest-mac.yml') }),
      /version mismatch/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
