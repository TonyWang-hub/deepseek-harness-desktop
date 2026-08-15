export function isExpectedParityApproval(frame, sessionId) {
  return frame?.type === 'approval/requested'
    && frame.sessionId === sessionId
    && typeof frame.approvalId === 'string'
    && frame.approvalId.length > 0
    && frame.callId === 'parity-call-2'
    && frame.toolName === 'bash'
}
