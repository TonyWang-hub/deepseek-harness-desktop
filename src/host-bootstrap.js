import { createReadStream } from 'node:fs'
import { pathToFileURL } from 'node:url'

const [entry, ...args] = process.argv.slice(2)
if (!entry) throw new Error('The DSH host entry path is required')

const parentFd = process.env.HARNESS_DESKTOP_PARENT_FD
delete process.env.HARNESS_DESKTOP_PARENT_FD
delete process.env.ELECTRON_RUN_AS_NODE

if (parentFd !== undefined) {
  const fd = Number(parentFd)
  if (!Number.isInteger(fd) || fd < 3) throw new Error('The desktop parent lifetime fd is invalid')
  const parentLifetime = createReadStream('', { fd, autoClose: false })
  parentLifetime.once('end', () => {
    setTimeout(() => process.exit(1), 5000).unref()
    process.kill(process.pid, 'SIGTERM')
  })
  parentLifetime.resume()
}

process.argv = [process.execPath, entry, ...args]
await import(pathToFileURL(entry).href)
