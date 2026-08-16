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
    if (error?.code === 'ENOENT') assert.fail(`Missing community file: ${relativePath}`)
    throw error
  }
}

test('community guidance is bilingual and routes security reports privately', async () => {
  const [contributing, conduct, security, support, owners, readme, readmeChinese, plan] = await Promise.all([
    readRequired('CONTRIBUTING.md'),
    readRequired('CODE_OF_CONDUCT.md'),
    readRequired('SECURITY.md'),
    readRequired('SUPPORT.md'),
    readRequired('.github/CODEOWNERS'),
    readRequired('README.md'),
    readRequired('README.zh-CN.md'),
    readRequired('PLAN.md'),
  ])

  for (const document of [contributing, conduct, security, support]) {
    assert.match(document, /English/)
    assert.match(document, /简体中文/)
  }
  assert.match(contributing, /npm ci/)
  assert.match(contributing, /@deepseek-ai\/dsh/)
  assert.match(security, /security\/advisories\/new/)
  assert.match(support, /discussions/)
  assert.equal(owners.trim(), '* @TonyWang-hub')
  for (const document of [readme, readmeChinese]) {
    assert.match(document, /\[Contributing\]\(CONTRIBUTING\.md\)/)
    assert.match(document, /\[Security\]\(SECURITY\.md\)/)
    assert.match(document, /\/discussions/)
    assert.match(document, /releases\/latest/)
    assert.match(document, /v0\.3\.0/)
    assert.match(document, /Export Diagnostics|导出诊断/)
    assert.match(document, /resume|唤醒/)
    assert.doesNotMatch(document, /nothing to download|没有.*下载|尚未发布.*二进制|no public binary|无公开二进制|feed pending|feed 待提供/i)
  }
  assert.match(support, /Export Diagnostics/)
  assert.match(support, /导出诊断/)
  assert.match(plan, /releases\/tag\/v0\.3\.0/)
  assert.doesNotMatch(plan, /尚需安全导出|签名、公证与首个 GitHub Release.*等待/)
})

test('issue forms and the pull request template collect actionable evidence', async () => {
  const [bugSource, featureSource, chooserSource, pullRequest] = await Promise.all([
    readRequired('.github/ISSUE_TEMPLATE/bug_report.yml'),
    readRequired('.github/ISSUE_TEMPLATE/feature_request.yml'),
    readRequired('.github/ISSUE_TEMPLATE/config.yml'),
    readRequired('.github/pull_request_template.md'),
  ])
  const bug = yaml.load(bugSource)
  const feature = yaml.load(featureSource)
  const chooser = yaml.load(chooserSource)

  assert.deepEqual(bug.labels, ['bug', 'status/needs-triage'])
  assert.ok(bug.body.some(item => item.id === 'reproduction' && item.validations?.required))
  assert.ok(bug.body.some(item => item.id === 'diagnostics'))
  assert.ok(bug.body.some(item => item.id === 'logs'))
  assert.deepEqual(feature.labels, ['enhancement', 'status/needs-triage'])
  assert.ok(feature.body.some(item => item.id === 'problem' && item.validations?.required))
  assert.equal(chooser.blank_issues_enabled, false)
  assert.ok(chooser.contact_links.some(link => link.url.endsWith('/discussions')))
  assert.ok(chooser.contact_links.some(link => link.url.endsWith('/security/advisories/new')))
  assert.match(pullRequest, /npm test/)
  assert.match(pullRequest, /official.*payload/i)
  assert.match(pullRequest, /官方.*载荷/)
})
