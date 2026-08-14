---
work_package_id: WP09
title: Electron Compatibility Baseline Vertical Slice
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
- T047
- T048
- T049
- T050
- T051
- T052
agent: codex
history: []
agent_profile: frontend-freddy
authoritative_surface: apps/electron/
create_intent:
- apps/electron/index.html
- apps/electron/vite.config.ts
- apps/electron/tsconfig.json
- apps/electron/electron-builder.yml
- docs/electron-candidate.md
execution_mode: code_change
model: ''
owned_files:
- apps/electron/src/**
- apps/electron/tests/**
- apps/electron/resources/**
- apps/electron/index.html
- apps/electron/vite.config.ts
- apps/electron/tsconfig.json
- apps/electron/electron-builder.yml
- docs/electron-candidate.md
role: implementer
tags: []
---

# WP09: Electron Compatibility Baseline Vertical Slice

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Deliver the Electron macOS arm64 compatibility-baseline vertical slice around the exact staged DSH payload. Electron owns a hardened window, custom-protocol and preload adaptation, shell lifecycle wiring, and packaging only; the official renderer and dynamic contributions remain the complete product UI, and the official Host remains an external standard-Node sidecar.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP09 --agent codex
```

## Context

WP08 supplies the deterministic architecture fixture and carrier gates. Consume WP02 payload identity, WP04 official-binary launch plans, WP05 supervision and boot-state policy, and WP06's candidate-neutral renderer-proxy contract through their public exports. Do not copy their policies into `apps/electron` or weaken their shared conformance assertions.

Use acceptance-test-first TDD for every subtask: add the smallest externally observable Electron test, retain its RED command and result, implement the minimum integration, then retain the GREEN command and result. Candidate tests may add Electron wiring assertions but may not fork, skip, relabel, or relax the shared WP06 or WP08 suites.

The application may render only the responsive shell-owned boot and recovery surface before Host readiness. It must not implement DSH business UI, session state, interaction semantics, or a per-method IPC API. Official and third-party renderer code receives browser primitives, never Electron, Node, process, filesystem, token, socket-path, or unrestricted invocation capabilities.

### Subtask T047: Harden the Electron process and renderer boundary

**Purpose**: Establish a sandboxed Chromium baseline whose renderer has browser authority only and whose main process cannot be reached through ambient Electron or Node APIs.

**Steps**:

1. RED: launch a probe renderer and prove it currently detects any Node global, Electron module, preload internals, unrestricted IPC, popup, remote navigation, or forbidden permission.
2. Register application schemes before Electron readiness and create the main `BrowserWindow` with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webviewTag: false`, and `allowRunningInsecureContent: false`.
3. Apply a strict packaged CSP that permits the exact official self-hosted scripts, styles, workers, images, and same-origin connections required by the payload without `unsafe-eval`, remote code, wildcard authorities, or a development server.
4. Deny `window.open`, unrequested windows, `javascript:` URLs, non-`localhost` application authorities, top-level remote navigation, downloads without a user gesture, and permissions outside the explicit browser-parity allowlist.
5. Validate every privileged event against the current main `webContents`, frame origin, renderer generation, and expected transfer object; reject subframes, retired renderers, DevTools, and unknown senders.
6. Disable remote debugging and packaged DevTools, and ensure renderer crashes cannot grant a replacement window broader preferences.
7. GREEN: run the exploit probes against initial load, reload, popup, iframe, and crash-recreated windows with every forbidden capability absent.

**Files**:

- `apps/electron/src/main/{security,window,navigation}.ts` and `src/main/index.ts` (new)
- `apps/electron/tests/{security-boundary,navigation}.electron.test.ts` (new)

**Validation**: `corepack pnpm --filter ./apps/electron test -- security-boundary navigation` passes with the exact hardened preferences, strict CSP, sender fencing, navigation denial, and no renderer-visible Electron or Node surface.

### Subtask T048: Adapt the shared supervisor and responsive boot shell

**Purpose**: Start and observe the official Host without blocking Electron main, while keeping startup failure recoverable and the Host ABI independent from Electron.

**Steps**:

1. RED: delay, fail, crash, and hang the Host fixture while asserting the window paints and accepts Retry, Reveal Log Location, and Safe Exit actions throughout.
2. Spawn the exact staged standard Node executable and official built `dsh` binary from the WP04 `BootPlan`; never run Host in Electron main, `utilityProcess`, Electron's embedded Node, `process.execPath`, or `ELECTRON_RUN_AS_NODE`.
3. Supply the one-use startup capsule only through its inherited descriptor, treat stdout/stderr only as redacted logs, and derive readiness only from WP05's authenticated health probe and identity fence.
4. Drive the shell-owned boot document from WP05's loading, ready, recovering, and failed view state without synchronous filesystem, payload, log, or tool-output work on Electron main.
5. Wire Retry to a fresh approved recovery cycle, Reveal Log Location to the restricted native action, and Safe Exit to intentional teardown; expose no log contents, path, token, or process identifier to renderer JavaScript.
6. Keep one application instance and one live Host generation, focus the owner on a competing same-home/profile launch, and surface bounded retry exhaustion without a restart storm.
7. GREEN: prove fast first paint under delayed boot, correct three-action failure state, exact staged-Node executable identity, and a responsive main loop during large child output.

**Files**:

- `apps/electron/src/main/{host-adapter,instance,boot-state}.ts` and `src/boot/{index,view}.ts` (new)
- `apps/electron/index.html` and `apps/electron/tests/{boot-shell,host-sidecar}.electron.test.ts` (new)

**Validation**: focused tests show a usable window before Host readiness, exactly the approved recovery actions after failure, one Host maximum, redacted diagnostics, and a Host executable/version distinct from Electron's embedded Node.

### Subtask T049: Serve the secure custom origin and install WP06 primitives

**Purpose**: Present `dsh-app://localhost` as the official renderer's standard secure origin and connect every opaque resource and streaming request to the authenticated private carrier.

**Steps**:

1. RED: run WP06 origin probes before the official entry and fail on a nonstandard or insecure origin, wrong hostname, buffered stream, missing primitive, exposed secret, or candidate-specific route.
2. Register `dsh-app` as standard, secure, fetch-capable, and CSP-capable before `app.ready`; accept only the exact `localhost` authority and preserve opaque path, query, method, permitted headers, status, redirect, and finite response bytes.
3. Map finite navigation and browser-managed resources through the authenticated UDS adapter while keeping token injection, socket path, normalized `Host`, and normalized `Origin` inside Electron main.
4. Install WP06's minimal pre-entry Fetch-stream, EventSource, and WebSocket primitive adapter from the isolated preload before any official module or dynamic contribution executes.
5. Delegate external origins to captured native browser primitives unchanged, and reject application-scheme authority confusion, header spoofing, direct-socket access, and non-loopback same-origin WebSocket requests.
6. Stream uploads and downloads with abort propagation and native backpressure; never buffer an infinite EventSource, parse DSH JSON, or dispatch by DSH path or method.
7. GREEN: invoke the unchanged `defineRendererProxyConformance` suite against the Electron adapter and pass resource, Fetch, SSE, WebSocket, external-delegation, reload, and Host-generation cases.

**Files**:

- `apps/electron/src/main/{protocol,carrier-adapter}.ts` and `src/preload/{index,primitives}.ts` (new)
- `apps/electron/tests/{custom-origin,renderer-proxy}.electron.test.ts` (new)

**Validation**: the exact WP06 conformance command passes for `dsh-app://localhost`, and source inspection finds no route table, business method, token-valued preload field, full-response buffering, or external-origin interception.

### Subtask T050: Isolate MessagePorts, queues, and lifecycle control

**Purpose**: Carry generic primitive traffic across a generation-fenced channel without granting arbitrary IPC or allowing bulk streams to starve abort, close, and lifecycle control.

**Steps**:

1. RED: flood multiple Fetch, EventSource, and WebSocket exchanges while reloading and crashing renderers; assert bounded bytes, ordered accepted data, prompt control delivery, and no late event delivery.
2. Create a fresh `MessageChannelMain` for each renderer generation, transfer only its renderer port after sender/origin validation, and close both ends atomically when that renderer retires.
3. Accept only the closed WP06 primitive and lifecycle record kinds with branded exchange/socket and renderer/Host generation ids; reject unknown records, malformed transfer lists, stale ids, and direct `ipcRenderer.invoke` access.
4. Keep bulk bytes on bounded per-exchange, per-socket, per-renderer, and aggregate queues with explicit native-write acknowledgements and pause/resume backpressure.
5. Reserve a bounded control lane for generic abort, close, acknowledgement, and generation retirement so data pressure cannot delay request/ack delivery beyond 100 ms p95 or create a 250 ms main-loop stall.
6. Drop and account for late native events after renderer or Host replacement, release every queue and listener after quiescence, and never deserialize application JSON in main or preload.
7. GREEN: pass deterministic pressure, invalid-sender, stale-generation, reload, crash, and close-race tests with zero retained ports, listeners, timers, or queued bytes.

**Files**:

- `apps/electron/src/main/{message-port-bridge,queue-adapter}.ts` and `src/preload/message-port.ts` (new)
- `apps/electron/tests/{message-port,backpressure}.electron.test.ts` (new)

**Validation**: stress results preserve order and accepted bytes, meet the control/stall budgets, reject arbitrary IPC, and prove retired renderers and Host generations retain no live channel state.

### Subtask T051: Prove exact renderer parity and lifecycle recovery

**Purpose**: Exercise the real official renderer and unchanged dynamic bundles through user-observable browser behavior while proving reload and crash recovery preserve Host authority.

**Steps**:

1. RED: boot the architecture fixture with an omitted or corrupted official/dynamic bundle and prove the candidate fails rather than substituting UI, skipping the row, or using a desktop implementation.
2. Load the byte-exact official index, boot manifest, first-party modules, and out-of-tree WP07 contribution from the staged payload; assert payload, renderer, profile, and fixture digests match WP08 evidence.
3. Exercise localStorage and sessionStorage, secure-context classification, clipboard read/write mediation, attachment file selection, content-disposition download/export, terminal keyboard/paste/input, and IME composition against the official browser expectations.
4. Replay the representative session, stream, approval, ask-user, cancellation, tool, terminal, diff, plan, settings, attachment, download, and plugin lifecycle scenarios without adding a business UI or per-method IPC.
5. Reload and crash the renderer during active traffic: retain the one Host, retire old ports/exchanges, recreate the hardened window, resynchronize from Host state once, and duplicate no completed user action.
6. Crash the Host with an active terminal/subprocess: fence the old generation, remove its process group, expose bounded recovery state, reconnect once, and never replay an externally effectful tool.
7. Quit during startup, readiness, recovery backoff, active streaming, and renderer recreation; await reverse teardown and prove no owned child, UDS, runtime artifact, port, or timer remains.

**Files**:

- `apps/electron/tests/{official-renderer,platform-behavior,lifecycle-recovery}.electron.test.ts` (new)
- `apps/electron/src/main/lifecycle-adapter.ts` (new)

**Validation**: Electron passes the unchanged WP08 architecture fixture and WP06 platform expectations with exact official/dynamic bundles, correct storage/clipboard/download/attachment/terminal/IME behavior, one Host, no duplicated actions, and no orphaned resources.

### Subtask T052: Package and smoke the macOS arm64 baseline

**Purpose**: Prove the unsigned packaged application contains the exact runnable architecture and preserves all compatibility, ABI, privacy, and teardown properties outside the development launcher.

**Steps**:

1. RED: inspect an intentionally incomplete package and prove the smoke rejects missing payload files, wrong architecture, mixed digest, absent standard Node runtime, native-addon ABI mismatch, development networking, or incomplete process cleanup.
2. Configure reproducible unsigned macOS arm64 packaging with the official renderer, exact DSH closure, staged standard Node distribution, Electron resources, preload/main bundles, and no development server, source checkout, remote debugger, or alternate renderer.
3. Verify the app executable, helpers, and staged Node architecture; verify the payload lock, renderer digest, package closure, Node digest/version, and adapter version before the window begins user work.
4. From a clean packaged user-data directory, run the WP06 conformance suite and WP08 architecture fixture, create a real session, activate the unchanged dynamic plugin, reload, recover, quit, and resume.
5. Load the native-addon probe inside the external Host and assert standard-Node `process.execPath`, version, and module ABI rather than Electron's executable, embedded Node, or module ABI.
6. Audit every attributable process for IPv4 and IPv6 listeners at boot, ready, stream, recovery, and shutdown; require zero application-created TCP listener and no remote-debugging endpoint.
7. After normal quit and injected renderer/Host crashes, require the complete owned process group, private UDS, runtime directory, MessagePorts, and temporary download/attachment handles to be gone while unrelated Node/DSH processes remain alive.
8. Document the exact build, focused test, packaged smoke, architecture, native-addon, socket-audit, and teardown commands plus the candidate's remaining foundation limitations.

**Files**:

- `apps/electron/{vite.config.ts,tsconfig.json,electron-builder.yml}` and `apps/electron/resources/**` (new)
- `apps/electron/tests/{packaged-macos-arm64,native-addon,no-tcp}.smoke.test.ts` (new)
- `docs/electron-candidate.md` (new)

**Validation**: the packaged macOS arm64 smoke passes from a clean directory with matching digests, the official renderer and plugin, standard-Node native-addon compatibility, shared conformance, zero application TCP listeners, and zero orphaned owned resources.
