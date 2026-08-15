/**
 * Collapse ChildProcess spawn errors and exits into one terminal notification.
 *
 * @param {NodeJS.EventEmitter} child
 * @param {(failure: {kind: 'error', code?: string} | {kind: 'exit', code: number | null, signal: NodeJS.Signals | null}) => void} onFailure
 */
export function observeHostFailure(child, onFailure) {
  let reported = false
  const report = failure => {
    if (reported) return
    reported = true
    onFailure(failure)
  }
  child.once('error', error => report({
    kind: 'error',
    ...(typeof error?.code === 'string' ? { code: error.code } : {}),
  }))
  child.once('exit', (code, signal) => report({ kind: 'exit', code, signal }))
}
