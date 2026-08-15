import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParityHistory } from '../acceptance/helpers/normalize-session.js'

test('parity normalization keeps semantic tools, approvals, errors, and completion', () => {
  const history = [
    { event: { type: 'turn/start', data: { turn: 1 }, seq: 1, time: 100 } },
    { event: { type: 'tool/call', data: { name: 'read', arguments: '{"file_path":"/tmp/run/workspace/probe.txt"' }, seq: 2, time: 101 } },
    { event: { type: 'tool/result', data: { message: { content: [{ content: [{ text: 'PARITY_READ_OK' }], isError: false }] } }, seq: 3, time: 102 } },
    { event: { type: 'approval/asked', data: { toolName: 'bash' }, seq: 4, time: 103 } },
    { event: { type: 'approval/decided', data: { outcome: 'allowed-once' }, seq: 5, time: 104 } },
    { event: { type: 'tool/result', data: { message: { content: [{ content: [{ text: 'not found' }], isError: true }] }, error: { code: 'FS_NOT_FOUND' } }, seq: 6, time: 105 } },
    { event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'PARITY_COMPLETE' }] } }, seq: 7, time: 106 } },
    { event: { type: 'turn/end', data: { reason: { kind: 'completed' } }, seq: 8, time: 107 } },
  ]

  assert.deepEqual(normalizeParityHistory(history, { workspace: '/tmp/run/workspace' }), [
    { type: 'turn/start' },
    { type: 'tool/call', name: 'read', arguments: '{"file_path":"<WORKSPACE>/probe.txt"' },
    { type: 'tool/result', marker: 'PARITY_READ_OK', isError: false },
    { type: 'approval/asked', toolName: 'bash' },
    { type: 'approval/decided', outcome: 'allowed-once' },
    { type: 'tool/result', errorCode: 'FS_NOT_FOUND', isError: true },
    { type: 'assistant/message', text: 'PARITY_COMPLETE' },
    { type: 'turn/end', reason: 'completed' },
  ])
})
