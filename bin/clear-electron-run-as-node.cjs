const path = require('node:path')

const originalNodeOptions = process.env.HARNESS_DESKTOP_ORIGINAL_NODE_OPTIONS

delete process.env.ELECTRON_RUN_AS_NODE
delete process.env.HARNESS_DESKTOP_ORIGINAL_NODE_OPTIONS
if (originalNodeOptions) process.env.NODE_OPTIONS = originalNodeOptions
else delete process.env.NODE_OPTIONS

process.execPath = path.join(__dirname, 'node')
