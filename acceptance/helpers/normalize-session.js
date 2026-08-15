function nestedText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(nestedText).filter(Boolean).join('\n')
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  return Object.values(value).map(nestedText).filter(Boolean).join('\n')
}

function canonicalText(text, workspace) {
  const canonicalWorkspace = workspace.replaceAll('\\', '/')
  return text.replaceAll('\\', '/').replaceAll(canonicalWorkspace, '<WORKSPACE>')
}

function canonicalJson(value, workspace) {
  if (typeof value === 'string') return canonicalText(value, workspace)
  if (Array.isArray(value)) return value.map(item => canonicalJson(item, workspace))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key], workspace)]))
}

function canonicalArguments(argumentsJson, workspace) {
  let parsed
  try {
    parsed = JSON.parse(argumentsJson)
  } catch {
    throw new Error(`Parity tool arguments are not valid JSON: ${argumentsJson}`)
  }
  return JSON.stringify(canonicalJson(parsed, workspace))
}

/**
 * Project a session history onto the deterministic behavior contract shared by
 * direct-browser and desktop-host runs. Volatile transport/request events are
 * explicitly ignored; unknown event types fail closed instead of disappearing.
 *
 * @param {Array<{event: {type: string, data: any}}>} entries
 * @param {{workspace: string}} options
 */
export function requiredParityTrace(trace) {
  return trace.filter(event => !event.type.startsWith('compaction/')
    && !(event.type === 'user/message' && event.source !== 'user'))
}

export function normalizeParityHistory(entries, { workspace }) {
  const normalized = []
  const approvalIds = new Map()
  const approvalId = value => {
    if (!approvalIds.has(value)) approvalIds.set(value, `<APPROVAL_${approvalIds.size + 1}>`)
    return approvalIds.get(value)
  }
  const compactionIds = new Map()
  const compactionId = value => {
    if (!compactionIds.has(value)) compactionIds.set(value, `<COMPACTION_${compactionIds.size + 1}>`)
    return compactionIds.get(value)
  }

  for (const { event } of entries) {
    switch (event.type) {
      case 'request/header':
      case 'request/context':
      case 'assistant/chunk':
        break
      case 'turn/start':
      case 'step/start':
      case 'step/end':
        normalized.push({ type: event.type })
        break
      case 'user/message': {
        const source = event.data?.source
        if (!source || source.kind === 'user') {
          normalized.push({
            type: event.type,
            source: 'user',
            text: canonicalText(nestedText(event.data?.content ?? event.data), workspace),
          })
        } else {
          normalized.push({
            type: event.type,
            source: source.kind,
            ...(source.plugin === undefined ? {} : { plugin: source.plugin }),
            ...(source.form === undefined ? {} : { form: source.form }),
            ...(source.sections === undefined ? {} : {
              sections: source.sections.map(section => section.name),
            }),
            ...(source.summary === undefined ? {} : { summary: source.summary }),
          })
        }
        break
      }
      case 'tool/call':
        normalized.push({
          type: event.type,
          callId: event.data.callId,
          name: event.data.name,
          arguments: canonicalArguments(event.data.arguments, workspace),
        })
        break
      case 'tool/result': {
        const block = event.data.message?.content?.find(item => item.type === 'tool-result')
          ?? event.data.message?.content?.find(item => item.isError !== undefined)
          ?? event.data.message?.content?.[0]
        const text = canonicalText(nestedText(block?.content ?? block), workspace)
        const isError = block?.isError === true
        normalized.push({
          type: event.type,
          callId: block?.toolCallId ?? event.data.message?.toolCallId,
          text,
          ...(event.data.error?.name === undefined ? {} : { errorName: event.data.error.name }),
          ...(event.data.error?.code === undefined ? {} : { errorCode: event.data.error.code }),
          isError,
        })
        break
      }
      case 'approval/asked':
        normalized.push({
          type: event.type,
          approvalId: approvalId(event.data.id),
          ...(event.data.callId === undefined ? {} : { callId: event.data.callId }),
          toolName: event.data.toolName,
        })
        break
      case 'approval/decided':
        normalized.push({
          type: event.type,
          approvalId: approvalId(event.data.id),
          outcome: event.data.outcome,
        })
        break
      case 'approval/policy':
        normalized.push({ type: event.type, policy: event.data.policy })
        break
      case 'permission/preset':
        normalized.push({ type: event.type, preset: event.data.preset })
        break
      case 'sandbox/mode':
        normalized.push({ type: event.type, mode: event.data.mode })
        break
      case 'agent/inbox/spliced':
        normalized.push({
          type: event.type,
          target: event.data.target,
          start: event.data.start,
          removedCount: event.data.removedCount ?? 0,
          inserted: event.data.inserted.map(message => (
            canonicalText(nestedText(message.content ?? message), workspace)
          )),
          ...(event.data.outcome === undefined ? {} : { outcome: event.data.outcome }),
        })
        break
      case 'session/title':
        normalized.push({
          type: event.type,
          title: event.data.title,
          source: event.data.source?.kind,
        })
        break
      case 'compaction/start':
        normalized.push({
          type: event.type,
          compactionId: compactionId(event.data.compactionId),
          turn: event.data.turn,
        })
        break
      case 'compaction/summary':
        normalized.push({
          type: event.type,
          compactionId: compactionId(event.data.compactionId),
          text: canonicalText(nestedText(event.data.summary), workspace),
        })
        break
      case 'compaction/end':
        normalized.push({
          type: event.type,
          compactionId: compactionId(event.data.compactionId),
          status: event.data.error === undefined ? 'completed' : 'error',
        })
        break
      case 'assistant/message': {
        const blocks = event.data.message?.content ?? []
        const toolCalls = blocks.filter(block => block.type === 'tool-call').map(block => ({
          callId: block.id,
          name: block.name,
          arguments: canonicalArguments(block.arguments, workspace),
        }))
        const text = canonicalText(
          blocks.filter(block => block.type === 'text').map(block => block.text).join(''),
          workspace,
        )
        normalized.push({
          type: event.type,
          ...(text ? { text } : {}),
          ...(toolCalls.length ? { toolCalls } : {}),
        })
        break
      }
      case 'turn/end':
        normalized.push({ type: event.type, reason: event.data.reason?.kind })
        break
      default:
        throw new Error(`Unsupported parity event type: ${event.type}`)
    }
  }
  return normalized
}
