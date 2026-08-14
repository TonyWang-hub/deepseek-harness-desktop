---
work_package_id: WP10
title: Tauri System-WebView Challenger Vertical Slice
dependencies:
- WP08
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-011
- FR-012
- FR-018
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- NFR-006
- NFR-008
- NFR-009
- NFR-011
- NFR-012
- C-004
- C-005
- C-006
- C-010
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T053
- T054
- T055
- T056
- T057
- T058
agent: codex
history: []
agent_profile: implementer-ivan
authoritative_surface: apps/tauri/
create_intent:
- apps/tauri/index.html
- apps/tauri/vite.config.ts
- apps/tauri/tsconfig.json
- apps/tauri/src-tauri/build.rs
- apps/tauri/src-tauri/tauri.conf.json
- docs/tauri-candidate.md
execution_mode: code_change
model: ''
owned_files:
- apps/tauri/src/**
- apps/tauri/tests/**
- apps/tauri/index.html
- apps/tauri/vite.config.ts
- apps/tauri/tsconfig.json
- apps/tauri/src-tauri/src/**
- apps/tauri/src-tauri/tests/**
- apps/tauri/src-tauri/build.rs
- apps/tauri/src-tauri/tauri.conf.json
- apps/tauri/src-tauri/capabilities/**
- apps/tauri/src-tauri/icons/**
- docs/tauri-candidate.md
role: implementer
tags: []
---

# WP10: Tauri System-WebView Challenger Vertical Slice

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Deliver the Tauri macOS arm64 system-WKWebView challenger around the exact staged DSH payload. Tauri owns only its minimal Rust shell, private carrier adaptation, lifecycle integration, and packaging; the official renderer and its unchanged dynamic contributions remain the complete product UI, and the official Host remains an external standard-Node sidecar.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP10 --agent codex
```

## Context

WP08 supplies the deterministic architecture fixture and hard carrier gates. Consume the shared payload, `BootPlan`, supervisor, and WP06 renderer-proxy contracts through public exports. Candidate-specific exceptions, skipped shared assertions, DSH business commands, session projections, interaction logic, alternate UI, and per-method native APIs are prohibited.

Use acceptance-test-first TDD for every subtask. Retain the initial RED command and result, implement the minimum candidate integration, then retain the GREEN command and result. T053 is a mandatory architecture-viability hard stop; do not begin T054–T058 unless it passes in the real macOS WKWebView.

### Subtask T053: Retain the macOS custom-origin spike as a hard stop

**Purpose**: Prove the system WKWebView can carry the required origin and browser primitives before any Tauri vertical-slice investment; failure disqualifies the current Tauri design.

**Steps**:

1. RED: add and run a retained macOS WKWebView spike before all other WP10 work; the unimplemented candidate must fail each required observation rather than receive a mock or browser substitution.
2. Register and load exactly `dsh-app://localhost/`, then prove `location.protocol === 'dsh-app:'`, `location.hostname === 'localhost'`, official-style ES module loading, strict CSP enforcement, secure-context classification and APIs, localStorage and sessionStorage, and finite navigation, script, style, image, and range resources.
3. Install a minimal initialization script before the first official-style module and prove the bootstrap wins every pre-entry ordering race on initial load and reload without editing upstream entry code.
4. Over an authenticated Unix stream, prove incremental chunk-split SSE with named events, retry, last-event-id reconnect, close, and bounded buffering, plus arbitrary-path WebSocket handshake, subprotocol, text/binary frames, ordering, backpressure, and clean/error close semantics.
5. Keep the RED test and completed spike in the normal conformance suite; record engine/OS identity and the exact GREEN evidence so later WebKit changes rerun the proof.
6. If any hostname, module, CSP, secure API, storage, finite-resource, pre-entry bootstrap, streaming SSE, or arbitrary WebSocket assertion cannot pass, stop T054–T058 and mark the current Tauri design disqualified.
7. Do not evade failure with `file://`, loopback TCP, a development server, an alternate hostname, an upstream patch, a removed HMR row, buffered infinite responses, or a candidate-only exception.

**Files**:

- `apps/tauri/tests/custom-origin-spike.macos.test.ts` (new)
- `apps/tauri/src-tauri/src/spike.rs` and `apps/tauri/src/spike-bootstrap.ts` (new, retained)

**Validation**: `corepack pnpm --filter ./apps/tauri test -- custom-origin-spike` passes on the real macOS WKWebView with every named observation, or WP10 stops with Tauri disqualified and no later subtask attempted.

### Subtask T054: Build the minimal Rust shell and standard-Node sidecar

**Purpose**: Establish a least-authority Tauri core that stays responsive while one exact standard-Node Host generation boots and fails independently.

**Steps**:

1. RED: launch delayed, failed, crashed, and hung Host fixtures while probing forbidden Tauri commands/plugins, renderer secrets, duplicate generations, and shell responsiveness.
2. Create only the main production window and minimal Rust core; disable packaged DevTools, remote navigation, unexpected windows, arbitrary commands, and every unneeded capability.
3. Grant the main window only the generic renderer bridge operations. Do not install or expose Tauri shell, opener, process, unrestricted filesystem, or arbitrary invocation plugins.
4. Spawn the exact staged standard Node executable with the official built `dsh` binary from the shared `BootPlan`; never embed Host in Rust, WebKit, a Tauri plugin, or a developer-installed runtime.
5. Pass the one-use startup capsule only through its inherited descriptor, derive readiness only from authenticated health and child identity, and keep token, socket path, PID, and raw logs out of renderer state.
6. Render only responsive loading and recovery status with Retry, Reveal Log Location, and Safe Exit; keep payload work and child output off the UI thread and enforce one instance and one Host maximum.
7. GREEN: prove the hardened capability allowlist, standard-Node executable identity, fast first paint, three recovery actions, bounded retry, and no shell-plugin authority.

**Files**:

- `apps/tauri/src-tauri/src/{main,lib,capabilities,host_sidecar}.rs` and `apps/tauri/src-tauri/capabilities/main.json` (new)
- `apps/tauri/src/{boot,index}.ts`, `apps/tauri/index.html`, and `apps/tauri/tests/{capabilities,host-sidecar}.test.ts` (new)

**Validation**: focused Rust and app tests prove a responsive least-authority shell, exact external standard-Node Host, one live generation, secret confinement, approved recovery actions, and no Tauri shell plugin.

### Subtask T055: Implement the generic WP06 Channel and custom-protocol adapter

**Purpose**: Carry finite resources and streaming browser primitives over the private UDS with opaque semantics, bounded queues, cancellation, and backpressure.

**Steps**:

1. RED: bind the unchanged WP06 conformance suite to the Tauri adapter and fail on buffered streams, missing aborts, stale events, exposed carrier details, external-origin interception, or path-specific dispatch.
2. Serve finite `dsh-app://localhost` navigation and browser-managed resources through the Tauri custom protocol while preserving opaque method, path, query, permitted headers, status, redirect, range, and response bytes.
3. Install the WP06 pre-entry Fetch-stream, EventSource, and WebSocket adapters through an initialization script and generic Tauri `Channel` records before any official or dynamic module executes.
4. Validate the main window, application origin, renderer generation, Host generation, exchange/socket ids, and closed record kinds; reveal neither UDS path nor token and reject unrestricted `invoke` access.
5. Stream request/response bytes and arbitrary RFC 6455 frames without DSH JSON parsing or route tables; delegate external origins to native WebKit primitives unchanged.
6. Bound per-exchange, per-socket, per-renderer, and aggregate queues; propagate abort/close immediately, pause native reads/writes for backpressure, and reserve control capacity so bulk traffic cannot starve cancellation or acknowledgements.
7. GREEN: pass WP06 finite-resource, Fetch, SSE, WebSocket, reload, Host-generation, cancellation, pressure, late-event, and cleanup cases without candidate allowances.

**Files**:

- `apps/tauri/src-tauri/src/{custom_protocol,channel_bridge,http_proxy,websocket_proxy}.rs` (new)
- `apps/tauri/src/{bootstrap,channel}.ts` and `apps/tauri/tests/{renderer-proxy,backpressure}.test.ts` (new)

**Validation**: the exact WP06 Tauri conformance command passes with incremental bytes, arbitrary routes, browser-compatible close/error behavior, bounded retained state, prompt cancellation, and zero stale delivery.

### Subtask T056: Prove the exact official renderer and platform behavior

**Purpose**: Run the byte-exact official renderer and unchanged first-party and out-of-tree plugins with WebKit behavior matching the official browser baseline.

**Steps**:

1. RED: omit or corrupt an official or dynamic bundle and prove the candidate fails instead of substituting UI, skipping an inventory item, or using a desktop implementation.
2. Load the exact official index, boot manifest, first-party modules, and WP07 plugin from the staged payload; assert payload, renderer, profile, fixture, and contribution digests match WP08 evidence.
3. Exercise localStorage and sessionStorage durability and isolation, secure-context behavior, clipboard read/write, download/export, attachment selection, terminal keyboard and paste input, and IME composition through official renderer flows.
4. Replay session, stream, approval, ask-user, cancellation, tool, terminal, diff, plan, settings, attachment, download, and plugin lifecycle scenarios through the real Host and generic carrier.
5. Prove plugin install, activate, unload, reload, and upgrade plus custom HTTP, SSE, and WebSocket routes without prebundling, candidate code changes, or privileged renderer authority.
6. GREEN: pass the unchanged WP08 architecture fixture and platform expectations with exact final-state and action counts; any missing or degraded behavior fails Tauri outright.

**Files**:

- `apps/tauri/tests/{official-renderer,plugins,platform-behavior}.test.ts` (new)
- `apps/tauri/src/platform.ts` (new, generic platform integration only)

**Validation**: official renderer/plugins and storage/clipboard/download/attachment/terminal/IME scenarios match the baseline with no candidate exception, alternate business UI, or DSH-specific native method.

### Subtask T057: Fence reload, crash recovery, and teardown

**Purpose**: Keep renderer recreation independent from Host authority and leave no owned process, channel, socket, or runtime artifact after recovery or exit.

**Steps**:

1. RED: reload or terminate WebContent and crash Host during active streams, approvals, terminal/subprocess work, startup, recovery backoff, and shutdown; assert one Host maximum and no duplicate effect.
2. On renderer reload or crash, retire its generation, abort old exchanges/sockets, recreate the hardened WKWebView, retain the Host, and resynchronize once from authoritative Host state.
3. On Host crash, fence the old generation, terminate its identity-matched process group, close its UDS and channels, expose bounded recovery, and reconnect once without replaying externally effectful work.
4. Make Retry start one approved fresh generation, a competing same-home/profile launch focus the owner, and explicit quit suppress every recovery transition.
5. Tear down in reverse ownership order during every lifecycle phase and wait for Host descendants, UDS, runtime directory, channels, queues, listeners, timers, and temporary platform handles to quiesce.
6. GREEN: pass reload, WebContent crash, Host crash, retry exhaustion, quit-race, instance-lease, unrelated-process, and post-quiescence retention tests.

**Files**:

- `apps/tauri/src-tauri/src/{lifecycle,instance,teardown}.rs` (new)
- `apps/tauri/tests/{reload-recovery,host-recovery,teardown}.test.ts` (new)

**Validation**: every fault path preserves durable Host authority, duplicates no completed action, never overlaps Host generations, leaves no orphaned owned resource, and never targets unrelated Node or DSH processes.

### Subtask T058: Package and smoke the complete macOS arm64 process set

**Purpose**: Prove the unsigned packaged challenger preserves conformance, standard-Node ABI, privacy, teardown, and complete WebKit process attribution outside development tooling.

**Steps**:

1. RED: inspect an incomplete package and prove the smoke rejects wrong architecture, missing payload/runtime bytes, mixed digests, native-addon ABI mismatch, hidden TCP or debug listeners, incomplete WebKit attribution, or surviving owned processes.
2. Configure reproducible unsigned macOS arm64 packaging with the exact official renderer, DSH closure, staged standard Node runtime, Rust shell, capabilities, icons, and no development server, source checkout, remote debugger, or alternate renderer.
3. From a clean packaged user-data directory, run the unchanged WP06 conformance and WP08 architecture fixture, create and resume a real session, activate the external plugin, reload, recover, quit, and relaunch.
4. Load the native-addon probe in the external Host and assert staged standard-Node `process.execPath`, version, architecture, and module ABI rather than any WebKit or Tauri executable identity.
5. Audit IPv4 and IPv6 listeners at boot, ready, stream, recovery, and shutdown for every attributable process; require zero application-created TCP listener and no remote-debugging endpoint.
6. Attribute the app, WebContent, GPU, networking, Host, tool-child, and every WebKit XPC/helper process by descendant, registration, shell metrics, or creation/teardown correlation, including helpers that are not ordinary descendants.
7. After normal quit and injected renderer/Host crashes, require the complete owned process set, UDS, runtime directory, channels, and temporary download/attachment handles to disappear while unrelated processes remain alive.
8. Document exact build, focused test, packaged smoke, native-addon, socket-audit, process-attribution, and teardown commands plus measured foundation limitations; record no candidate exception or business UI.

**Files**:

- `apps/tauri/{vite.config.ts,tsconfig.json}`, `apps/tauri/src-tauri/{build.rs,tauri.conf.json}`, and `apps/tauri/src-tauri/icons/**` (new)
- `apps/tauri/tests/{packaged-macos-arm64,native-addon,no-tcp,webkit-processes}.smoke.test.ts` and `docs/tauri-candidate.md` (new)

**Validation**: the packaged macOS arm64 smoke passes shared conformance with matching digests, exact official content, standard-Node native-addon compatibility, zero application TCP listeners, complete WebKit process attribution, and zero orphaned owned resources.
