import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async relativePath => JSON.parse(await readFile(path.join(appRoot, relativePath), 'utf8'))

test('release dependencies and macOS packaging stay exact and self-contained', async () => {
  const pkg = await readJson('package.json')
  const lock = await readJson('package-lock.json')

  assert.equal(pkg.version, '0.2.0')
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.equal(pkg.author, 'TonyWang-hub')
  assert.equal(pkg.engines.node, '>=24.17.0 <25')
  assert.deepEqual(Object.keys(pkg.scripts).filter(name => name.startsWith('release:mac')), [])
  assert.equal(pkg.scripts['dist:mac:arm64'], 'node build/build-mac.js arm64')
  assert.equal(pkg.scripts['dist:mac:x64'], 'node build/build-mac.js x64')
  assert.equal(pkg.scripts['merge:mac:update'], 'node build/merge-mac-update-info.js')
  assert.equal(pkg.scripts['test:packaged'], 'node --test acceptance/packaged.test.js')
  assert.equal(pkg.devDependencies.electron, '43.4.0')
  assert.equal(pkg.devDependencies['electron-builder'], '26.15.3')
  assert.equal(pkg.dependencies['electron-updater'], '6.8.9')
  assert.equal(pkg.dependencies.pnpm, '11.21.0')
  assert.equal(pkg.build.asar, false)
  assert.equal(pkg.build.afterPack, 'build/after-pack.js')
  assert.equal(pkg.build.afterSign, 'build/after-sign.js')
  assert.equal(pkg.build.forceCodeSigning, true)
  assert.equal(pkg.build.artifactName, 'DeepSeek-Harness-Desktop-${version}-${os}-${arch}.${ext}')
  assert.deepEqual(pkg.build.mac.target, ['dmg', 'zip'])
  assert.equal(pkg.build.mac.notarize, true)
  assert.deepEqual(pkg.build.files, ['src/**/*', 'bin/**/*'])
  assert.deepEqual(pkg.build.publish, [{
    provider: 'github',
    owner: 'TonyWang-hub',
    repo: 'deepseek-harness-desktop',
    releaseType: 'draft',
  }])
})

test('the release lock resolves packages only from the official npm registry', async () => {
  const lock = await readJson('package-lock.json')
  const foreign = []
  const incomplete = []
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (entry.resolved && new URL(entry.resolved).host !== 'registry.npmjs.org') foreign.push(packagePath)
    if (packagePath && entry.version && (!entry.resolved || !entry.integrity)) incomplete.push(packagePath)
  }
  assert.deepEqual(foreign, [])
  assert.deepEqual(incomplete, [])
})

test('macOS hardened-runtime entitlements stay minimal', async () => {
  const main = await readFile(path.join(appRoot, 'build/entitlements.mac.plist'), 'utf8')
  const inherited = await readFile(path.join(appRoot, 'build/entitlements.mac.inherit.plist'), 'utf8')

  assert.equal(inherited, main)
  assert.match(main, /com\.apple\.security\.cs\.allow-jit/)
  assert.doesNotMatch(main, /allow-unsigned-executable-memory/)
  assert.doesNotMatch(main, /disable-library-validation/)
  assert.doesNotMatch(main, /get-task-allow/)
  assert.doesNotMatch(main, /com\.apple\.security\.app-sandbox/)
})
