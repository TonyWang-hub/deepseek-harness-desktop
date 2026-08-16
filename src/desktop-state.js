const ALLOWED_TRANSITIONS = Object.freeze({
  starting: new Set(['ready', 'recovering', 'circuit-open', 'updating', 'quitting']),
  ready: new Set(['disconnected', 'recovering', 'circuit-open', 'updating', 'quitting']),
  disconnected: new Set(['ready', 'recovering', 'circuit-open', 'quitting']),
  recovering: new Set(['ready', 'disconnected', 'circuit-open', 'updating', 'quitting']),
  'circuit-open': new Set(['recovering', 'quitting']),
  updating: new Set(['ready', 'disconnected', 'recovering', 'circuit-open', 'quitting']),
  quitting: new Set(),
})

function snapshot(name, since, detail) {
  return Object.freeze({
    name,
    since,
    ...(detail === undefined ? {} : { detail: Object.freeze({ ...detail }) }),
  })
}

/**
 * Own the single desktop lifecycle state consumed by Host recovery, windows,
 * menus, diagnostics, and updates.
 *
 * @param {{initial?: keyof typeof ALLOWED_TRANSITIONS, now?: () => number}} options
 */
export function createDesktopState({ initial = 'starting', now = Date.now } = {}) {
  if (!Object.hasOwn(ALLOWED_TRANSITIONS, initial)) {
    throw new Error(`Unknown desktop state: ${initial}`)
  }
  let current = snapshot(initial, now())
  const listeners = new Set()

  return {
    get() {
      return current
    },
    transition(next, detail) {
      if (next === current.name) return current
      if (!ALLOWED_TRANSITIONS[current.name].has(next)) {
        throw new Error(`Invalid desktop state transition: ${current.name} -> ${next}`)
      }
      current = snapshot(next, now(), detail)
      for (const listener of listeners) listener(current)
      return current
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
