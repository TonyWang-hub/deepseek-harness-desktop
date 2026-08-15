import assert from 'node:assert/strict'
import test from 'node:test'

import { isExpectedParityApproval } from '../acceptance/helpers/parity-contract.js'

const expected = {
  type: 'approval/requested',
  sessionId: 'session-1',
  approvalId: 'approval-1',
  callId: 'parity-call-2',
  toolName: 'bash',
}

test('fixture approval accepts only its exact session and scripted bash call', () => {
  assert.equal(isExpectedParityApproval(expected, 'session-1'), true)
  assert.equal(isExpectedParityApproval({ ...expected, sessionId: 'other' }, 'session-1'), false)
  assert.equal(isExpectedParityApproval({ ...expected, callId: 'injected-call' }, 'session-1'), false)
  assert.equal(isExpectedParityApproval({ ...expected, toolName: 'write' }, 'session-1'), false)
  assert.equal(isExpectedParityApproval({ ...expected, approvalId: '' }, 'session-1'), false)
})
