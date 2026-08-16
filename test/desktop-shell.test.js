import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  desktopIconPath,
  installDesktopMenus,
  installWindowResidency,
  showDesktopWindow,
} from '../src/desktop-shell.js'

class FakeWindow extends EventEmitter {
  hidden = false

  hide() {
    this.hidden = true
  }
}

test('the tray icon uses the packaged macOS resource or source PNG', () => {
  assert.equal(desktopIconPath({
    appPath: '/repo',
    resourcesPath: '/App/Contents/Resources',
    isPackaged: true,
    platform: 'darwin',
  }), '/App/Contents/Resources/icon.icns')
  assert.equal(desktopIconPath({
    appPath: '/repo',
    resourcesPath: '/repo/node_modules/electron/dist/Electron.app/Contents/Resources',
    isPackaged: false,
    platform: 'darwin',
  }), '/repo/build/icon-1024.png')
})

test('closing the window hides it while the application remains resident', () => {
  const window = new FakeWindow()
  let prevented = false
  installWindowResidency({ window, isQuitting: () => false })

  window.emit('close', { preventDefault: () => { prevented = true } })

  assert.equal(prevented, true)
  assert.equal(window.hidden, true)
})

test('closing the window is allowed while the application quits', () => {
  const window = new FakeWindow()
  let prevented = false
  installWindowResidency({ window, isQuitting: () => true })

  window.emit('close', { preventDefault: () => { prevented = true } })

  assert.equal(prevented, false)
  assert.equal(window.hidden, false)
})

test('desktop menus expose open, private diagnostics, and explicit quit actions', () => {
  const builtTemplates = []
  const Menu = {
    buildFromTemplate(template) {
      builtTemplates.push(template)
      return { template }
    },
  }
  class FakeTray extends EventEmitter {
    setToolTip(value) { this.toolTip = value }
    setContextMenu(value) { this.contextMenu = value }
  }
  const image = {
    resize: () => image,
    setTemplateImage(value) { this.template = value },
  }
  const app = { dock: { setMenu(menu) { this.menu = menu } } }
  let opened = 0
  let diagnostics = 0
  let quit = 0

  const tray = installDesktopMenus({
    app,
    Menu,
    Tray: FakeTray,
    nativeImage: { createFromPath: () => image },
    platform: 'darwin',
    iconPath: '/app/icon.png',
    showWindow: () => { opened += 1 },
    exportDiagnostics: () => { diagnostics += 1 },
    quit: () => { quit += 1 },
  })

  assert.equal(builtTemplates.length, 2)
  const labels = ['Open', 'separator', 'Export Diagnostics…', 'separator', 'Quit']
  assert.deepEqual(builtTemplates[0].map(item => item.label ?? item.type), labels)
  assert.deepEqual(builtTemplates[1].map(item => item.label ?? item.type), labels)
  builtTemplates[0][0].click()
  builtTemplates[0][2].click()
  builtTemplates[0][4].click()
  tray.emit('click')
  assert.equal(opened, 2)
  assert.equal(diagnostics, 1)
  assert.equal(quit, 1)
  assert.equal(image.template, true)
})

test('showing the desktop restores and focuses the single existing window', () => {
  const calls = []
  const window = {
    isMinimized: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus-window'),
  }

  showDesktopWindow({
    getWindow: () => window,
    createWindow: () => { throw new Error('must reuse the existing window') },
    platform: 'darwin',
    focusApp: () => calls.push('focus-app'),
  })

  assert.deepEqual(calls, ['restore', 'show', 'focus-app', 'focus-window'])
})
