import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

/**
 * Reject a macOS release whose signature, Gatekeeper assessment, or notarization ticket is missing.
 *
 * @param {{appPath: string, execFile: (command: string, args: string[]) => Promise<unknown>}} options
 * @returns {Promise<void>}
 */
export async function verifyMacReleaseApp({ appPath, execFile: run }) {
  await run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
  await run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath])
  await run('xcrun', ['stapler', 'validate', appPath])
}

/**
 * electron-builder hook that turns skipped or invalid macOS notarization into a build failure.
 *
 * @param {import('electron-builder').AfterPackContext} context
 * @returns {Promise<void>}
 */
export default async function afterSign(context) {
  if (process.env.HARNESS_DESKTOP_ALLOW_UNSIGNED === '1') return
  if (context.electronPlatformName !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  await verifyMacReleaseApp({ appPath: path.join(context.appOutDir, appName), execFile })
}
