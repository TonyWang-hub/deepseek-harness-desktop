# DeepSeek Harness Desktop

An unofficial macOS desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It runs the pinned, unmodified official Web application inside Electron and keeps the standard `$DSH_HOME`, so profiles, credentials, sessions, tools, and plugins remain shared with `dsh`.

> The source is public, but signed downloads are not available yet. Binary releases are withheld until they can be signed with Developer ID and notarized by Apple. Do not redistribute the local unsigned test artifacts as official releases.

## What it provides

- The official `@deepseek-ai/dsh` Web UI and Host without a UI fork.
- A bundled runtime: users do not need to install Node.js or pnpm.
- Host readiness detection, crash restart, graceful shutdown, and orphan-process prevention.
- A sandboxed Electron renderer with loopback-only navigation and restricted permissions.
- Architecture-isolated arm64 and x64 packaging with native-module and packaged-app acceptance tests.
- Verified dual-architecture update metadata for a future signed GitHub Release.

The current payload is pinned to `@deepseek-ai/dsh@0.1.0-rc.6`. Upgrading the payload changes its exact dependency version; this project does not patch upstream files.

## Development

Prerequisites: macOS and Node.js `24.17.x`.

```sh
npm ci
npm run smoke
npm start
```

`npm run smoke` starts the real Host on an operating-system-assigned loopback port, loads the official UI, then verifies clean shutdown.

Run the source tests with:

```sh
npm test
```

## Local unsigned packages

An unsigned build is only for local acceptance. Build from a clean install whose Node process matches the target architecture:

```sh
HARNESS_DESKTOP_ALLOW_UNSIGNED=1 npm run dist:mac:arm64
```

For Intel, use an x64 Node installation and replace `arm64` with `x64`. Each build automatically runs the packaged acceptance suite. Formal builds fail unless macOS signature, Gatekeeper, and stapled notarization-ticket verification all succeed.

## Distribution status

Direct-download macOS releases require a Developer ID Application signature and Apple notarization. The repository intentionally has no unsigned GitHub Release. Once signing credentials are available, a release must upload `latest-mac.yml`, both architectures' ZIP and DMG files, and their blockmaps before automatic updates are enabled for users.

See [PLAN.md](PLAN.md) for the implemented architecture and recorded acceptance evidence.

## License

[MIT](LICENSE). This project is not affiliated with or endorsed by DeepSeek.
