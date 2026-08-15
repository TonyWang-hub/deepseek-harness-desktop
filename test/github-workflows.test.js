import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { load } from 'js-yaml'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readWorkflow(filename) {
  return load(await readFile(path.join(appRoot, '.github/workflows', filename), 'utf8'))
}

async function readWorkflowSource(filename) {
  return readFile(path.join(appRoot, '.github/workflows', filename), 'utf8')
}

test('CI runs the source suite without release credentials', async () => {
  const workflow = await readWorkflow('ci.yml')

  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'))
  assert.deepEqual(workflow.on.push.branches, ['main'])

  const job = workflow.jobs.test
  assert.equal(job['runs-on'], 'ubuntu-latest')
  assert.equal(job['timeout-minutes'], 20)
  assert.equal(job.environment, undefined)

  const setup = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'))
  assert.deepEqual(setup?.with, {
    'node-version': '24.17.0',
    cache: 'npm',
    'registry-url': 'https://registry.npmjs.org',
  })
  assert.deepEqual(
    job.steps.filter(step => step.run).map(step => step.run),
    [
      'npm ci --no-audit --fund=false',
      'node build/prepare-electron.js',
      'sudo chown root:root node_modules/electron/dist/chrome-sandbox\nsudo chmod 4755 node_modules/electron/dist/chrome-sandbox\n',
      'xvfb-run --auto-servernum npm test',
    ],
  )
  assert.doesNotMatch(JSON.stringify(workflow), /secrets\.|CSC_|APPLE_|GH_TOKEN/)
})

test('release builds each architecture natively with signing and notarization credentials', async () => {
  const workflow = await readWorkflow('release-macos.yml')
  const source = await readWorkflowSource('release-macos.yml')

  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.deepEqual(workflow.on.push.tags, ['v*.*.*'])
  assert.equal(workflow.concurrency['cancel-in-progress'], false)

  const build = workflow.jobs.build
  assert.equal(build.environment, 'release')
  assert.equal(build['runs-on'], '${{ matrix.runner }}')
  assert.equal(build['timeout-minutes'], 120)
  assert.deepEqual(build.strategy, {
    'fail-fast': false,
    matrix: {
      include: [
        { arch: 'arm64', runner: 'macos-15' },
        { arch: 'x64', runner: 'macos-15-intel' },
      ],
    },
  })

  const setup = build.steps.find(step => step.uses?.startsWith('actions/setup-node@'))
  assert.equal(setup?.with?.['node-version'], '24.17.0')
  assert.match(source, /test "\$\(node -p 'process\.arch'\)" = "\$\{\{ matrix\.arch \}\}"/)
  assert.match(source, /npm run "dist:mac:\$\{\{ matrix\.arch \}\}"/)
  assert.match(source, /hdiutil verify/)
  assert.match(source, /unzip -tq/)
  assert.match(source, /xcrun stapler validate/)
  assert.match(source, /--smoke/)

  const secretNames = [...source.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match => match[1])
  assert.deepEqual([...new Set(secretNames)].sort(), [
    'APPLE_API_ISSUER',
    'APPLE_API_KEY_ID',
    'APPLE_API_KEY_P8_BASE64',
    'MAC_CSC_KEY_PASSWORD',
    'MAC_CSC_LINK',
  ])
  assert.doesNotMatch(source, /HARNESS_DESKTOP_ALLOW_UNSIGNED|CSC_IDENTITY_AUTO_DISCOVERY|npmmirror/)
})

test('release publishes only the verified ten-asset draft', async () => {
  const workflow = await readWorkflow('release-macos.yml')
  const source = await readWorkflowSource('release-macos.yml')
  const release = workflow.jobs.release

  assert.equal(release.needs, 'build')
  assert.equal(release['runs-on'], 'ubuntu-latest')
  assert.deepEqual(release.permissions, { contents: 'write' })
  assert.equal(release['timeout-minutes'], 30)
  assert.equal(release.env, undefined)

  const publish = release.steps.find(step => step.name === 'Upload verified draft and publish atomically')
  assert.equal(publish.env.GH_TOKEN, '${{ github.token }}')

  const downloads = release.steps.filter(step => step.uses?.startsWith('actions/download-artifact@'))
  assert.deepEqual(downloads.map(step => step.with), [
    { name: 'mac-arm64', path: 'dist/arm64' },
    { name: 'mac-x64', path: 'dist/x64' },
  ])
  assert.match(source, /npm run merge:mac:update/)
  assert.match(source, /verify-release-assets\.js prepare/)
  assert.match(source, /gh release create "\$tag" --draft --verify-tag/)
  assert.match(source, /gh release upload "\$tag" .*--clobber/)
  assert.match(source, /gh release download "\$tag"/)
  assert.match(source, /verify-release-assets\.js verify/)
  assert.match(source, /gh release edit "\$tag" --draft=false --latest/)
  assert.ok(source.indexOf('gh release download "$tag"') < source.indexOf('gh release edit "$tag" --draft=false --latest'))
})
