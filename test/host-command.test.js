import assert from 'node:assert/strict'
import test from 'node:test'

import { hostArguments } from '../src/host-command.js'

test('Host arguments place deterministic overlays before web application arguments', () => {
  assert.deepEqual(hostArguments({
    bootstrap: '/app/src/host-bootstrap.js',
    dshBin: '/app/node_modules/@deepseek-ai/dsh/lib/bin.js',
    patchFiles: ['/app/fixtures/parity/cordis.patch.yml'],
  }), [
    '--expose-internals',
    '/app/src/host-bootstrap.js',
    '/app/node_modules/@deepseek-ai/dsh/lib/bin.js',
    'web',
    '--patch',
    '/app/fixtures/parity/cordis.patch.yml',
    '--port',
    '0',
  ])
})
