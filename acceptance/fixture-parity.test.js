import assert from 'node:assert/strict'
import test from 'node:test'

import { runParityEntry } from './helpers/fixture-host.js'

const EXPECTED = [
  { type: 'turn/start' },
  { type: 'tool/call', name: 'read', arguments: '{"file_path":"<WORKSPACE>/probe.txt"}' },
  { type: 'tool/result', marker: 'PARITY_READ_OK', isError: false },
  {
    type: 'tool/call',
    name: 'bash',
    arguments: '{"command":"printf PARITY_APPROVAL_OK","description":"Print deterministic parity approval marker","sandbox_permissions":"danger-full-access","justification":"The parity fixture verifies the real approval flow with a harmless command."}',
  },
  { type: 'approval/asked', toolName: 'bash' },
  { type: 'approval/decided', outcome: 'allowed-once' },
  { type: 'tool/result', marker: 'PARITY_APPROVAL_OK', isError: false },
  { type: 'tool/call', name: 'read', arguments: '{"file_path":"<WORKSPACE>/missing.txt"}' },
  { type: 'tool/result', errorCode: 'FS_NOT_FOUND', isError: true },
  { type: 'assistant/message', text: 'PARITY_COMPLETE' },
  { type: 'turn/end', reason: 'completed' },
]

test('direct browser and desktop entries replay the same real Host behavior', { timeout: 240_000 }, async () => {
  const browser = await runParityEntry('browser')
  const desktop = await runParityEntry('desktop')

  assert.deepEqual(browser, EXPECTED)
  assert.deepEqual(desktop, EXPECTED)
  assert.deepEqual(desktop, browser)
})
