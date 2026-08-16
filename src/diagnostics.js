import { constants } from 'node:fs'
import { access as fsAccess, chmod, writeFile } from 'node:fs/promises'

const TOOL_NAME = /^[a-z0-9][a-z0-9-]*$/
const TOOL_STATUSES = new Set(['ok', 'missing', 'not-readable', 'not-executable', 'unavailable'])

function safeTool(tool) {
  if (!TOOL_NAME.test(tool.name)) throw new Error(`Invalid diagnostic tool name: ${tool.name}`)
  return {
    name: tool.name,
    status: TOOL_STATUSES.has(tool.status) ? tool.status : 'unavailable',
  }
}

/**
 * Build an allowlisted report. Unknown input fields are intentionally ignored:
 * no raw logs, environment, paths, Host URLs, or Web contents enter the file.
 */
export function buildDiagnosticReport({
  now = () => new Date(),
  application,
  system,
  desktop,
  tools,
}) {
  return {
    schemaVersion: 1,
    createdAt: now().toISOString(),
    application: {
      version: application.version,
      packaged: Boolean(application.packaged),
      officialPayloadVersion: application.payloadVersion,
    },
    system: {
      platform: system.platform,
      release: system.release,
      arch: system.arch,
      electron: system.electron,
      node: system.node,
    },
    desktop: {
      state: desktop.state.name,
      stateSince: desktop.state.since,
      hostRunning: Boolean(desktop.hostRunning),
      ...(Number.isInteger(desktop.hostPid) ? { hostPid: desktop.hostPid } : {}),
      ...(Number.isInteger(desktop.hostPort) ? { hostPort: desktop.hostPort } : {}),
      dshHomeConfigured: Boolean(desktop.dshHomeConfigured),
      updateReady: Boolean(desktop.updateReady),
    },
    runtimeTools: tools.map(safeTool),
  }
}

/**
 * Check only executability and return no inspected path or raw filesystem error.
 */
export async function checkRuntimeTools(tools, { access } = {}) {
  const checkAccess = access ?? fsAccess
  return Promise.all(tools.map(async tool => {
    if (!TOOL_NAME.test(tool.name)) throw new Error(`Invalid diagnostic tool name: ${tool.name}`)
    try {
      const mode = tool.mode === 'readable' ? constants.R_OK : constants.X_OK
      await checkAccess(tool.path, mode)
      return { name: tool.name, status: 'ok' }
    } catch (error) {
      const status = error?.code === 'ENOENT'
        ? 'missing'
        : error?.code === 'EACCES'
          ? tool.mode === 'readable' ? 'not-readable' : 'not-executable'
          : 'unavailable'
      return { name: tool.name, status }
    }
  }))
}

/** Write a deterministic, owner-readable diagnostic JSON file. */
export async function saveDiagnosticReport(filePath, report, {
  writeFile: write = writeFile,
  chmod: setMode = chmod,
} = {}) {
  const content = `${JSON.stringify(report, null, 2)}\n`
  await write(filePath, content, { encoding: 'utf8', mode: 0o600 })
  await setMode(filePath, 0o600)
}
