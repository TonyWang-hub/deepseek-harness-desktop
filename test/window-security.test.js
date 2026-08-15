import assert from 'node:assert/strict'
import test from 'node:test'

import { installWindowSecurity } from '../src/window-security.js'

function createWindow() {
  const listeners = new Map()
  let openHandler
  let requestHandler
  let checkHandler
  return {
    listeners,
    get openHandler() { return openHandler },
    get requestHandler() { return requestHandler },
    get checkHandler() { return checkHandler },
    webContents: {
      on: (name, listener) => listeners.set(name, listener),
      setWindowOpenHandler: handler => { openHandler = handler },
      session: {
        setPermissionRequestHandler: handler => { requestHandler = handler },
        setPermissionCheckHandler: handler => { checkHandler = handler },
      },
    },
  }
}

test('window security keeps app navigation local and opens safe external links in the browser', () => {
  const window = createWindow()
  const opened = []
  installWindowSecurity({
    window,
    getHostUrl: () => 'http://127.0.0.1:54321',
    openExternal: async url => { opened.push(url) },
  })

  const localEvent = { preventDefault: () => assert.fail('local navigation was blocked') }
  window.listeners.get('will-navigate')(localEvent, 'http://127.0.0.1:54321/settings')

  let prevented = false
  window.listeners.get('will-navigate')({ preventDefault: () => { prevented = true } }, 'https://example.com/docs')
  assert.equal(prevented, true)
  assert.deepEqual(opened, ['https://example.com/docs'])
  assert.deepEqual(window.openHandler({ url: 'https://example.com/new' }), { action: 'deny' })
  assert.deepEqual(opened, ['https://example.com/docs', 'https://example.com/new'])
})

test('window security denies untrusted and unnecessary web permissions', () => {
  const window = createWindow()
  installWindowSecurity({
    window,
    getHostUrl: () => 'http://127.0.0.1:54321',
    openExternal: async () => {},
  })

  let granted
  window.requestHandler(undefined, 'clipboard-sanitized-write', value => { granted = value }, {
    requestingUrl: 'http://127.0.0.1:54321/session',
  })
  assert.equal(granted, true)
  window.requestHandler(undefined, 'media', value => { granted = value }, {
    requestingUrl: 'http://127.0.0.1:54321/session',
  })
  assert.equal(granted, false)
  assert.equal(window.checkHandler(undefined, 'clipboard-sanitized-write', 'https://evil.example'), false)
})
