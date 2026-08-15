import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const require = createRequire(import.meta.url)
const dshBin = require.resolve('@deepseek-ai/dsh/lib/bin.js')
const execFileAsync = promisify(execFile)
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const patch = path.join(appRoot, 'fixtures/parity/cordis.patch.yml')

test('the parity overlay selects the external deterministic adapter', async () => {
  const dshHome = await mkdtemp(path.join(tmpdir(), 'dsh-desktop-parity-config-'))
  try {
    const result = await execFileAsync(process.execPath, [
      dshBin,
      'web',
      '--patch',
      patch,
      '--dump-config',
    ], {
      cwd: appRoot,
      env: {
        ...process.env,
        DSH_HOME: dshHome,
        PARITY_WORKSPACE: path.join(appRoot, 'fixtures/parity/workspace'),
      },
    })

    assert.match(result.stdout, /id: parity-probe/)
    assert.match(result.stdout, /provider: parity/)
    assert.match(result.stdout, /model: parity-model/)
    assert.match(result.stdout, /id: session-title-llm[\s\S]*disabled: true/)
  } finally {
    await rm(dshHome, { recursive: true, force: true })
  }
})
