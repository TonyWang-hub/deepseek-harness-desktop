import { execFile } from 'node:child_process'

export function windowsTaskkillArguments(pid, { force }) {
  return ['/PID', String(pid), '/T', ...(force ? ['/F'] : [])]
}

function killWindowsTree(pid, { force }) {
  return new Promise((resolve, reject) => {
    execFile('taskkill.exe', windowsTaskkillArguments(pid, { force }), error => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function waitForExit(child) {
  return new Promise(resolve => child.once('exit', resolve))
}

async function terminateWindowsChild(child, { graceMs, killTree }) {
  const exited = waitForExit(child)
  const graceful = Promise.resolve().then(() => killTree(child.pid, { force: false }))
  let completedGracefully = false
  try {
    completedGracefully = await Promise.race([
      Promise.all([exited, graceful]).then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), graceMs)),
    ])
  } catch {
    // A failed graceful taskkill is the escalation trigger, not final failure.
  }
  if (completedGracefully) return

  const forced = Promise.resolve().then(() => killTree(child.pid, { force: true }))
  await Promise.all([exited, forced])
  // Do not report shutdown complete while the first taskkill command is alive.
  await graceful.catch(() => {})
}

function terminatePosixChild(child, { graceMs }) {
  return new Promise((resolve, reject) => {
    let settled = false
    let killer
    const finish = () => {
      if (settled) return
      settled = true
      if (killer) clearTimeout(killer)
      resolve()
    }
    child.once('exit', finish)
    try {
      child.kill('SIGTERM')
      if (!settled) {
        killer = setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch (error) {
            if (error.code === 'ESRCH') finish()
            else reject(error)
          }
        }, graceMs)
      }
    } catch (error) {
      if (error.code === 'ESRCH') finish()
      else reject(error)
    }
  })
}

/**
 * Terminate a child process and resolve only after it exits, escalating when it
 * ignores the graceful request. Windows targets the complete descendant tree.
 *
 * @param {import('node:child_process').ChildProcess} child
 * @param {{graceMs: number, platform?: NodeJS.Platform, killTree?: (pid: number, options: {force: boolean}) => Promise<void>}} options
 * @returns {Promise<void>}
 */
export function terminateChild(
  child,
  { graceMs, platform = process.platform, killTree = killWindowsTree },
) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  if (platform === 'win32') return terminateWindowsChild(child, { graceMs, killTree })
  return terminatePosixChild(child, { graceMs })
}
