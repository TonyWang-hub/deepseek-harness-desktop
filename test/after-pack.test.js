import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { copyRuntimeClosure } from '../build/after-pack.js'

async function writePackage(root, relativePath, marker) {
  const packageRoot = path.join(root, relativePath)
  await mkdir(packageRoot, { recursive: true })
  await writeFile(path.join(packageRoot, 'marker.txt'), marker)
}

test('packaging fills the installed production closure without copying dev dependencies', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-after-pack-'))
  const appRoot = path.join(projectDir, 'packaged-app')
  try {
    await writePackage(projectDir, 'node_modules/runtime-package', 'runtime')
    await writePackage(projectDir, 'node_modules/peer-package', 'peer')
    await writePackage(projectDir, 'node_modules/dev-package', 'dev')
    await mkdir(appRoot, { recursive: true })
    await writeFile(path.join(projectDir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': {},
        'node_modules/runtime-package': { version: '1.0.0' },
        'node_modules/peer-package': { version: '1.0.0', peer: true },
        'node_modules/dev-package': { version: '1.0.0', dev: true },
        'node_modules/platform-package': { version: '1.0.0', optional: true },
      },
    }))

    await copyRuntimeClosure({ projectDir, appRoot })

    assert.equal(await readFile(path.join(appRoot, 'node_modules/runtime-package/marker.txt'), 'utf8'), 'runtime')
    assert.equal(await readFile(path.join(appRoot, 'node_modules/peer-package/marker.txt'), 'utf8'), 'peer')
    await assert.rejects(readFile(path.join(appRoot, 'node_modules/dev-package/marker.txt'), 'utf8'), { code: 'ENOENT' })
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
})

test('packaging rejects an incomplete required install', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-after-pack-'))
  const appRoot = path.join(projectDir, 'packaged-app')
  try {
    await mkdir(appRoot, { recursive: true })
    await writeFile(path.join(projectDir, 'package-lock.json'), JSON.stringify({
      packages: {
        '': {},
        'node_modules/missing-package': { version: '1.0.0' },
      },
    }))

    await assert.rejects(
      copyRuntimeClosure({ projectDir, appRoot }),
      /required runtime package is not installed: node_modules\/missing-package/,
    )
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
})
