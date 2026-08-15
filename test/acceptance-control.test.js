import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, stat } from 'node:fs/promises'
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { installAcceptanceControl } from '../src/acceptance-control.js'

async function listen(server, socketPath) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, resolve)
  })
}

async function close(server) {
  await new Promise(resolve => server.close(resolve))
}

test('acceptance control requires a private Unix socket directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-control-public-'))
  try {
    await chmod(root, 0o755)
    assert.throws(() => installAcceptanceControl({
      socketPath: path.join(root, 'control.sock'),
      handlers: {},
      platform: 'darwin',
    }), /private directory/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('acceptance control creates a private socket and never unlinks another listener', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dsh-control-private-'))
  const socketPath = path.join(root, 'control.sock')
  const first = createServer(socket => socket.end('first'))
  await listen(first, socketPath)
  const second = installAcceptanceControl({ socketPath, handlers: {}, platform: 'darwin' })
  try {
    await assert.rejects(second.ready, error => error.code === 'EADDRINUSE')
    second.close()
    const response = await new Promise((resolve, reject) => {
      const socket = createConnection(socketPath)
      socket.setEncoding('utf8')
      socket.once('error', reject)
      socket.once('data', data => {
        socket.destroy()
        resolve(data)
      })
    })
    assert.equal(response, 'first')
  } finally {
    await close(first)
    await rm(root, { recursive: true, force: true })
  }

  const privateRoot = await mkdtemp(path.join(tmpdir(), 'dsh-control-mode-'))
  const privateSocket = path.join(privateRoot, 'control.sock')
  const control = installAcceptanceControl({ socketPath: privateSocket, handlers: {}, platform: 'darwin' })
  try {
    await control.ready
    assert.equal((await stat(privateSocket)).mode & 0o777, 0o600)
  } finally {
    control.close()
    await rm(privateRoot, { recursive: true, force: true })
  }
})
