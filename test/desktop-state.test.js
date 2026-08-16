import assert from 'node:assert/strict'
import test from 'node:test'

import { createDesktopState } from '../src/desktop-state.js'

test('desktop reliability state follows the allowed lifecycle and notifies subscribers', () => {
  let now = 100
  const state = createDesktopState({ now: () => now })
  const observed = []
  const unsubscribe = state.subscribe(snapshot => observed.push(snapshot))

  assert.deepEqual(state.get(), { name: 'starting', since: 100 })
  now = 110
  assert.deepEqual(state.transition('ready'), { name: 'ready', since: 110 })
  now = 120
  assert.deepEqual(state.transition('disconnected', { reason: 'offline' }), {
    name: 'disconnected',
    since: 120,
    detail: { reason: 'offline' },
  })
  now = 130
  state.transition('recovering', { reason: 'resume' })
  now = 140
  state.transition('ready')
  now = 150
  state.transition('updating', { version: '0.4.0' })
  now = 160
  state.transition('ready')
  now = 170
  state.transition('quitting')
  unsubscribe()

  assert.deepEqual(observed.map(snapshot => snapshot.name), [
    'ready',
    'disconnected',
    'recovering',
    'ready',
    'updating',
    'ready',
    'quitting',
  ])
})

test('desktop reliability state rejects contradictory or post-quit transitions', () => {
  const state = createDesktopState()
  assert.throws(() => state.transition('disconnected'), /Invalid desktop state transition/)
  state.transition('ready')
  assert.throws(() => state.transition('starting'), /Invalid desktop state transition/)
  state.transition('quitting')
  assert.throws(() => state.transition('ready'), /Invalid desktop state transition/)

  const circuit = createDesktopState()
  circuit.transition('ready')
  assert.equal(circuit.transition('circuit-open').name, 'circuit-open')
})

test('repeating the current state is idempotent', () => {
  const state = createDesktopState()
  let changes = 0
  state.subscribe(() => { changes += 1 })
  const initial = state.get()
  assert.equal(state.transition('starting'), initial)
  assert.equal(changes, 0)
})
