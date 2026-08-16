/**
 * Recover the renderer transport after macOS wake without confusing network
 * loss with a Host process crash.
 */
export function createConnectionRecovery({
  state,
  isOnline,
  hasHostTarget,
  getHostTarget,
  isHostTargetCurrent,
  probeHost,
  reloadPage,
  restartHost,
  getReadyTransition = () => ({ name: 'ready' }),
  schedule = setTimeout,
  cancel = clearTimeout,
  retryDelayMs = 5000,
}) {
  let pending
  let retryTimer

  const scheduleNetworkRetry = () => {
    if (retryTimer !== undefined) return
    retryTimer = schedule(() => {
      retryTimer = undefined
      void recover('network-retry')
    }, retryDelayMs)
  }

  const run = async reason => {
    const current = state.get().name
    if (current === 'quitting' || current === 'circuit-open') {
      return { action: 'blocked', state: current }
    }
    if (!isOnline()) {
      state.transition('disconnected', { reason: 'offline' })
      scheduleNetworkRetry()
      return { action: 'wait-for-network' }
    }
    const target = getHostTarget
      ? getHostTarget()
      : hasHostTarget?.() ? true : undefined
    if (target === undefined) return { action: 'host-not-ready' }

    state.transition('recovering', { reason })
    let reachable = false
    try {
      reachable = await probeHost(target)
    } catch {
      reachable = false
    }
    const targetIsCurrent = isHostTargetCurrent
      ? isHostTargetCurrent(target)
      : Boolean(hasHostTarget?.())
    if (!targetIsCurrent) return { action: 'stale-host' }
    if (reachable) {
      if (retryTimer !== undefined) {
        cancel(retryTimer)
        retryTimer = undefined
      }
      await reloadPage(target)
      if (isHostTargetCurrent && !isHostTargetCurrent(target)) return { action: 'stale-host' }
      const readyTransition = getReadyTransition()
      state.transition(readyTransition.name, readyTransition.detail)
      return { action: 'page-reloaded' }
    }
    if (!isOnline()) {
      state.transition('disconnected', { reason: 'offline' })
      scheduleNetworkRetry()
      return { action: 'wait-for-network' }
    }

    await restartHost(target)
    return { action: 'host-restarted' }
  }

  const recover = reason => {
    if (pending) return pending
    pending = run(reason).finally(() => { pending = undefined })
    return pending
  }

  return {
    recover,
    dispose() {
      if (retryTimer !== undefined) cancel(retryTimer)
      retryTimer = undefined
    },
  }
}

/**
 * Connect macOS wake signals to one coalesced recovery decision.
 */
export function installMacConnectionRecovery({
  platform,
  powerMonitor,
  recover,
  reportError = error => console.error('Desktop connection recovery failed:', error),
}) {
  if (platform !== 'darwin') return () => {}
  const onResume = () => { void Promise.resolve(recover('resume')).catch(reportError) }
  const onUnlock = () => { void Promise.resolve(recover('unlock-screen')).catch(reportError) }
  powerMonitor.on('resume', onResume)
  powerMonitor.on('unlock-screen', onUnlock)
  return () => {
    powerMonitor.removeListener('resume', onResume)
    powerMonitor.removeListener('unlock-screen', onUnlock)
  }
}
