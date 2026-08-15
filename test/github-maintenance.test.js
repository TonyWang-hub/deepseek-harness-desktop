import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import yaml from 'js-yaml'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(appRoot, relativePath), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') assert.fail(`Missing GitHub maintenance file: ${relativePath}`)
    throw error
  }
}

test('Dependabot maintains npm and GitHub Actions without moving the pinned DSH payload', async () => {
  const config = yaml.load(await readRequired('.github/dependabot.yml'))

  assert.equal(config.version, 2)
  assert.deepEqual(config.updates.map(update => update['package-ecosystem']).sort(), ['github-actions', 'npm'])
  for (const update of config.updates) {
    assert.equal(update.schedule.interval, 'weekly')
    assert.equal(update.schedule.timezone, 'Asia/Taipei')
    assert.ok(update.labels.includes('dependencies'))
  }
  const npm = config.updates.find(update => update['package-ecosystem'] === 'npm')
  assert.ok(npm.ignore.some(rule => rule['dependency-name'] === '@deepseek-ai/dsh'))
  assert.ok(npm.ignore.some(rule =>
    rule['dependency-name'] === '*' &&
    rule['update-types']?.includes('version-update:semver-major')))
  assert.ok(npm.groups['development-dependencies'])
  assert.ok(npm.groups['production-dependencies'])
})

test('generated release notes classify user changes and dependency maintenance', async () => {
  const config = yaml.load(await readRequired('.github/release.yml'))
  const categories = config.changelog.categories

  assert.ok(config.changelog.exclude.labels.includes('skip-changelog'))
  assert.ok(categories.some(category => category.labels.includes('breaking-change')))
  assert.ok(categories.some(category => category.labels.includes('enhancement')))
  assert.ok(categories.some(category => category.labels.includes('bug')))
  assert.ok(categories.some(category => category.labels.includes('documentation')))
  assert.ok(categories.some(category => category.labels.includes('dependencies')))
  assert.deepEqual(categories.at(-1).labels, ['*'])
})

test('both READMEs expose the public CI result', async () => {
  const readmes = await Promise.all([readRequired('README.md'), readRequired('README.zh-CN.md')])
  for (const readme of readmes) {
    assert.match(readme, /actions\/workflows\/ci\.yml\/badge\.svg/)
    assert.match(readme, /License-MIT-black\.svg/)
  }
})
