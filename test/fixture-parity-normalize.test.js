import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParityHistory } from '../acceptance/helpers/normalize-session.js'

test('parity normalization keeps semantic tools, approvals, errors, and completion', () => {
  const history = [
    { event: { type: 'turn/start', data: { turn: 1 }, seq: 1, time: 100 } },
    { event: { type: 'tool/call', data: { callId: 'parity-call-1', name: 'read', arguments: '{"file_path":"/tmp/run/workspace/probe.txt"}' }, seq: 2, time: 101 } },
    { event: { type: 'tool/result', data: { message: { toolCallId: 'parity-call-1', content: [{ content: [{ text: 'PARITY_READ_OK' }], isError: false }] } }, seq: 3, time: 102 } },
    { event: { type: 'approval/asked', data: { id: 'random-approval', callId: 'parity-call-2', toolName: 'bash' }, seq: 4, time: 103 } },
    { event: { type: 'approval/decided', data: { id: 'random-approval', outcome: 'allowed-once' }, seq: 5, time: 104 } },
    { event: { type: 'tool/result', data: { message: { toolCallId: 'parity-call-3', content: [{ content: [{ text: '/tmp/run/workspace/missing.txt not found' }], isError: true }] }, error: { name: 'NotFoundError', code: 'FS_NOT_FOUND' } }, seq: 6, time: 105 } },
    { event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'PARITY_COMPLETE' }] } }, seq: 7, time: 106 } },
    { event: { type: 'turn/end', data: { reason: { kind: 'completed' } }, seq: 8, time: 107 } },
  ]

  assert.deepEqual(normalizeParityHistory(history, { workspace: '/tmp/run/workspace' }), [
    { type: 'turn/start' },
    { type: 'tool/call', callId: 'parity-call-1', name: 'read', arguments: '{"file_path":"<WORKSPACE>/probe.txt"}' },
    { type: 'tool/result', callId: 'parity-call-1', text: 'PARITY_READ_OK', isError: false },
    { type: 'approval/asked', approvalId: '<APPROVAL_1>', callId: 'parity-call-2', toolName: 'bash' },
    { type: 'approval/decided', approvalId: '<APPROVAL_1>', outcome: 'allowed-once' },
    { type: 'tool/result', callId: 'parity-call-3', text: '<WORKSPACE>/missing.txt not found', errorName: 'NotFoundError', errorCode: 'FS_NOT_FOUND', isError: true },
    { type: 'assistant/message', text: 'PARITY_COMPLETE' },
    { type: 'turn/end', reason: 'completed' },
  ])
})

test('parity normalization canonicalizes JSON-escaped Windows workspace paths', () => {
  const history = [{
    event: {
      type: 'tool/call',
      data: {
        callId: 'parity-call-1',
        name: 'read',
        arguments: JSON.stringify({ file_path: String.raw`C:\Temp\parity\workspace\probe.txt` }),
      },
    },
  }]

  assert.deepEqual(
    normalizeParityHistory(history, { workspace: String.raw`C:\Temp\parity\workspace` }),
    [{
      type: 'tool/call',
      callId: 'parity-call-1',
      name: 'read',
      arguments: '{"file_path":"<WORKSPACE>/probe.txt"}',
    }],
  )
})

test('parity normalization preserves every assistant message and rejects unknown events', () => {
  assert.deepEqual(normalizeParityHistory([{
    event: {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: 'unexpected deterministic text' }] } },
    },
  }], { workspace: '/tmp/workspace' }), [
    { type: 'assistant/message', text: 'unexpected deterministic text' },
  ])

  assert.throws(
    () => normalizeParityHistory([{ event: { type: 'fixture/new-semantic-event', data: {} } }], {
      workspace: '/tmp/workspace',
    }),
    /Unsupported parity event type: fixture\/new-semantic-event/,
  )
})
