import path from 'node:path'

import { LlmAdapter } from '@deepseek-ai/dsh-llm'

const PROVIDER = 'parity'
const MODEL = 'parity-model'

function toolChunks(index, name, argumentsValue) {
  const id = `parity-call-${index + 1}`
  const argumentsText = JSON.stringify(argumentsValue)
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsText },
    {
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id, name, arguments: argumentsText },
    },
    { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}

function textChunks(text) {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

export class ParityAdapter extends LlmAdapter {
  constructor({ workspace }) {
    super()
    this.workspace = workspace
    this.cursor = 0
  }

  providerInfo(provider) {
    return { id: provider, name: 'Desktop parity fixture' }
  }

  listModels(provider) {
    return Promise.resolve([{ provider, id: MODEL, name: 'Desktop parity fixture' }])
  }

  resolveModel(provider, model) {
    return Promise.resolve({
      provider,
      id: model,
      name: 'Desktop parity fixture',
      inputModalities: ['text'],
      context: { contextWindow: 16_384 },
      defaultMaxTokens: 1_024,
    })
  }

  async *stream(options) {
    if (options.purpose === 'compaction') {
      yield* textChunks('PARITY_COMPACTION')
      return
    }
    const step = this.cursor++
    const chunks = step === 0
      ? toolChunks(step, 'read', { file_path: path.join(this.workspace, 'probe.txt') })
      : step === 1
        ? toolChunks(step, 'bash', {
            command: 'printf PARITY_APPROVAL_OK',
            description: 'Print deterministic parity approval marker',
            sandbox_permissions: 'danger-full-access',
            justification: 'The parity fixture verifies the real approval flow with a harmless command.',
          })
        : step === 2
          ? toolChunks(step, 'read', { file_path: path.join(this.workspace, 'missing.txt') })
          : textChunks('PARITY_COMPLETE')
    yield* chunks
  }
}

export const name = 'parity-probe'
export const inject = ['llm', 'webServer']

export function apply(ctx, config = {}) {
  const workspace = config.workspace ?? process.env.PARITY_WORKSPACE
  if (!workspace) throw new Error('parity-probe: workspace is required')
  ctx.llm.registerAdapter([PROVIDER], new ParityAdapter({ workspace }))
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/parity-probe',
    handler: (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ plugin: 'parity-probe', model: MODEL }))
    },
  }), 'parity-probe: marker route')
}
