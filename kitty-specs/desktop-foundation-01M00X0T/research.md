# Research: Desktop Foundation and Shell Decision

## Evidence base

This research uses the sibling upstream checkout only as a read-only compatibility oracle and verifies release-facing facts against published package metadata. The decisive upstream facts are:

- `packages/client/web/src/boot.tsx` constructs the official renderer from `window.__DSH_BOOT__`, loads every plugin row, and fails loudly when an entry is missing or inactive.
- `packages/client/modules/src/index.ts` generates that boot graph from the live Host plugin tree, serves `/plugins/*`, and injects the graph into the official index.
- `packages/client/connection/src/index.ts` now separates its transport-neutral Host connection registry from the optional browser carrier. The ordinary Web composition still registers HTTP and downlink WebSocket routes when a `webServer` service exists.
- `packages/client/connection/src/client/web-api-client.ts` uses Fetch for unary requests and one downlink WebSocket for each of the mux and Host event streams. The always-mounted client HMR row also opens `EventSource('/plugins/events')`. Preserving Fetch, WebSocket, and EventSource avoids a second product protocol and keeps the official graph intact.
- `packages/host/webserver/src/index.ts` is a route registry plus Node HTTP listener and explicitly documents a future Electron IPC carrier. Other packages depend on the `webServer` service methods, not on TCP as a product capability.
- `packages/bundle/web-app/cordis.patch.yml` is the complete official Host and browser roster. An additional profile bundle can override its `webserver` row by id and change `web-runtime` presentation settings without copying the roster.
- `apps/cli/src/profile-boot.ts` is the shared profile composition/boot path, and the published `dsh` binary accepts repeatable `--patch` overlays. Absolute plugin entry paths are supported by app boot. The desktop launcher can therefore invoke the official binary with an ephemeral, non-secret overlay instead of importing an internal launcher module.
- Published metadata on 2026-08-15 exposes `@deepseek-ai/dsh@0.1.0-rc.6`, `electron@43.4.0`, `@tauri-apps/cli@2.11.4`, and `@tauri-apps/api@2.11.1`. The payload lock, not a floating range, remains authoritative.
- The sibling checkout is commit `9b2814735259885939dee955cbc7b88e6ce9e19f` while its package manifests still report `0.1.0-rc.5`; it is useful only as a read-only architecture oracle. No payload may be assembled from that dirty working tree or identified by semver alone.

## Decision 1 — Consume one exact upstream family

**Decision**: Releases stage an exact `@deepseek-ai/dsh` version, audit every installed `@deepseek-ai/dsh-*` package for the approved family, and record package version, registry integrity, complete dependency-closure digest, renderer digest, Node distribution digest, and adapter version in a payload manifest. Local development may point the compatibility verifier at a clean archive of a named upstream commit but may not assemble from the sibling worktree, make it a workspace member, or write into it.

**Rationale**: The upstream CLI brings the complete base and Web bundle dependency closure. Exact staging preserves official behavior and dynamic plugins while keeping routine upgrades to a version-lock change and compatibility run. Auditing the resolved tree closes the gap left by upstream caret ranges.

**Alternatives considered**:

- **Vendor or patch upstream source**: rejected because it turns every upstream upgrade into a merge and repeats the weakness of community wrappers that pin and patch one release.
- **Track upstream main automatically**: rejected because a desktop release must be reproducible and an unknown combination must fail before user work.
- **Depend only on selected low-level packages**: rejected because the desktop project would then own the official composition roster and drift whenever upstream adds a capability.

## Decision 2 — Reuse a supported Web profile through an ephemeral overlay

**Decision**: The launcher boots the user's selected, compatibility-checked Web-capable profile through the official `dsh` binary. It passes one app-generated `--patch` file that disables the original `webserver` row, inserts a new `desktop-webserver` row whose absolute entry provides the same `webServer` service, configures `web-runtime` with URL printing and its browser-only surface context disabled, and inserts a minimal `desktop-surface` row that restores the Harness source section and adds truthful desktop-surface orientation. Patch rows cannot replace an existing row's `name`, so disable-plus-insert is a tested compatibility obligation. The overlay contains no secret; the provider reads its socket path and token from a fixed inherited descriptor. The selected profile remains unchanged and continues to own its official Web bundle, user patch, home patch, and installed third-party bundles.

**Rationale**: Patch overlays and absolute plugin entries are supported by upstream app boot. Disabling one stable row and inserting a service-equivalent carrier avoids copying dozens of first-party rows, preserves the selected profile's dependency resolution and dynamic plugins, and lets the Host continue deriving the boot manifest from its actual plugin tree. The browser runtime cannot remain fully enabled because it hardcodes an unreachable `http://127.0.0.1:<port>` into model and shell context; disabling it without the desktop companion would wrongly remove the Harness source section. The compatibility probe rejects a profile that does not contain the required Web rows rather than silently turning a headless composition into a different product.

**Alternatives considered**:

- **Copy the Web bundle patch into this repository**: rejected because roster additions and configuration fixes would drift silently.
- **Persist the desktop provider into the user's profile**: rejected because ordinary `dsh web` would then depend on an app-only startup descriptor and profile state would be mutated merely by launching the desktop app.
- **Import `runProfile()` from an internal package path**: rejected while the public binary plus `--patch` covers the need; an internal launcher import would add a version-specific seam without deleting any owned code.
- **Build a bespoke desktop renderer entry**: rejected because `AppWebEntry` owns non-trivial dynamic module boot and failure semantics; copying it creates another UI fork.
- **Use the browser application from a remote CDN**: rejected because offline operation, exact payload integrity, and third-party local plugin bundles would be lost.

## Decision 3 — Use authenticated Unix-domain HTTP as the macOS private carrier

**Decision**: Replace the TCP-listening WebServer provider with a structurally compatible provider that listens on a randomized Unix-domain socket inside a mode-0700 runtime directory. Upstream keeps the dispatcher private, so this provider must reproduce the small route registry and Node HTTP/upgrade dispatch mechanics, including exact/prefix matching, longest-prefix precedence, fallback, index taps, per-request error containment, upgraded-socket ownership, backpressure, and teardown; it belongs to the versioned compatibility layer and is kept behaviorally locked to the pinned provider by contract tests. Every request must carry a per-launch 256-bit token. The token and socket path arrive through a bounded one-use inherited descriptor, are never placed in argv or environment, never reach the renderer, and are cleared from mutable startup state after provider activation. Authentication removes the desktop token from `headers`, `rawHeaders`, and every request view before a plugin handler receives the request. The provider reports loopback host and a non-routable sentinel port only for upstream bind-dependent decisions; compatibility tests prove no supported first-party path constructs or connects to that sentinel, while a negative third-party fixture that reads the sentinel produces an actionable incompatibility result.

**Rationale**: This keeps the exact upstream Node `IncomingMessage`/`ServerResponse` route handlers, static fallback, boot-manifest taps, plugin bundle endpoint, generic RPC routes, and WebSocket downlinks. The shell changes physical carriage only. It avoids both unauthenticated loopback exposure and an owned serialization of every DSH method. A Unix-domain socket is a public Node API and gives Electron and Rust a well-understood byte stream with kernel backpressure.

**Alternatives considered**:

- **Random loopback TCP port**: simplest and acceptable as a browser baseline, but rejected for production because it remains reachable by other local processes, repeats the community-wrapper shape, and weakens the no-TCP hard gate.
- **Raw stdio Fetch multiplexing**: portable and fully private, but rejected for the first foundation because it introduces a second framing/stream protocol and requires translating every HTTP/WebSocket lifecycle detail. It remains a fallback if the UDS proxy cannot meet Windows portability later.
- **Run Host in Electron main or a Rust process**: rejected because DSH is a Node plugin runtime, main-thread work would risk UI stalls, and Electron's Node ABI is not the standard ABI expected by arbitrary native plugins.
- **Call the upstream `inProcessHandler()` across processes**: rejected as stated; object references and streaming `Response` bodies do not cross a process boundary without inventing another carrier.
- **Request an upstream transport-neutral WebServer dispatcher first**: retained as an upstream simplification opportunity, but not a prerequisite. If upstream later publishes the dispatcher, the compatibility package deletes its locked copy and retains the same service tests.

## Decision 4 — Present a privileged custom origin, not `file://`

**Decision**: Both candidates load `dsh-app://localhost/`. Their native protocol handlers serve finite navigation, module, stylesheet, image, and other browser-managed resource responses from the authenticated UDS. Before the official entry runs, a minimal isolated bootstrap adapter installs same-origin browser-compatible Fetch streaming, EventSource, and WebSocket primitives over the same UDS; remote-origin networking remains native. The adapters accept arbitrary paths and methods and are not limited to first-party API or event paths. The official always-mounted HMR `EventSource('/plugins/events')`, generic streaming routes, and third-party HTTP/upgrade registrations therefore remain carriage-compatible.

**Rationale**: `localhost` preserves upstream loopback classification for native path, settings, credentials, and directory-picker affordances on macOS. A standard secure custom origin gives relative assets, dynamic plugin scripts, routing, storage, and CSP a coherent origin. Electron can stream a custom-protocol `Response`, but Tauri's public custom-scheme response path is finite-body oriented; the shared runtime adapters prevent an infinite SSE or streamed Fetch response from being buffered and keep candidate semantics comparable. The adapter changes carriage only and leaves HTTP, SSE, and WebSocket payloads opaque.

**Alternatives considered**:

- **`file://`**: rejected because it has an opaque origin for security checks, absolute `/plugins/*` paths do not naturally map to the staged payload, and upstream trust logic refuses `Origin: null`.
- **Inject a new client connection implementation into the official Cordis graph**: rejected because the current browser boot has no deterministic pre-entry provider hook and the upstream connection row reads optional transport once. Depending on entry timing would be fragile.
- **Rewrite or wrap every upstream request call**: rejected because it would couple the shell to product methods and third-party plugins.

## Decision 5 — Use a standard Node sidecar and shared supervisor contract

**Decision**: Both shells spawn the exact staged standard Node runtime with the official built `dsh` binary, selected profile, and ephemeral desktop overlay. A dedicated inherited descriptor carries the one-use provider capsule; stdout and stderr remain untrusted application logs and never carry control messages. The shell derives readiness from an authenticated health endpoint and child liveness. Graceful shutdown uses SIGTERM on macOS; escalation is fenced by application-instance id, generation id, PID, and process start time and targets only the owned process group.

**Rationale**: The standard runtime retains native add-on compatibility and keeps Host memory/performance identical between candidates. Health polling avoids parsing mixed application logs as a readiness protocol. A platform-neutral supervisor reducer can be tested once while Electron and Rust implement only spawn, signal, and process-tree observation.

**Alternatives considered**:

- **Electron utility process**: deferred until an explicit native-addon compatibility matrix proves it interchangeable. It is not the compatibility baseline.
- **One Host per window**: rejected because it duplicates memory and risks concurrent access to DSH state. The foundation uses one application window and one Host.
- **Broad process-name termination**: rejected because it can terminate unrelated Node or DSH processes.

## Decision 6 — Keep Electron as baseline and Tauri as challenger

**Decision**: Implement both candidates to the same architecture-viability slice before either can advance to full parity. Payload identity, parity, privacy, lifecycle, integrity, and response budgets are hard gates. If only one candidate passes every hard gate, it is selected. If both pass, Electron remains the compatibility baseline unless Tauri demonstrates at least 25% lower predeclared aggregate p95 attributable physical footprint, no individual memory scenario more than 5% worse, and no response or startup metric more than 10% worse or outside its absolute budget. If neither passes, the evaluator records no-selection and emits remediation inputs.

**Rationale**: Rust replaces shell overhead, not the official React renderer or Node Host. System-WebView savings are plausible but cannot be inferred from executable size. Electron reduces renderer-engine variance and is therefore the safer default unless measured memory justifies Tauri's multi-engine maintenance cost.

**Alternatives considered**:

- **Tauri only because it uses Rust**: rejected as technology-first reasoning and because total memory still includes the system WebView and Node Host.
- **Electron only**: rejected before measurement because memory is the user's highest priority and a system-WebView challenger can produce meaningful savings.
- **Pure SwiftUI/AppKit**: rejected because official React contributions and arbitrary third-party browser plugins would require separate implementations, contradicting 100% parity and low adaptation cost.

## Decision 7 — Generate parity from the payload, then add scenario coverage

**Decision**: The expected parity inventory is generated independently from the pinned package closure and official Web-profile bundle patches. The live Host-composed boot manifest is then compared with that expected set; a missing package cannot redefine the expected denominator. Every new, removed, or unclassified entry fails until it maps to an automated activation check and, where user-visible, a reference scenario. A negative control deliberately removes or corrupts one bundle and must fail the oracle. An out-of-tree probe plugin is installed through the ordinary profile mechanism and contributes Host behavior, a generic HTTP/upgrade route, RPC/stream behavior, and browser UI; install, activate, unload, reload, and upgrade are exercised without prebundling it into either candidate.

**Rationale**: A handwritten checklist can claim 100% while omitting newly added upstream rows. Manifest derivation turns upgrade drift into a loud compatibility result. Scenarios catch failures that entry activation alone cannot.

**Alternatives considered**:

- **Screenshot-only comparison**: rejected because background capabilities, stream ordering, and interactions can be broken while a page looks correct.
- **Only test first-party packages**: rejected because unchanged dynamic plugin support is a core differentiator.
- **Accept a generic fallback for missing client UI**: rejected for this desktop route because the official renderer is present and must load the real contribution.

## Decision 8 — Measure complete processes and reject invalid runs

**Decision**: Each sample records candidate, payload/fixture digests, OS and hardware, power/thermal state, screen configuration, developer-tool state, all attributable process identities, scenario timestamps, macOS de-duplicated `footprint` as the decision memory metric, diagnostic per-process RSS, input-to-paint latency, main-loop stalls, request/ack control latency, stream integrity, and startup phases. Startup records process start, window visible, renderer settled, Host connected, composer operational, and first session ready; only an operational composer satisfies prompt-ready. Candidate order is randomized, each launch class has at least thirty runs, sustained scenarios collect enough per-interaction observations for p95/p99 plus bootstrap confidence intervals, and the validator rejects unequal payloads, incomplete WebView/GPU/network process attribution, thermal throttling, wrong sample counts, hidden developer tools, or integrity failures before selection.

**Rationale**: Renderer heap, shell PID RSS, binary size, and single warm launches do not answer the user's priorities. Predeclared invalidation and thresholds prevent benchmark noise or selective reporting from deciding the architecture.

**Alternatives considered**:

- **Use vendor memory claims**: rejected because they exclude this project's Node Host, plugins, and real renderer.
- **Report medians only**: rejected because stream jank and launch outliers are user-visible.
- **Let faster startup offset a parity or security failure**: rejected; both are hard gates.

## Decision 9 — Split later productization and platform work

**Decision**: This mission delivers unsigned local macOS vertical slices and the production-shell decision. Signing, notarization, updater integrity, crash-report consent/upload, release hosting, Windows named-pipe/WebView2 behavior, and Linux WebKitGTK packaging are separate missions using the selected foundation.

**Rationale**: The architecture must be proven end to end before expensive release infrastructure is duplicated across two candidates. The split does not relax foundation requirements: packaged local smoke, no unauthenticated TCP, exact payload, recovery, parity, and performance evidence remain mandatory.

**Alternatives considered**:

- **Ship publicly from the first mission**: rejected because signing/updating both candidates before the evidence decision wastes work and expands security scope.
- **Defer all packaging until after the decision**: rejected because process layout, staged runtime, native resources, and packaged behavior materially affect memory and launch results.

## Resolved risks and retained spikes

The plan has no unresolved product decision. Three implementation facts must be proven early through bounded spikes, with failure causing a planned fallback or no-selection rather than an implicit scope reduction:

1. **Tauri macOS custom origin**: prove `dsh-app://localhost` preserves `location.hostname === 'localhost'`, supports official module scripts, CSP, storage, finite browser-managed resources, and a pre-entry bootstrap. If it cannot, the Tauri candidate fails the architecture-viability gate; do not patch upstream UI code or silently move to a loopback server.
2. **Fetch, EventSource, and WebSocket over UDS**: prove both candidates can expose streaming Fetch with abort/backpressure, the official HMR EventSource with reconnection and last-event-id behavior, and arbitrary WebSocket upgrades with ordinary handshake semantics over a supplied Unix stream. If a WebSocket library cannot inject the stream, implement the RFC 6455 handshake in the platform adapter while keeping upstream frames opaque. A missing primitive disqualifies the candidate rather than removing its official row.
3. **External profile overlay**: prove the official published binary accepts an absolute desktop provider entry in a repeatable `--patch`, preserves the selected Web profile's user/home layers and out-of-tree dependencies, exposes every registered HTTP/upgrade route, and never reads the sentinel port in the disabled presentation paths. Failure moves profile launch knowledge into the versioned compatibility adapter; it never permits mutating the user's profile or copying the official roster.

## Operational decisions fixed for task planning

- A second launch for the same `(DSH home, profile)` focuses the existing application instance; a distinct profile may run as a distinct instance only after a file-lock and durable-store safety probe approves it.
- Shell loading/recovery UI is limited to status, retry, reveal-redacted-log-location, and safe exit. Official renderer content receives no filesystem, process, unrestricted shell, token, or socket-path capability.
- The deterministic fixture uses a real profile, Host, session store, connection, and interaction path. Only the model/provider response is replayed; the browser `?fixture` transport is forbidden in architecture and parity gates.
- Existing-home verification compares candidate filesystem changes with the official browser baseline and permits only the same expected profile/session writes. A newer unsupported durable schema fails before Host work begins.
- Host crash tests run with an active session and terminal/subprocess, prove the old process group is gone, fence every generation, and never replay a tool whose external side effect may already have occurred.
- Socket audits cover IPv4 and IPv6 listeners for every attributable application process at boot, idle, stream, recovery, and shutdown. The expected result is no application-created TCP listener.

Both spikes have concrete contract tests and belong before candidate UI integration.
