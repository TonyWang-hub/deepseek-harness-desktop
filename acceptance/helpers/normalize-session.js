function nestedText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(nestedText).join('\n')
  if (!value || typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  return Object.values(value).map(nestedText).join('\n')
}

function resultMarker(text) {
  for (const marker of ['PARITY_READ_OK', 'PARITY_APPROVAL_OK']) {
    if (text.includes(marker)) return marker
  }
  return undefined
}

/**
 * Project a session history onto the deterministic behavior contract shared by
 * direct-browser and desktop-host runs.
 *
 * @param {Array<{event: {type: string, data: any}}>} entries
 * @param {{workspace: string}} options
 */
export function normalizeParityHistory(entries, { workspace }) {
  const normalized = []
  for (const { event } of entries) {
    switch (event.type) {
      case 'turn/start':
        normalized.push({ type: event.type })
        break
      case 'tool/call':
        normalized.push({
          type: event.type,
          name: event.data.name,
          arguments: String(event.data.arguments).replaceAll(workspace, '<WORKSPACE>'),
        })
        break
      case 'tool/result': {
        const text = nestedText(event.data.message?.content)
        const isError = event.data.message?.content?.some(block => block.isError === true) ?? false
        const marker = resultMarker(text)
        normalized.push({
          type: event.type,
          ...(marker === undefined ? {} : { marker }),
          ...(event.data.error?.code === undefined ? {} : { errorCode: event.data.error.code }),
          isError,
        })
        break
      }
      case 'approval/asked':
        normalized.push({ type: event.type, toolName: event.data.toolName })
        break
      case 'approval/decided':
        normalized.push({ type: event.type, outcome: event.data.outcome })
        break
      case 'assistant/message': {
        const text = event.data.message?.content
          ?.filter(block => block.type === 'text')
          .map(block => block.text)
          .join('')
        if (text === 'PARITY_COMPLETE') normalized.push({ type: event.type, text })
        break
      }
      case 'turn/end':
        normalized.push({ type: event.type, reason: event.data.reason?.kind })
        break
    }
  }
  return normalized
}
