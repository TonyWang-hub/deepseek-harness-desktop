# DeepSeek Harness Desktop

English | [简体中文](README.zh-CN.md)

<p align="center"><img src="build/icon-1024.png" width="128" alt="DeepSeek Harness Desktop monochrome terminal-loop icon"></p>

An unofficial macOS desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It runs the pinned, unmodified official `@deepseek-ai/dsh` Web application inside Electron and keeps the standard `$DSH_HOME`, so the desktop app and `dsh` share profiles, credentials, sessions, tools, and plugins.

> **Distribution status — source available, binaries not yet published.** There is no official DMG, download link, or release checksum for this project today. Public binaries are withheld until they can be signed with a Developer ID Application certificate and notarized by Apple. The local unsigned release candidates are test artifacts; do not redistribute them as official releases.

## Why this build

Community desktop clients already cover broader platforms, custom onboarding, tray workflows, and smaller Tauri or WebView shells. This project deliberately optimizes for a narrower set of properties:

- **No upstream fork or patch layer.** The payload is the exact pinned npm release, currently `@deepseek-ai/dsh@0.1.0-rc.6`. Updating it changes the package version and lockfile instead of rebasing desktop changes onto upstream UI code.
- **One data home.** The shell does not replace `$DSH_HOME`; the CLI and desktop app see the same Harness state without import or migration.
- **No first-run runtime download.** Node.js, `pnpm@11.21.0`, the official production dependency tree, ripgrep, and architecture-specific native modules are inside the application. Model and web-provider calls can still require network access; "offline payload" does not mean offline model inference.
- **Owned process lifetime.** The app waits for Host readiness, restarts an unexpected exit with bounded backoff, uses TERM→KILL on normal shutdown, and gives the Host a parent-lifetime pipe so a crashed desktop process does not leave it running.
- **Artifact-level evidence.** arm64 and x64 builds execute the packaged Host, official plugin command, bundled Node and pnpm launchers, ripgrep, Sharp, Koffi, `node-pty`, and a real PTY before a build is accepted.

This reduces upstream adaptation work; it does not make the shell official or guarantee that every future Harness release will package without changes.

## Architecture

```text
DeepSeek Harness Desktop (Electron main)
├─ Host supervisor and parent-lifetime pipe
│  └─ bundled Node → host bootstrap → @deepseek-ai/dsh web --port 0
├─ app-local bin/node and bin/pnpm for Host tools and child processes
└─ sandboxed BrowserWindow → http://127.0.0.1:<random-port>
                               └─ official Harness Web UI

standard $DSH_HOME ← shared by the desktop app and dsh CLI
```

Electron owns only the native window, process supervision, packaging, and update integration. Harness owns the interface and agent behavior. The Host listens on an operating-system-assigned loopback port; the window blocks other origins, denies new windows, and grants only sanitized clipboard writes to the trusted local origin.

The application uses Electron's bundled Node runtime for the Host and clears Electron-only process markers before Harness or its child commands run. `DSH_DESKTOP_NODE=/absolute/path/to/node` remains an advanced fallback for an upstream native-runtime incompatibility.

## Download and install

### Release availability

There is nothing to download from this project yet. The release page will be linked here only after both macOS architectures have signed, notarized, and verified artifacts plus update metadata. Repositories with similar names publish independent community builds with different code, data paths, update policies, and signing status.

### Choose Apple Silicon or Intel

Open **Apple menu → About This Mac** and check the processor or chip:

| Mac | Architecture | Expected DMG name after release |
| --- | --- | --- |
| Apple M-series chip | `arm64` | `DeepSeek-Harness-Desktop-<version>-mac-arm64.dmg` |
| Intel processor | `x64` | `DeepSeek-Harness-Desktop-<version>-mac-x64.dmg` |

Rosetta is not required when the DMG matches the Mac. Do not install the arm64 build on Intel or use the x64 build as the default on Apple Silicon.

### Install a future signed build

1. Download the matching DMG from this project's release page after an official release is announced.
2. If that release publishes a SHA-256, compare it as described below; always verify the installed application's Apple signature.
3. Open the DMG and drag **DeepSeek Harness Desktop** to **Applications**.
4. Launch it from Applications. A "developer cannot be verified" warning on an advertised official release is a reason to stop and verify the source, not a reason to bypass Gatekeeper.

## Verify a release

### SHA-256

This project currently publishes neither DMGs nor authoritative SHA-256 values. Computing a digest without an expected value from the same release only identifies a file; it does not establish authenticity.

When a release provides a SHA-256 value, calculate the matching download and compare all 64 hexadecimal characters:

```sh
shasum -a 256 ~/Downloads/DeepSeek-Harness-Desktop-<version>-mac-arm64.dmg
shasum -a 256 ~/Downloads/DeepSeek-Harness-Desktop-<version>-mac-x64.dmg
```

Use only the line for the architecture you downloaded. The automatic updater separately uses SHA-512 values stored in `latest-mac.yml`; those values are generated from and checked against every update artifact before the two architecture manifests are merged.

### Apple signature and notarization

After copying the application to `/Applications`, macOS can verify the same three properties required by the formal build:

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/DeepSeek Harness Desktop.app"
spctl --assess --type execute --verbose=4 "/Applications/DeepSeek Harness Desktop.app"
xcrun stapler validate "/Applications/DeepSeek Harness Desktop.app"
```

All commands must exit successfully. Gatekeeper should report an accepted Developer ID application, and `stapler` should report a valid ticket. The build fails if any check fails or notarization is skipped. Only `HARNESS_DESKTOP_ALLOW_UNSIGNED=1` disables these checks for a local test build, and that mode also disables automatic signing-identity discovery to avoid a misleading partial signature.

## Automatic updates

The update client and dual-architecture metadata generation are implemented, but updates are not operational until this project has a public GitHub release feed. A packaged production app performs one non-blocking check after launch. If an update is available, it waits for the download and notifies the user that installation will occur when the app exits; network or feed errors are reported without blocking Harness startup.

A release is not update-ready until its merged `latest-mac.yml`, arm64 and x64 ZIP/DMG files, and blockmaps are published together and a real installed-version-to-new-version upgrade has passed. Source builds and smoke mode do not check for updates.

## Build and validate from source

### Development

Prerequisites: macOS and Node.js `24.17.x` on the current architecture.

```sh
npm ci
npm run smoke
npm start
```

`npm run smoke` starts the real official Host on a random loopback port, loads its Web UI, and waits for clean Host shutdown.

### Local unsigned packages

Unsigned packages are for local acceptance only:

```sh
HARNESS_DESKTOP_ALLOW_UNSIGNED=1 npm run dist:mac:arm64
HARNESS_DESKTOP_ALLOW_UNSIGNED=1 npm run dist:mac:x64
```

Run only the command matching the current Node process and clean dependency installation. The build rejects an architecture mismatch or missing target-specific native package, then automatically runs the packaged acceptance suite. Do not publish, redistribute, or present these artifacts as trusted downloads.

### Packaged acceptance

Each architecture build verifies:

- every installed production package is present as a physical packaged file;
- a clean `$DSH_HOME` can cold-start the official Host and Web UI and releases its loopback port on exit;
- the official plugin command finds bundled pnpm, while child processes see bundled Node rather than Electron GUI mode;
- ripgrep, Sharp, Koffi, `node-pty`, and a real shell PTY execute from the packaged application; and
- the application has the requested Mach-O architecture and leaves no Host process after normal exit or parent death.

See [PLAN.md](PLAN.md) for the current release-candidate evidence and remaining publication prerequisites.

## Community

- Read [Contributing](CONTRIBUTING.md) before opening a pull request.
- Use [Discussions](https://github.com/TonyWang-hub/deepseek-harness-desktop/discussions) for questions and setup help.
- Use the structured issue forms for reproducible bugs and desktop feature requests.
- Follow the [Security](SECURITY.md), [Support](SUPPORT.md), and [Code of Conduct](CODE_OF_CONDUCT.md) policies.

## Community comparison

Snapshot: 2026-08-15. This is a scope comparison, not a ranking; verify the linked repositories because these early projects change quickly.

| Project | Published desktop assets | Payload and data | Updates | Signing and notarization evidence |
| --- | --- | --- | --- | --- |
| This project | None; source and locally validated macOS arm64/x64 candidates only | Pinned, unmodified npm payload; standard `$DSH_HOME`; bundled runtime and production tree | Client and dual-architecture metadata implemented; feed pending | No public binary. Formal builds require `codesign`, Gatekeeper, and a stapled ticket |
| [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | [v0.1.0](https://github.com/anywhere-labs/deepseek-harness-desktop/releases/tag/v0.1.0): macOS arm64 and Windows x64 | Electron desktop app inside a full Harness source tree; stages workspace packages; tray integration | No updater is declared in the current [desktop manifest](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/apps/desktop/package.json) | v0.1.0 does not document artifact trust; current source includes a separate [macOS release preflight](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/apps/desktop/scripts/release-preflight.ts) |
| [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | [v0.1.7](https://github.com/dataelement/dsh-desktop/releases/tag/v0.1.7): macOS arm64/x64 and Windows x64, with update metadata | Pinned rc.6 packages plus documented [`patch-package` overlays](https://github.com/dataelement/dsh-desktop/tree/main/patches) for desktop features; app-specific Harness data directory | [Electron updater](https://github.com/dataelement/dsh-desktop/blob/main/src/main/update/update-manager.ts) checks installed macOS and Windows builds | The [release workflow](https://github.com/dataelement/dsh-desktop/blob/main/.github/workflows/release.yml) verifies macOS with `codesign`, Gatekeeper, and `stapler`; its [manifest](https://github.com/dataelement/dsh-desktop/blob/main/package.json) disables Windows update code-signature verification |
| [steven-kid/deepseek-harness-desktop](https://github.com/steven-kid/deepseek-harness-desktop) | [v0.3.4](https://github.com/steven-kid/deepseek-harness-desktop/releases/tag/v0.3.4): macOS arm64/x64, Windows x64, and Linux x64 | Electron, pinned official rc.6 UI, standard Harness data, tray integration | Its [README](https://github.com/steven-kid/deepseek-harness-desktop#known-limitations) says automatic updates are not integrated | The same README says macOS is not Apple-notarized and Windows is not commercially code-signed |
| [hairyf/deepseek-harness-desktop](https://github.com/hairyf/deepseek-harness-desktop) | [v0.1.9](https://github.com/hairyf/deepseek-harness-desktop/releases/tag/v0.1.9): macOS arm64/x64, Windows x64, and Linux x64 | Tauri control shell; downloads a prebuilt Harness bundle on first launch; app-specific `$DSH_HOME` | Checks and replaces its Harness bundle independently of the desktop app | Its [release workflow](https://github.com/hairyf/deepseek-harness-desktop/blob/main/.github/workflows/release.yml) configures Tauri updater keys but no Apple Developer signing or notarization credentials |
| [xiincs/deepseek-harness-desktop](https://github.com/xiincs/deepseek-harness-desktop) | [v1.0.0](https://github.com/xiincs/deepseek-harness-desktop/releases/tag/v1.0.0): macOS arm64, Windows x64, and Linux x64 | Tauri shell with bundled Node/DSH and standard `~/.dsh` | Signed Tauri updater artifacts are configured for Windows; macOS/Linux are download-only | Its [README](https://github.com/xiincs/deepseek-harness-desktop#deepseek-harness-desktop-tauri) explicitly labels macOS/Linux builds unsigned and unnotarized |

Choose another community client if Windows/Linux support, a tray, customized provider onboarding, preset transfer, or the smallest shell is the priority. Choose this project when exact upstream behavior, shared CLI state, no first-run runtime download, deep packaged-runtime checks, and a fail-closed macOS release policy matter more than those additions.

## Upstream relationship, license, and trademarks

This repository is an independent shell, not a DeepSeek product. Unmodified payload files come from [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) and retain their upstream licenses and notices. The shell source is available under the [MIT License](LICENSE); bundled third-party dependencies remain under their own licenses.

"DeepSeek", "DeepSeek Harness", related logos, and other marks belong to their respective owners. Their use identifies compatibility and upstream provenance only; it does not imply affiliation, sponsorship, certification, or endorsement.
