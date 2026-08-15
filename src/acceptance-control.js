import { chmodSync, rmSync, statSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'

/**
 * Install an opt-in lifecycle control used by real Electron acceptance. The
 * Unix socket must live inside a pre-existing private directory and is absent
 * unless the caller supplies its path.
 *
 * @param {{socketPath?: string, handlers: Record<string, () => any | Promise<any>>, platform?: NodeJS.Platform}} options
 */
export function installAcceptanceControl({ socketPath, handlers, platform = process.platform }) {
  if (!socketPath) return undefined
  if (platform !== 'win32') {
    const directoryMode = statSync(path.dirname(socketPath)).mode & 0o777
    if ((directoryMode & 0o077) !== 0) {
      throw new Error('Acceptance control socket requires a private directory')
    }
  }

  let ownsPath = false
  let closed = false
  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  const server = createServer(socket => {
    socket.setEncoding('utf8')
    let input = ''
    socket.on('data', chunk => {
      input += chunk
      const newline = input.indexOf('\n')
      if (newline === -1) return
      socket.pause()
      void (async () => {
        try {
          const request = JSON.parse(input.slice(0, newline))
          const handler = handlers[request.command]
          if (!handler) throw new Error(`Unknown acceptance command: ${request.command}`)
          socket.end(`${JSON.stringify({ ok: true, value: await handler() })}\n`)
        } catch (error) {
          socket.end(`${JSON.stringify({ ok: false, error: error.message })}\n`)
        }
      })()
    })
  })
  server.once('error', rejectReady)
  server.listen(socketPath, () => {
    ownsPath = true
    if (platform !== 'win32') chmodSync(socketPath, 0o600)
    resolveReady()
  })

  return {
    ready,
    close() {
      if (closed) return
      closed = true
      if (server.listening) server.close()
      if (ownsPath && platform !== 'win32') rmSync(socketPath, { force: true })
    },
  }
}
