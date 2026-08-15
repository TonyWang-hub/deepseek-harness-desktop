/**
 * Terminate a child process and resolve only after it exits, escalating when it ignores SIGTERM.
 *
 * @param {import('node:child_process').ChildProcess} child
 * @param {{graceMs: number}} options
 * @returns {Promise<void>}
 */
export function terminateChild(child, { graceMs }) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
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
