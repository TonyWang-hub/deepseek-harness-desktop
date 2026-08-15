import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertMacTargetInstall,
  builderArguments,
  builderEnvironment,
  packagedAppPath,
} from '../build/build-mac.js'

const requiredPackages = arch => [
  `node_modules/@img/sharp-darwin-${arch}`,
  `node_modules/@img/sharp-libvips-darwin-${arch}`,
  `node_modules/@koromix/koffi-darwin-${arch}`,
  `node_modules/@vscode/ripgrep-darwin-${arch}`,
  `node_modules/node-addon-require-builtin-darwin-${arch}`,
]

test('a macOS target requires a matching process and target-specific native install', async () => {
  const projectDir = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-target-'))
  try {
    const dynamicPackage = 'node_modules/example-new-darwin-addon'
    const lockedPackages = [...requiredPackages('arm64'), dynamicPackage]
    await writeFile(path.join(projectDir, 'package-lock.json'), JSON.stringify({
      packages: Object.fromEntries(lockedPackages.map(relativePath => [relativePath, {
        optional: true,
        os: ['darwin'],
        cpu: ['arm64'],
      }])),
    }))
    for (const relativePath of requiredPackages('arm64')) {
      await mkdir(path.join(projectDir, relativePath), { recursive: true })
    }
    await assert.rejects(
      assertMacTargetInstall({ projectDir, target: 'arm64', platform: 'darwin', architecture: 'arm64' }),
      /example-new-darwin-addon/,
    )
    await mkdir(path.join(projectDir, dynamicPackage), { recursive: true })
    await assertMacTargetInstall({
      projectDir,
      target: 'arm64',
      platform: 'darwin',
      architecture: 'arm64',
    })
    await assert.rejects(
      assertMacTargetInstall({ projectDir, target: 'x64', platform: 'darwin', architecture: 'arm64' }),
      /requires an x64 Node process/,
    )
  } finally {
    await rm(projectDir, { recursive: true, force: true })
  }
})

test('macOS builds use architecture-isolated output and explicit unsigned opt-in', () => {
  assert.deepEqual(builderArguments('arm64', { unsigned: false }), [
    '--mac', '--arm64', '--publish', 'never', '-c.directories.output=dist/arm64',
  ])
  assert.deepEqual(builderArguments('x64', { unsigned: true }), [
    '--mac', '--x64', '--publish', 'never', '-c.directories.output=dist/x64',
    '-c.forceCodeSigning=false', '-c.mac.notarize=false',
  ])
  assert.deepEqual(builderEnvironment({ CSC_IDENTITY_AUTO_DISCOVERY: 'true', SAFE: 'kept' }, { unsigned: true }), {
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    SAFE: 'kept',
  })
  assert.deepEqual(builderEnvironment({ SAFE: 'kept' }, { unsigned: false }), { SAFE: 'kept' })
  assert.equal(
    packagedAppPath('/checkout', 'arm64'),
    '/checkout/dist/arm64/mac-arm64/DeepSeek Harness Desktop.app',
  )
  assert.equal(
    packagedAppPath('/checkout', 'x64'),
    '/checkout/dist/x64/mac/DeepSeek Harness Desktop.app',
  )
})
