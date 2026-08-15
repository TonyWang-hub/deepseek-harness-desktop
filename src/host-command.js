/**
 * Build the official Host argv while keeping desktop-owned overlays separate
 * from arguments parsed by the Web application.
 *
 * @param {{bootstrap: string, dshBin: string, patchFiles?: string[]}} options
 */
export function hostArguments({ bootstrap, dshBin, patchFiles = [] }) {
  return [
    '--expose-internals',
    bootstrap,
    dshBin,
    'web',
    ...patchFiles.flatMap(filename => ['--patch', filename]),
    '--port',
    '0',
  ]
}
