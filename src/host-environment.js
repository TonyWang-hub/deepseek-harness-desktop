import path from 'node:path'

/**
 * Build the environment inherited by the official DSH host.
 *
 * @param {{appPath: string, electronPath: string, baseEnv: NodeJS.ProcessEnv, nodeOverride?: string}} options
 * @returns {NodeJS.ProcessEnv}
 */
export function createHostEnvironment({ appPath, electronPath, baseEnv, nodeOverride }) {
  const env = {
    ...baseEnv,
    PATH: [path.join(appPath, 'bin'), baseEnv.PATH].filter(Boolean).join(path.delimiter),
    HARNESS_DESKTOP_ELECTRON: electronPath,
  }
  delete env.DSH_DESKTOP_ACCEPTANCE_SOCKET
  if (nodeOverride) delete env.ELECTRON_RUN_AS_NODE
  else env.ELECTRON_RUN_AS_NODE = '1'
  return env
}
