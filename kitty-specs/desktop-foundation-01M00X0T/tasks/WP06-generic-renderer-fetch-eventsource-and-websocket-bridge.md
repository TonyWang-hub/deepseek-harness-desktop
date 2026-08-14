---
work_package_id: WP06
title: Generic Renderer Fetch, EventSource, and WebSocket Bridge
dependencies:
- WP01
- WP03
requirement_refs:
- FR-002
- FR-004
- FR-005
- FR-007
- FR-011
- FR-012
- FR-016
- NFR-005
- NFR-006
- NFR-011
- C-004
- C-006
- C-010
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T029
- T030
- T031
- T032
- T033
- T034
agent: codex
history: []
agent_profile: node-norris
authoritative_surface: packages/renderer-proxy/
create_intent:
- docs/renderer-transport.md
execution_mode: code_change
model: ''
owned_files:
- packages/renderer-proxy/src/**
- packages/renderer-proxy/tests/**
- docs/renderer-transport.md
role: implementer
tags: []
---

# WP06: Generic Renderer Fetch, EventSource, and WebSocket Bridge

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Build the shell-neutral, pre-entry browser primitive provider for `dsh-app://localhost` and its exception-free conformance suite. It may reproduce generic resource, Fetch, EventSource, WebSocket, cancellation, and lifecycle behavior under C-010, but it must never name or duplicate a DSH business method, channel, session projection, interaction state, or product UI.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP06 --agent codex
```

## Context

WP03 provides the authenticated HTTP/upgrade carrier on a private Unix-domain socket. WP06 defines the renderer-facing semantics and the narrow shell-adapter interface; WP09 and WP10 later supply Electron and Tauri native implementations without changing this package's assertions.

Use acceptance-test-first TDD for every subtask. Add the focused test, run it and retain the expected RED result, implement the smallest generic behavior, then retain the GREEN command and result. The conformance source, fixtures, assertions, timing bounds, and expected results must be byte-identical for Electron and Tauri: no candidate branches, skips, allowlists, expected failures, alternate thresholds, or adapter-specific assertions.

The official renderer and every first- or third-party contribution remain opaque consumers. Same-origin traffic uses the private bridge; external HTTP, EventSource, and WebSocket traffic delegates to the saved native browser primitives and never receives the desktop token, socket path, generation internals, or native invocation capability.

No candidate integration file belongs to this work package; later shell lanes implement only the adapter contract proven here.

### Subtask T029: Define the generic adapter contract and shared conformance runner

**Purpose**: Establish one shell-neutral interface and one reusable test runner that both candidates must execute unchanged.

**Steps**:

1. RED: add contract tests for a deliberately incomplete adapter and prove the runner reports every missing resource, Fetch, EventSource, WebSocket, cancellation, generation, and queue operation.
2. Define opaque request, response-stream, socket-frame, lifecycle, and close/error records; brand exchange, socket, renderer-generation, and Host-generation identifiers.
3. Keep authentication out of every renderer-visible type. The adapter may request an authenticated native exchange, but no field may carry a token or UDS path.
4. Export `defineRendererProxyConformance(createCandidate)` from the package testkit. Candidate factories provide only generic bridge operations, native-delegation spies, reload controls, and fixture lifecycle.
5. Make the runner reject candidate capability flags and candidate-specific expectations. A display label may identify a failure report but may not alter execution.
6. Build an opaque carrier fixture on WP03 that can register arbitrary HTTP, infinite SSE, and RFC 6455 upgrade paths without importing DSH business code.
7. GREEN: run the runner against a minimal reference adapter, then mutate each required operation and prove the corresponding test fails.

**Files**:

- `packages/renderer-proxy/src/contracts.ts`, `src/conformance.ts`, and `src/index.ts` (new, about 260 lines total)
- `packages/renderer-proxy/tests/conformance-contract.test.ts` and `tests/fixtures/carrier.ts` (new, about 260 lines total)

**Validation**: `corepack pnpm --filter ./packages/renderer-proxy test -- conformance-contract` passes, and source inspection finds no `electron`, `tauri`, DSH method name, candidate skip, or token-valued renderer field.

### Subtask T030: Implement custom-origin resource and complete Fetch semantics

**Purpose**: Carry finite custom-origin resources and every browser-legal same-origin Fetch request without buffering streams or weakening Host trust checks.

**Steps**:

1. RED: parameterize `dsh-app://localhost` tests over GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, and an extension method accepted by `Request`; assert browser-forbidden methods fail as native Fetch does.
2. Cover root navigation, SPA fallback, boot manifest, modules, styles, images, range and conditional requests, arbitrary paths and queries, redirects, credentials modes, and request forms using URL, `Request`, and `Request` plus overrides.
3. Preserve permitted content, cache, range, cookie, and application headers, status/status text, response headers, and incremental response bytes. Exercise empty, text, binary, Blob, typed-array, and `ReadableStream` request bodies.
4. Strip renderer-supplied `Host`, `Origin`, authorization, connection/proxy, forwarding, and desktop-token headers. Require native code to set `Host: localhost`, normalize required `Origin` to `http://localhost`, and inject the token only after leaving renderer JavaScript.
5. Return a standards-compatible `Response` whose body honors pull backpressure and cancellation. Abort before dispatch, during upload, before headers, and during download; release every exchange exactly once.
6. Delegate non-application origins to the captured native Fetch unchanged and prove the private adapter and token injector are not called.
7. GREEN: pass the full matrix with chunk sizes of one byte, mixed binary chunks, slow producers/consumers, mid-stream failures, and Host-generation replacement.

**Files**:

- `packages/renderer-proxy/src/origin.ts`, `src/fetch.ts`, and `src/install.ts` (new, about 320 lines total)
- `packages/renderer-proxy/tests/resource-fetch-conformance.test.ts` (new, about 320 lines)

**Validation**: the focused suite proves all legal methods, headers, body forms, streaming, abort phases, Host/Origin normalization, external delegation, and absence of token material from renderer-observable requests.

### Subtask T031: Implement browser-compatible EventSource over streaming Fetch

**Purpose**: Preserve ordinary SSE behavior, including the always-mounted infinite `/plugins/events` stream, without a route-specific bridge.

**Steps**:

1. RED: test `url`, `withCredentials`, static and instance state constants, `readyState`, `open`, `message`, named events, `error`, listener methods, `on*` handlers, and idempotent `close()`.
2. Parse UTF-8 with BOM, LF/CRLF/CR boundaries, comments, empty fields, multiline `data`, named `event`, `id`, and numeric `retry` split at every possible byte boundary; reject NUL ids and invalid retry values per browser behavior.
3. Keep `/plugins/events` connected as an infinite response even when it emits no rebuild event. Prove it is incremental, bounded, cancellable, and never converted into a finite custom-protocol body.
4. On EOF or recoverable failure, emit the correct error transition, wait the bounded retry, reconnect once, and send the last event id using the normalized same-origin request path.
5. Ensure `close()`, renderer retirement, and Host-generation change cancel reads and timers. A retired renderer may not reconnect or receive a late event.
6. Delegate external EventSource construction to the captured native implementation without private headers, token injection, or UDS access.
7. GREEN: run chunk-split, reconnect, clean-close, reload, empty-infinite-stream, and malformed-input cases with fake time and bounded real-carrier smoke coverage.

**Files**:

- `packages/renderer-proxy/src/event-source.ts` (new, about 260 lines)
- `packages/renderer-proxy/tests/event-source-conformance.test.ts` (new, about 300 lines)

**Validation**: the focused suite keeps `/plugins/events` alive, preserves last-event-id and retry behavior, bounds every timer/buffer, and leaves no work after close or renderer reload.

### Subtask T032: Implement the generic same-origin WebSocket bridge

**Purpose**: Provide browser-compatible WebSocket behavior for every same-origin upgrade route while leaving frames and subprotocols opaque.

**Steps**:

1. RED: cover arbitrary loopback path/query values, `ws:` and `wss:` mapping, protocol lists and negotiation, constants, `url`, `protocol`, `extensions`, `readyState`, `binaryType`, and event/listener APIs.
2. Test ordered text plus ArrayBuffer, typed-array, DataView, and Blob sends; test text and binary receives, fragmented frames, ping/pong, and direction sequence checks without parsing payload JSON.
3. Implement open, message, error, and close ordering; validate close codes/reason lengths; preserve code, reason, clean flag, peer/local initiation, handshake rejection, abrupt EOF, and half-close behavior.
4. Implement browser-compatible `bufferedAmount`: increment on accepted send bytes, decrease only after native acknowledgement, retain the observable count after close, and reject sends in invalid states as the native browser does.
5. Bound per-socket and aggregate queues. Pause upstream reads or reject sends deterministically at limits; never drop accepted frames, reorder them, or grow memory without a ceiling.
6. On renderer reload, atomically retire its sockets, drop and account for late events, release queues, and let the replacement renderer create fresh connections without duplicating completed actions.
7. Delegate external `ws:`/`wss:` URLs to the saved native WebSocket constructor with original protocols and prove no desktop token, normalized Host/Origin, socket path, or bridge call is added.
8. GREEN: pass arbitrary-path, subprotocol, text/binary, close/error, `bufferedAmount`, bounded-queue, external-delegation, and reload tests against the reference adapter.

**Files**:

- `packages/renderer-proxy/src/web-socket.ts` and `src/bounded-queue.ts` (new, about 420 lines total)
- `packages/renderer-proxy/tests/web-socket-conformance.test.ts` (new, about 380 lines)

**Validation**: the focused suite proves generic upgrade carriage and browser-observable behavior without path names, JSON decoding, candidate exceptions, unbounded queues, or token exposure.

### Subtask T033: Enforce lifecycle fencing, backpressure, and control-lane priority

**Purpose**: Keep heavy streams bounded and ordered while close, abort, approval, ask-user, and cancellation traffic remains prompt.

**Steps**:

1. RED: flood Fetch, SSE, and multiple WebSockets at 20, 60, and 200 frames per second while a slow renderer creates pressure; assert accepted sequence completeness and final-state equality.
2. Use shared byte-accounting limits for request uploads, response streams, sockets, each renderer, and the aggregate bridge. Reject invalid configuration before installation.
3. Reserve a bounded control lane for generic abort, close, acknowledgement, and lifecycle records. It must preempt bulk data without reordering data within an exchange.
4. Measure request/ack control delivery at p95 <= 100 ms under the highest load and assert no task monopolizes the event loop for 250 ms or longer.
5. Fence every callback by renderer and Host generation. Host replacement fails active exchanges/sockets once; renderer replacement releases retired state after quiescence; stale frames are counted but never delivered.
6. Seed token, prompt, response, and session-content canaries; assert errors and diagnostics contain only generic operation ids, generations, state, byte counts, and stable error codes.
7. GREEN: pass deterministic scheduler tests for abort/close races, slow consumers, producer overrun, reload, Host restart, and teardown with zero retained queues or timers.

**Files**:

- `packages/renderer-proxy/src/scheduler.ts`, `src/lifecycle.ts`, and `src/errors.ts` (new, about 340 lines total)
- `packages/renderer-proxy/tests/backpressure-lifecycle.test.ts` (new, about 340 lines)

**Validation**: stress results preserve order and accepted bytes, meet the control-latency bound, release retired state, and contain none of the seeded secrets or user content.

### Subtask T034: Lock candidate-neutral parity scenarios and transport documentation

**Purpose**: Make the shared suite the mandatory transport gate for Electron, Tauri, official resources, and unchanged third-party routes.

**Steps**:

1. RED: add an end-to-end conformance composition that registers an opaque third-party streaming HTTP route, infinite EventSource route, and arbitrary upgrade route through WP03; prove omission or path special-casing fails.
2. Cover official index/manifest/module resources and assert downstream candidate runs use identical payload and fixture digests. FR-011, FR-012, and C-006 permit no per-candidate fixture or expectation changes.
3. Specify that WP09 and WP10 each call the same exported `defineRendererProxyConformance` with only their adapter factory. Any skip, candidate conditional, threshold override, or copied suite is a gate failure.
4. Add packaged-engine expectation probes for secure origin and CSP, local/session storage, clipboard read/write mediation, attachment selection, download/export disposition and filenames, terminal keyboard/paste/input, IME composition, and renderer reload.
5. Treat clipboard, attachment, download, and terminal probes as browser-observable expectations, not new bridge business APIs. Candidate platform integration may satisfy them only through standard engine/shell facilities.
6. Document origin mapping, native delegation, shell-only token injection, allowed headers, stream limits, lifecycle fencing, external networking, and the prohibition on business channels/state/UI.
7. GREEN: run the shared package suite and a reference end-to-end carrier; record the exact commands that WP09 and WP10 must invoke unchanged.

**Files**:

- `packages/renderer-proxy/tests/third-party-routes.test.ts` and `tests/platform-expectations.ts` (new, about 300 lines total)
- `docs/renderer-transport.md` (new, about 180 lines)

**Validation**: the same suite covers third-party HTTP/EventSource/upgrade traffic and the CSP, storage, clipboard, download, attachment, terminal, IME, reload, payload-digest, and fixture-digest expectations for both candidates without an exception mechanism.

## Definition of Done

- [ ] T029–T034 each have retained RED and GREEN evidence from focused tests.
- [ ] `dsh-app://localhost` resources and same-origin Fetch preserve all browser-legal methods, headers, bodies, streaming, backpressure, errors, and abort phases.
- [ ] `/plugins/events` remains an infinite, reconnecting, last-event-id-aware SSE stream.
- [ ] Same-origin WebSocket supports arbitrary paths, text/binary data, subprotocols, close/error behavior, `bufferedAmount`, bounded queues, and reload; external WebSockets delegate natively without a token.
- [ ] Native mapping normalizes `Host`/`Origin`, while renderer code never observes the token or UDS path.
- [ ] Control traffic retains priority under flood load and retired renderer/Host generations retain no live work.
- [ ] The unchanged third-party HTTP, EventSource, and upgrade fixture passes the same candidate-neutral suite.
- [ ] The package exports generic browser primitives only; it owns no DSH business channel, product state, interaction semantics, or UI.
- [ ] `corepack pnpm --filter ./packages/renderer-proxy test` and its package typecheck pass.

## Risks

- Browser engines differ at obscure Fetch, EventSource, and WebSocket edges. Encode browser-observable outcomes in the shared suite and disqualify a candidate that cannot meet them; do not add candidate exceptions.
- A JavaScript queue can hide native backpressure. Count queued bytes at every handoff, acknowledge native writes, and test slow consumers with low deterministic ceilings.
- A generic primitive can drift into a product protocol. Reject path dispatch tables, DSH payload decoding, session projections, and business-named bridge operations in review.

## Reviewer Guidance

Review the conformance runner before implementation details: Electron and Tauri must be able to import the exact same suite with no branching or waiver surface. Trace one resource, Fetch stream, `/plugins/events` reconnect, same-origin WebSocket, external WebSocket, abort, reload, and flood-control case end to end; confirm Host/Origin normalization and token injection occur only in shell-native code. Reject any shortcut that removes an official route, buffers an infinite body, exposes unrestricted native invocation, or adds a DSH-specific method, state store, or UI.
