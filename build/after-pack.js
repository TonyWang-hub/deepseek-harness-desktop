import { cp, lstat, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

async function statOrUndefined(filename) {
  try {
    return await lstat(filename)
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Restore production package directories that electron-builder omits from peer-only branches.
 *
 * @param {{projectDir: string, appRoot: string}} options
 * @returns {Promise<void>}
 */
export async function copyRuntimeClosure({ projectDir, appRoot }) {
  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8'))
  const packages = Object.entries(lock.packages ?? {}).sort(([left], [right]) => left.localeCompare(right))

  for (const [relativePath, metadata] of packages) {
    if (!relativePath.startsWith('node_modules/') || metadata.dev === true) continue
    const source = path.resolve(projectDir, relativePath)
    const destination = path.resolve(appRoot, relativePath)
    if (!isWithin(projectDir, source) || !isWithin(appRoot, destination)) {
      throw new Error(`unsafe runtime package path: ${relativePath}`)
    }

    const sourceStat = await statOrUndefined(source)
    if (!sourceStat) {
      if (metadata.optional === true) continue
      throw new Error(`required runtime package is not installed: ${relativePath}`)
    }
    if (!sourceStat.isDirectory()) throw new Error(`runtime package is not a directory: ${relativePath}`)
    if (await statOrUndefined(destination)) continue

    await mkdir(path.dirname(destination), { recursive: true })
    await cp(source, destination, { recursive: true, preserveTimestamps: true })
  }
}

/**
 * electron-builder hook that completes the packaged npm production tree.
 *
 * @param {import('electron-builder').AfterPackContext} context
 * @returns {Promise<void>}
 */
export default async function afterPack(context) {
  const appRoot = path.join(context.packager.getResourcesDir(context.appOutDir), 'app')
  await copyRuntimeClosure({ projectDir: context.packager.projectDir, appRoot })
}
