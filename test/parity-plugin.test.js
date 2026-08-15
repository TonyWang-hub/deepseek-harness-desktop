import assert from 'node:assert/strict'
import test from 'node:test'

import { ParityAdapter } from '../fixtures/plugins/parity-probe/index.js'

async function blocks(adapter, overrides = {}) {
  const chunks = []
  for await (const chunk of adapter.stream({
    provider: 'parity',
    model: 'parity-model',
    messages: [],
    ...overrides,
  })) {
    chunks.push(chunk)
  }
  return chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block)
}

test('the parity adapter scripts read, approval, error, and final response turns', async () => {
  const adapter = new ParityAdapter({ workspace: '/fixture/workspace' })

  assert.equal((await blocks(adapter))[0].name, 'read')
  assert.deepEqual(await blocks(adapter, { purpose: 'compaction' }), [{
    type: 'text',
    text: 'PARITY_COMPACTION',
  }])
  assert.equal((await blocks(adapter))[0].name, 'bash')
  assert.equal((await blocks(adapter))[0].name, 'read')
  assert.deepEqual(await blocks(adapter), [{ type: 'text', text: 'PARITY_COMPLETE' }])
})
