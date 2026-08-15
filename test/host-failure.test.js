import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { observeHostFailure } from '../src/host-failure.js'

test('spawn error and later exit report exactly one Host failure', () => {
  const child = new EventEmitter()
  const failures = []
  observeHostFailure(child, failure => failures.push(failure))

  const error = Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
  child.emit('error', error)
  child.emit('exit', -2, null)

  assert.deepEqual(failures, [{ kind: 'error', code: 'ENOENT' }])
})

test('ordinary exit reports its code and signal once', () => {
  const child = new EventEmitter()
  const failures = []
  observeHostFailure(child, failure => failures.push(failure))

  child.emit('exit', null, 'SIGKILL')
  child.emit('error', new Error('late error'))

  assert.deepEqual(failures, [{ kind: 'exit', code: null, signal: 'SIGKILL' }])
})
