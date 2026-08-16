import assert from 'node:assert/strict'
import test from 'node:test'

import { createHostReadinessParser } from '../src/host-readiness.js'

const READY_LINE = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/

test('Host readiness survives split output chunks and reports once', () => {
  const output = []
  const ready = []
  const parser = createHostReadinessParser({
    pattern: READY_LINE,
    writeOutput: text => output.push(text),
    onReady: url => ready.push(url),
  })

  parser.push(Buffer.from('booting\ndsh we'))
  parser.push(Buffer.from('b: http://127.0.0.1:52144\n'))
  parser.push(Buffer.from('dsh web: http://127.0.0.1:59999\n'))

  assert.equal(output.join(''), 'booting\ndsh web: http://127.0.0.1:52144\ndsh web: http://127.0.0.1:59999\n')
  assert.deepEqual(ready, ['http://127.0.0.1:52144'])
})

test('Host readiness parser bounds unmatched buffered output', () => {
  const parser = createHostReadinessParser({
    pattern: READY_LINE,
    writeOutput: () => {},
    onReady: () => {},
    maxBufferLength: 64,
  })
  parser.push('x'.repeat(10_000))
  assert.equal(parser.bufferedLength(), 64)
})
