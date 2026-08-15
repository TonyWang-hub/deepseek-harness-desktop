import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'
import { inflateSync } from 'node:zlib'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const execFileAsync = promisify(execFile)
const readJson = async relativePath => JSON.parse(await readFile(path.join(appRoot, relativePath), 'utf8'))

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upperLeftDistance = Math.abs(estimate - upperLeft)
  return leftDistance <= upDistance && leftDistance <= upperLeftDistance
    ? left
    : upDistance <= upperLeftDistance ? up : upperLeft
}

function pngHasTransparentPixel(png) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const bytesPerPixel = 4
  const idat = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }

  const encoded = inflateSync(Buffer.concat(idat))
  const stride = width * bytesPerPixel
  const decoded = Buffer.alloc(stride * height)
  for (let y = 0, inputOffset = 0; y < height; y += 1) {
    const filter = encoded[inputOffset]
    inputOffset += 1
    const rowOffset = y * stride
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[inputOffset + x]
      const left = x >= bytesPerPixel ? decoded[rowOffset + x - bytesPerPixel] : 0
      const up = y > 0 ? decoded[rowOffset - stride + x] : 0
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? decoded[rowOffset - stride + x - bytesPerPixel]
        : 0
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : filter === 4 ? paeth(left, up, upperLeft)
                : NaN
      assert.equal(Number.isNaN(predictor), false, `unsupported PNG filter ${filter}`)
      decoded[rowOffset + x] = (raw + predictor) & 0xff
    }
    inputOffset += stride
  }
  for (let offset = 3; offset < decoded.length; offset += bytesPerPixel) {
    if (decoded[offset] < 255) return true
  }
  return false
}

function icnsChunkTypes(icns) {
  const types = []
  let offset = 8
  while (offset < icns.length) {
    const type = icns.subarray(offset, offset + 4).toString('ascii')
    const length = icns.readUInt32BE(offset + 4)
    assert.ok(length >= 8, `${type} chunk is shorter than its header`)
    assert.ok(offset + length <= icns.length, `${type} chunk exceeds the ICNS file`)
    types.push(type)
    offset += length
  }
  assert.equal(offset, icns.length)
  return types
}

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
  assert.equal(pkg.build.mac.icon, 'build/icon.icns')
  assert.equal(pkg.build.dmg.icon, 'build/icon.icns')
  assert.deepEqual(pkg.build.files, ['src/**/*', 'bin/**/*'])
  assert.deepEqual(pkg.build.publish, [{
    provider: 'github',
    owner: 'TonyWang-hub',
    repo: 'deepseek-harness-desktop',
    releaseType: 'draft',
  }])
})

test('source tests prepare one Electron runtime before concurrent test workers', async () => {
  const pkg = await readJson('package.json')

  assert.equal(pkg.scripts.pretest, 'node build/prepare-electron.js')
  await execFileAsync(process.execPath, [path.join(appRoot, 'build/prepare-electron.js')])
})

test('the app icon is a deterministic monochrome macOS asset', async () => {
  const svg = await readFile(path.join(appRoot, 'build/icon.svg'), 'utf8')
  const png = await readFile(path.join(appRoot, 'build/icon-1024.png'))
  const icns = await readFile(path.join(appRoot, 'build/icon.icns'))

  assert.match(svg, /viewBox="0 0 1024 1024"/)
  assert.match(svg, /<title>Terminal loop<\/title>/)
  assert.doesNotMatch(svg, /gradient|filter|<text|<image|href=/i)
  assert.deepEqual(new Set(svg.match(/#[0-9a-f]{6}/gi)), new Set(['#000000', '#ffffff']))

  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.readUInt32BE(16), 1024)
  assert.equal(png.readUInt32BE(20), 1024)
  assert.equal(png[24], 8)
  assert.equal(png[25], 6)
  assert.equal(pngHasTransparentPixel(png), true)

  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns')
  assert.equal(icns.readUInt32BE(4), icns.length)
  assert.deepEqual(icnsChunkTypes(icns).sort(), [
    'ic04', 'ic05', 'ic07', 'ic08', 'ic09', 'ic10', 'ic11', 'ic12', 'ic13', 'ic14', 'info',
  ])
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
