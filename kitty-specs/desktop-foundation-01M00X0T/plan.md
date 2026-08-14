# Desktop Foundation and Shell Decision Implementation Plan

**Branch**: `codex/desktop-foundation` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `kitty-specs/desktop-foundation-01M00X0T/spec.md`  
**Planning base / merge target**: `codex/desktop-foundation` / `codex/desktop-foundation`; the accepted feature branch later lands on `main` through a pull request.

## Summary

Build an independently packaged macOS desktop foundation around one exact, unmodified DSH release. A standard Node sidecar invokes the official built `dsh` binary for a supported Web profile plus one ephemeral `--patch` overlay. Because upstream patches cannot change a row's plugin name, the overlay disables the ordinary TCP `webserver` row and inserts a desktop-owned, authenticated Unix-domain-socket provider for the same `webServer` service. It also disables the browser-only URL context and inserts a minimal truthful desktop-surface context without changing the profile. The official index, boot manifest, plugin bundles, HTTP/upgrade routes, API, generic RPC, HMR EventSource, and downlink WebSockets therefore remain upstream-owned. Electron and Tauri serve finite browser resources through `dsh-app://localhost` and install pre-entry same-origin Fetch-stream, EventSource, and WebSocket adapters over the private carrier; neither shell implements DSH business methods, session state, interaction semantics, or product UI.

The mission keeps Electron as the Chromium compatibility baseline and Tauri as the system-WebView memory challenger. Both consume byte-identical staged payloads and the same fixtures. Capability and security gates are disqualifying. If both pass, the committed evaluator applies the whole-process-tree memory threshold first, then responsiveness and startup limits, and records Electron, Tauri, or no-selection as the reproducible result.

## Engineering Alignment

- **Product invariant**: DSH owns product behavior, durable state, sessions, plugins, and the renderer; this repository owns packaging, private carriage, lifecycle, platform integration, compatibility evidence, and performance evidence.
- **Transport invariant**: A generic bootstrap adapter may reproduce browser resource, Fetch, WebSocket, cancellation, and lifecycle primitives. The shell proxies complete HTTP requests and WebSocket frames and never introduces one desktop IPC method per DSH capability.
- **Lifecycle invariant**: One application instance owns at most one Host generation. The state sequence is `idle -> starting -> probing -> ready`, with renderer recreation independent from Host and bounded `recovering` transitions after Host failure.
- **Trust invariant**: The renderer never receives the sidecar authentication token or raw socket path. Shell-native code injects the token when proxying to a socket located in an owner-only runtime directory.
- **Upgrade invariant**: The payload lock selects an exact DSH family, complete package-closure integrity, official renderer digest, and Node distribution digest. Unsupported, mixed, or semver-identical-but-byte-different payloads fail before Host boot; upstream changes are absorbed by the compatibility package or documented as a changed architecture seam.
- **Decision invariant**: Both candidates use the same payload digest, scenario corpus, environment declaration, randomized run schedule, sample counts, and disabled developer tooling. Hard gates precede the memory-first lexicographic comparison, and no-selection is legitimate.

## Technical Context

**Language/Version**: TypeScript 6.0.3 on standard Node.js 24.17.x; Rust 1.93.0 for the Tauri candidate and native benchmark helpers  
**Primary Dependencies**: `@deepseek-ai/dsh` and `@deepseek-ai/dsh-web-app` 0.1.0-rc.6 exact; Electron 43.4.0; Tauri CLI 2.11.4 / API 2.11.1; React remains entirely upstream; Vitest 4.1.x; Playwright; Zod for desktop-owned persisted evidence only; Rust `serde`, `tokio`, and `tokio-tungstenite` for native proxying  
**Storage**: Existing DSH home remains authoritative; desktop-owned files are a payload lock, ephemeral owner-only runtime directory and non-secret overlay, redacted logs, parity inventory, raw benchmark JSONL, and derived decision reports  
**Testing**: Acceptance-test-first and TDD with Vitest unit/contract tests, real Node child-process integration tests, fixture DSH profile and third-party plugin, Playwright/Electron and WebDriver/tauri-driver UI smokes where supported, socket/process fault injection, and packaged-app macOS smoke tests  
**Target Platform**: macOS 13.5+ arm64 foundation, following the staged Node 24 floor; platform-neutral Node packages continuously checked on macOS, Linux, and Windows; later product missions add macOS x64 and production Windows/Linux packaging  
**Project Type**: Hybrid desktop monorepo containing shared TypeScript packages, two application shells, one Rust workspace, black-box fixtures, and benchmark tooling  
**Performance Goals**: input-to-next-paint p95 <= 50 ms and p99 < 100 ms under sustained streams; zero >= 250 ms main-loop stalls; request/ack control delivery p95 <= 100 ms; warm operational-prompt-ready p95 <= 1.5 s; cold operational-prompt-ready p95 <= 3 s  
**Constraints**: 100% pinned parity and no application-created TCP listener; complete attributable-process measurement using de-duplicated macOS physical footprint; Tauri replaces Electron only with at least 25% lower aggregate p95 footprint, no memory scenario more than 5% worse, and no response/startup budget miss or relative regression above 10%; no upstream patches or native DSH UI rewrite  
**Scale/Scope**: independently derived official Web inventory plus one ordinarily installed out-of-tree plugin; 100,000-event history; at least 30 randomized samples per launch class and enough per-interaction samples for p99 confidence intervals; idle, long-history, 20/60/200-frame-per-second streams, large tool output, cancel/approval, renderer reload, Host crash, and post-session-switch scenarios

## Charter Check

### Pre-research gate

| Charter rule | Plan response | Result |
|---|---|---|
| Exact official renderer and unchanged dynamic plugin support | Official assets and Host-composed boot manifest are proxied, never rebuilt into a desktop UI. | Pass |
| No upstream fork or patch-package | DSH is an exact dependency; the profile override and compatibility checks live only here. | Pass |
| Standard Node Host for native add-on compatibility | Host sidecar uses the bundled standard Node runtime, never Electron's embedded ABI. | Pass |
| No unauthenticated production listener | No TCP listener is opened by the application; the Unix socket lives in mode-0700 runtime storage and requires a per-launch token unknown to renderer code. | Pass |
| TDD and black-box integration | Each concern begins at a public process, protocol, or package boundary with a red test. | Pass |
| Whole-process performance evidence | Benchmark ownership and schema include every descendant process and environment identity. | Pass |
| Living documentation | Architecture, compatibility, security, quickstart, and decision records are acceptance artifacts. | Pass |

No charter exception is required.

### Post-design gate

The Phase 1 model and contracts preserve every pre-research result. Secrets are ephemeral, excluded from persisted entities, and tested with canaries. The private transport uses existing upstream HTTP/WebSocket semantics rather than a second business protocol. The generic renderer bootstrap is the only permitted compatibility exception and owns no DSH semantics. Candidate-specific code ends at the renderer proxy and process supervisor interfaces. No governance conflict remains.

## Project Structure

### Documentation for this mission

```text
kitty-specs/desktop-foundation-01M00X0T/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── desktop-control.openapi.yaml
│   ├── renderer-proxy.md
│   └── benchmark-result.schema.json
├── checklists/
│   └── requirements.md
└── tasks/
    └── WP*.md
```

### Source code at repository root

```text
apps/
├── electron/
│   ├── src/main/                 # Chromium baseline window, protocol proxy, supervisor adapter
│   ├── src/preload/              # narrow Fetch-stream, EventSource, and WebSocket bootstrap
│   └── tests/                    # candidate contract and packaged smoke tests
└── tauri/
    ├── src/                      # shell loading state only; official renderer arrives from payload
    └── src-tauri/
        ├── src/                  # Rust window, custom protocol, UDS WebSocket relay, supervisor
        └── tests/                # Rust proxy and lifecycle tests

packages/
├── compatibility/
│   ├── src/                      # supported set, fail-loud probes, versioned WebServer behavior declaration
│   └── tests/
├── payload/
│   ├── src/                      # deterministic staging and payload manifest/digest generation
│   └── tests/
├── profile-overlay/
│   ├── src/                      # ephemeral absolute-entry patch and Web-profile compatibility probe
│   └── tests/
├── desktop-webserver/
│   ├── src/                      # webServer-compatible UDS provider and authentication gate
│   └── tests/
├── desktop-surface/
│   ├── src/                      # Harness source plus truthful desktop-surface prompt context
│   └── tests/
├── host-launcher/
│   ├── src/                      # official-bin spawn spec, inherited capsule, identity fencing
│   └── tests/
├── renderer-proxy/
│   ├── src/                      # shell-neutral Fetch-stream, EventSource, and WebSocket compatibility surface
│   └── tests/
├── supervisor/
│   ├── src/                      # lifecycle state machine and platform process adapter contract
│   └── tests/
├── parity/
│   ├── src/                      # manifest-derived capability inventory and result comparator
│   └── tests/
├── benchmark/
│   ├── src/                      # raw sample validation, aggregation, thresholds, decision evaluator
│   └── tests/
└── test-support/
    ├── src/                      # deterministic Host/stream/fault fixtures and process helpers
    └── tests/

fixtures/
├── profiles/desktop-fixture/     # keyless replay profile
├── plugins/parity-probe/         # out-of-tree Host + browser contribution
└── histories/                    # bounded long-session and flood manifests

benchmarks/
├── scenarios/                    # declarative parity/performance scenarios
├── baselines/                    # reviewed reference-machine metadata and approved budgets
└── reports/                      # ignored raw local output; checked-in representative decisions

scripts/
├── verify-upstream-compat.ts
├── stage-payload.ts
├── audit-sockets.ts
├── audit-process-tree.ts
└── evaluate-shells.ts

docs/
├── architecture.md
├── compatibility.md
├── security.md
└── performance.md
```

**Structure Decision**: Keep the official Host composition and renderer outside candidate applications. Candidate folders contain only platform lifecycle, custom-protocol proxying, and the smallest preload/shim surface. Cross-candidate policies live in packages with public contracts. DSH-specific version knowledge, including the behavior lock for private upstream WebServer dispatcher semantics, is confined to `packages/compatibility`, `packages/profile-overlay`, and its paired `packages/desktop-webserver` implementation. Root workspace and lock files are established once before parallel candidate work; later work packages do not race on them.

## Implementation Concern Map

### IC-01 — Reproducible workspace and release inputs

- **Purpose**: Establish pinned Node, Rust, package-manager, lint, typecheck, coverage, and workspace rules before parallel implementation.
- **Relevant requirements**: FR-001, FR-009, NFR-012, C-001, C-002.
- **Affected surfaces**: root manifests and configs, CI workflows, `docs/architecture.md`.
- **Sequencing/depends-on**: none.
- **Risks**: Accidentally making the sibling upstream checkout part of this workspace would permit mutation and invalidate release reproducibility.

### IC-02 — Exact payload and compatibility set

- **Purpose**: Stage one coherent DSH family and standard Node runtime, generate content digests, and reject unknown or mixed versions before boot.
- **Relevant requirements**: FR-001, FR-009, FR-015, FR-017, NFR-010, C-003, C-005.
- **Affected surfaces**: `packages/compatibility`, `packages/payload`, `scripts/stage-payload.ts`, `docs/compatibility.md`.
- **Sequencing/depends-on**: IC-01.
- **Risks**: Upstream package manifests use family ranges; the desktop lock and installed-tree audit must prove the resolved family is exact rather than trusting ranges.

### IC-03 — Listenerless Web-profile overlay

- **Purpose**: Boot a compatibility-checked existing Web profile with an ephemeral absolute-entry overlay that disables the TCP row, inserts an authenticated Unix-domain-socket provider for the same service, disables false browser URL context, and inserts truthful desktop surface context.
- **Relevant requirements**: FR-002 through FR-005, FR-009 through FR-011, C-003 through C-005.
- **Affected surfaces**: `packages/profile-overlay`, `packages/desktop-webserver`, `packages/desktop-surface`, `fixtures/profiles`.
- **Sequencing/depends-on**: IC-01, IC-02.
- **Risks**: Upstream keeps its dispatcher private, so the external provider must reproduce and contract-lock every exact/prefix/longest-prefix match, upgrade, fallback, tap, per-request containment, backpressure, bind, and teardown obligation; authentication must strip its token from all request views before plugin dispatch; the upstream Host/Origin fence must remain effective; the overlay must not alter the selected profile, depend on a routable sentinel port, drop the Harness source section, or advertise an unreachable Web URL. A negative plugin that reads the sentinel port must fail with an actionable compatibility result rather than connect elsewhere.

### IC-04 — Sidecar supervision and lifecycle

- **Purpose**: Invoke the official built binary with a one-use inherited capsule, supervise one exact process generation, recover with bounded backoff, and tear down only the identity-fenced owned process group.
- **Relevant requirements**: FR-006 through FR-009, FR-15, FR-016, NFR-009, NFR-011.
- **Affected surfaces**: `packages/host-launcher`, `packages/supervisor`, platform adapters in both apps.
- **Sequencing/depends-on**: IC-01, IC-02, IC-03.
- **Risks**: Startup secrets must not reach argv, environment, stdout/stderr, logs, or renderer; quit/crash races must not create duplicate Host generations; a second launch for the same home/profile must focus the owned instance rather than race the durable store.

### IC-05 — Renderer resource and stream proxy

- **Purpose**: Present `dsh-app://localhost` for finite browser-managed resources and install pre-entry browser-compatible same-origin Fetch-stream, EventSource, and WebSocket adapters for arbitrary registered paths over the private sidecar socket.
- **Relevant requirements**: FR-002, FR-004, FR-005, FR-007, FR-011, FR-012, NFR-002 through NFR-005.
- **Affected surfaces**: `packages/renderer-proxy`, `contracts/renderer-proxy.md`, candidate protocol handlers and preloads.
- **Sequencing/depends-on**: IC-01, IC-03.
- **Risks**: Fetch body streaming, SSE parsing/retry/last-event-id, WebSocket backpressure, cancellation, header stripping, binary payloads, renderer reload, stream close ordering, secure-context APIs, storage, clipboard, download, attachment, and IME behavior can subtly diverge between Chromium and system WebView. Deleting the always-mounted HMR row is not an allowed workaround.

### IC-06 — Electron compatibility baseline

- **Purpose**: Deliver the first macOS vertical slice with stable Chromium, sandboxed renderer, custom protocol, exact Node sidecar, and no DSH workload in main.
- **Relevant requirements**: FR-001 through FR-008, FR-011 through FR-013, FR-018, NFR-001 through NFR-005, NFR-009, NFR-011.
- **Affected surfaces**: `apps/electron`, shared packages from IC-02 through IC-05.
- **Sequencing/depends-on**: IC-02, IC-03, IC-04, IC-05.
- **Risks**: Electron main must never block on payload or tool output and must not expose generic arbitrary IPC to renderer content.

### IC-07 — Tauri memory challenger

- **Purpose**: Deliver the same vertical slice over the macOS system WebView and Rust shell, with byte-identical payload and equivalent proxy/lifecycle behavior.
- **Relevant requirements**: Same as IC-06 plus NFR-008 and C-006 through C-008.
- **Affected surfaces**: `apps/tauri`, Rust workspace, shared packages from IC-02 through IC-05.
- **Sequencing/depends-on**: IC-02, IC-03, IC-04, IC-05.
- **Risks**: Custom-protocol origin behavior, WebSocket relay semantics, download/clipboard/IME behavior, and sidecar process-tree ownership differ from Electron and must be proven rather than assumed.

### IC-08 — Capability and plugin parity oracle

- **Purpose**: Generate the expected contribution inventory independently from the pinned package closure and profile patches, compare it with the live boot graph, drive reference scenarios, and compare browser baseline and candidate outcomes without candidate-specific allowances.
- **Relevant requirements**: FR-010 through FR-012, NFR-001, NFR-012, SC-001, SC-002.
- **Affected surfaces**: `packages/parity`, `fixtures/plugins/parity-probe`, `benchmarks/scenarios`, candidate acceptance tests.
- **Sequencing/depends-on**: IC-02; full candidate execution follows IC-06 and IC-07.
- **Risks**: A live-manifest-only inventory could omit a missing package and create a false pass; the negative-control fixture must prove the oracle rejects a removed or corrupted bundle.

### IC-09 — Performance evidence and deterministic shell decision

- **Purpose**: Measure all attributable shell, WebView, GPU/network/content, Host, and descendant processes under randomized identical scenarios, validate raw samples, enforce hard gates, and apply the memory-first lexicographic shell decision.
- **Relevant requirements**: FR-013, FR-014, NFR-002 through NFR-008, SC-003 through SC-006.
- **Affected surfaces**: `packages/benchmark`, `benchmarks`, audit scripts, `docs/performance.md`, final architecture decision.
- **Sequencing/depends-on**: IC-06, IC-07, IC-08.
- **Risks**: Thermal state, hidden developer tools, missing helper processes, or unequal payloads can make a precise-looking comparison invalid; invalid runs must be rejected before aggregation.

## Dependency and Parallelization Model

```text
IC-01
  ├── IC-02 ── IC-03 ──┬── IC-04 ──┬── IC-06 ──┐
  │                    └── IC-05 ──┤           ├── IC-09
  │                                └── IC-07 ──┘
  └────────── IC-08 (inventory/fixtures) ────────┘
```

After workspace contracts are stable, payload/compatibility, renderer proxy, and parity inventory can progress in separate lanes. Electron and Tauri integration can then proceed in parallel because candidate files do not overlap. Performance evaluation waits for both candidates and the parity oracle.

## Planned Test Layers

1. **Contract/unit**: payload manifest and closure integrity, installed-family audit, profile overlay, lifecycle reducer, token redaction, socket path ownership, URL/header mapping, Fetch streaming/abort, SSE parsing/reconnect, WebSocket behavior, inventory classifier plus negative control, statistics, confidence intervals, and decision thresholds.
2. **Node integration**: official built binary plus a supported real profile over an owner-only Unix socket, arbitrary HTTP/static/plugin requests and upgrade routes, generic RPC, HMR SSE, both downlink WebSockets, streaming Fetch, cancellation, renderer-style reconnect, SIGTERM, crash/retry with active subprocess, and orphan audit.
3. **Candidate integration**: identical protocol and stream conformance suite against Electron and Tauri shell adapters.
4. **Assembled parity**: independently expected and live official boot graphs, ordinarily installed fixture plugin, session create/resume, tools, terminal/diff, attachments, approvals/questions, settings/credentials, goals/plans/jobs/subagents/deliverables, export/download, renderer reload, Host recovery, and a corrupted-bundle negative control. The model response may be deterministic replay, but session, Host, transport, and interaction paths are real and never use the browser fixture carrier.
5. **Packaged smoke**: staged Node runtime plus DSH payload on a clean macOS user data directory, with socket and process audits.
6. **Performance**: randomized 30-run launch classes, per-interaction sustained-stream distributions, complete attributable-process census, de-duplicated macOS physical-footprint checkpoints, diagnostic RSS, and bootstrap confidence intervals; raw inputs are validated before aggregation.

## Requirement-to-Concern Coverage

| Requirement group | Owning concerns |
|---|---|
| FR-001 through FR-005 | IC-02, IC-03, IC-05, IC-06, IC-07 |
| FR-006 through FR-008 | IC-04, IC-06, IC-07 |
| FR-009, FR-015, FR-017 | IC-02, IC-03 |
| FR-010 through FR-012 | IC-02, IC-06, IC-07, IC-08 |
| FR-013, FR-014 | IC-09 |
| FR-016, FR-018 | IC-04, IC-06, IC-07 |
| NFR-001 | IC-08 with IC-06 and IC-07 |
| NFR-002 through NFR-006 | IC-05, IC-06, IC-07, IC-09 |
| NFR-007, NFR-008 | IC-09 |
| NFR-009 through NFR-011 | IC-02, IC-04, IC-09 |
| NFR-012 | IC-01, IC-06, IC-07, IC-08 |

All specification requirements have an owning implementation concern. Task generation must preserve this mapping and may split a concern only along non-overlapping file ownership.
