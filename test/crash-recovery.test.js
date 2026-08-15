import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  createCrashPage,
  createCrashRecovery,
  installCrashActions,
} from '../src/crash-recovery.js'

test('three host exits inside the crash window stop automatic restart', () => {
  const recovery = createCrashRecovery({
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    crashWindowMs: 60_000,
    crashLimit: 3,
  })

  assert.deepEqual(recovery.recordExit(1_000), { action: 'restart', delayMs: 500, crashCount: 1 })
  assert.deepEqual(recovery.recordExit(2_000), { action: 'restart', delayMs: 1_000, crashCount: 2 })
  assert.deepEqual(recovery.recordExit(3_000), { action: 'stop', crashCount: 3 })
})

test('manual retry resets the crash circuit and backoff', () => {
  const recovery = createCrashRecovery({
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    crashWindowMs: 60_000,
    crashLimit: 3,
  })

  recovery.recordExit(1_000)
  recovery.recordExit(2_000)
  recovery.recordExit(3_000)
  recovery.reset()

  assert.deepEqual(recovery.recordExit(4_000), { action: 'restart', delayMs: 500, crashCount: 1 })
})

test('an open crash circuit renders sanitized retry and quit actions', () => {
  const page = createCrashPage({
    detail: 'Host failed <script>unsafe()</script>',
    retryDelayMs: undefined,
  })
  const html = decodeURIComponent(page.slice('data:text/html,'.length))

  assert.match(html, /Host failed &lt;script&gt;unsafe\(\)&lt;\/script&gt;/)
  assert.match(html, /href="dsh-desktop:\/\/retry"/)
  assert.match(html, /href="dsh-desktop:\/\/quit"/)
  assert.doesNotMatch(html, /<script>unsafe/)
})

test('local crash actions invoke retry or quit without navigating', () => {
  const webContents = new EventEmitter()
  const calls = []
  installCrashActions({
    webContents,
    retry: () => calls.push('retry'),
    quit: () => calls.push('quit'),
  })
  let prevented = 0
  const event = { preventDefault: () => { prevented += 1 } }

  webContents.emit('will-navigate', event, 'dsh-desktop://retry')
  webContents.emit('will-navigate', event, 'dsh-desktop://quit')
  webContents.emit('will-navigate', event, 'https://example.com')

  assert.deepEqual(calls, ['retry', 'quit'])
  assert.equal(prevented, 2)
})
