import assert from 'node:assert/strict'
import test from 'node:test'

import { runParityEntry } from './helpers/fixture-host.js'
import { requiredParityTrace } from './helpers/normalize-session.js'

const READ_ARGUMENTS = '{"file_path":"<WORKSPACE>/probe.txt"}'
const MISSING_ARGUMENTS = '{"file_path":"<WORKSPACE>/missing.txt"}'
const BASH_ARGUMENTS = '{"command":"printf PARITY_APPROVAL_OK","description":"Print deterministic parity approval marker","justification":"The parity fixture verifies the real approval flow with a harmless command.","sandbox_permissions":"danger-full-access"}'
const EXPECTED = [
  { type: 'permission/preset', preset: 'workspace-write' },
  { type: 'sandbox/mode', mode: 'workspace-write' },
  { type: 'approval/policy', policy: 'ask' },
  {
    type: 'agent/inbox/spliced',
    target: 'next-turn',
    start: 0,
    removedCount: 0,
    inserted: ['Run the deterministic parity fixture.'],
  },
  { type: 'turn/start' },
  { type: 'agent/inbox/spliced', target: 'next-turn', start: 0, removedCount: 1, inserted: [] },
  { type: 'step/start' },
  { type: 'user/message', source: 'user', text: 'Run the deterministic parity fixture.' },
  {
    type: 'session/title',
    title: 'Run the deterministic parity fixture.',
    source: 'fallback',
  },
  {
    type: 'assistant/message',
    toolCalls: [{ callId: 'parity-call-1', name: 'read', arguments: READ_ARGUMENTS }],
  },
  { type: 'tool/call', callId: 'parity-call-1', name: 'read', arguments: READ_ARGUMENTS },
  {
    type: 'tool/result',
    callId: 'parity-call-1',
    text: '<path><WORKSPACE>/probe.txt</path>\n<type>file</type>\n<content>\n1: PARITY_READ_OK\n\n(End of file - total 1 lines)\n</content>',
    isError: false,
  },
  { type: 'step/end' },
  { type: 'step/start' },
  {
    type: 'assistant/message',
    toolCalls: [{ callId: 'parity-call-2', name: 'bash', arguments: BASH_ARGUMENTS }],
  },
  { type: 'tool/call', callId: 'parity-call-2', name: 'bash', arguments: BASH_ARGUMENTS },
  {
    type: 'approval/asked',
    approvalId: '<APPROVAL_1>',
    callId: 'parity-call-2',
    toolName: 'bash',
  },
  { type: 'approval/decided', approvalId: '<APPROVAL_1>', outcome: 'allowed-once' },
  { type: 'tool/result', callId: 'parity-call-2', text: 'PARITY_APPROVAL_OK', isError: false },
  { type: 'step/end' },
  { type: 'step/start' },
  {
    type: 'assistant/message',
    toolCalls: [{ callId: 'parity-call-3', name: 'read', arguments: MISSING_ARGUMENTS }],
  },
  { type: 'tool/call', callId: 'parity-call-3', name: 'read', arguments: MISSING_ARGUMENTS },
  {
    type: 'tool/result',
    callId: 'parity-call-3',
    text: 'Error: cannot read "<WORKSPACE>/missing.txt": not found',
    errorName: 'FsError',
    errorCode: 'FS_NOT_FOUND',
    isError: true,
  },
  { type: 'step/end' },
  { type: 'step/start' },
  { type: 'assistant/message', text: 'PARITY_COMPLETE' },
  { type: 'step/end' },
  { type: 'turn/end', reason: 'completed' },
]

test('direct browser and desktop entries replay the same real Host behavior', { timeout: 240_000 }, async () => {
  const browser = await runParityEntry('browser')
  const desktop = await runParityEntry('desktop')

  assert.deepEqual(desktop, browser)
  assert.deepEqual(requiredParityTrace(browser), EXPECTED)
  assert.deepEqual(requiredParityTrace(desktop), EXPECTED)
})
