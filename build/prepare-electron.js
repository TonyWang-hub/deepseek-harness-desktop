import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const executable = await stat(electronPath)

if (!executable.isFile()) throw new Error(`Electron executable is not a file: ${electronPath}`)
