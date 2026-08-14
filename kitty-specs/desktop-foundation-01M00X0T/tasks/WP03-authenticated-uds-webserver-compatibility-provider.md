---
work_package_id: WP03
title: Authenticated UDS WebServer Compatibility Provider
dependencies:
- WP01
- WP02
requirement_refs:
- FR-004
- FR-005
- FR-015
- FR-016
- NFR-005
- NFR-011
- C-003
- C-010
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
agent: codex
history: []
agent_profile: node-norris
authoritative_surface: packages/desktop-webserver/
create_intent:
- docs/carrier-security.md
execution_mode: code_change
model: ''
owned_files:
- packages/desktop-webserver/src/**
- packages/desktop-webserver/tests/**
- packages/compatibility/src/webserver/**
- packages/compatibility/tests/webserver/**
- docs/carrier-security.md
role: implementer
tags: []
---

# Work Package Prompt: WP03 – Authenticated UDS WebServer Compatibility Provider

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Implement a version-locked, service-compatible replacement for the pinned DSH `webServer` provider that carries ordinary HTTP and upgrade traffic over an authenticated Unix-domain socket without opening an INET listener. Preserve upstream route behavior and request trust checks while keeping all DSH methods, payloads, session semantics, and the upstream same-process handler opaque.

## Context

The selected Web profile must keep registering its official index, boot manifest, plugin assets, generic API/RPC, EventSource, and WebSocket routes through the existing `webServer` service. Because upstream's dispatcher is private, this package reproduces only the pinned provider's structural registry and Node HTTP/upgrade dispatch behavior; compatibility declarations and black-box tests make drift fail before user work.

The provider receives a generation-scoped BootCapsule from an inherited file descriptor. It authenticates the private carrier, strips the capability token from every request view before dispatch, normalizes `Host` and `Origin` to loopback values so upstream trust policy remains active, and owns socket bind, backpressure, cancellation, and teardown. It must never expose or serialize upstream `inProcessHandler()` across the socket and must never create a TCP/INET listener.

Follow test-driven development for every subtask: add the smallest public-boundary test, run it and observe the intended failure, implement only enough to pass, then refactor with the focused suite green. Do not copy DSH business routes or special-case product paths.

Implementation command:

```sh
spec-kitty agent action implement WP03 --agent codex
```

### Subtask T012: Lock the pinned WebServer service and dispatcher behavior

**Purpose**: Define the exact compatibility surface that the external UDS provider must preserve and make upstream drift a fail-loud result rather than an accidental behavioral fork.

**Steps**:

1. Start with failing contract tests under `packages/compatibility/tests/webserver/` against an intentionally incomplete declaration.
2. Describe the pinned public service members: `host`, `port`, `register`, `registerUpgrade`, `registerFallback`, `tapIndex`, and `applyIndexTaps`.
3. Lock route behavior with black-box cases for exact-before-prefix matching, prefix segment boundaries, longest-prefix wins, duplicate registration failures, disposer symmetry, one fallback seat, and index taps in registration order.
4. Lock request/upgrade containment: malformed paths and rejected handlers cannot terminate the Host; HTTP failures return 400 unless headers already require destroying the response, and upgrade failures destroy only the affected socket.
5. Record that the provider owns upgraded sockets, closes ordinary and upgraded connections during disposal, and rejects traffic after teardown begins.
6. Export a compatibility probe keyed to the exact payload identity from WP02; unknown or changed behavior reports the failed seam and supported version before Host boot.
7. Explicitly exclude upstream private object references and `inProcessHandler()` from the declared socket surface. The carrier accepts HTTP bytes and upgrade frames only.
8. Run the focused test once before implementation to capture RED, then implement the declaration and rerun for GREEN.

**Files**:

- `packages/compatibility/src/webserver/declaration.ts` (new, about 100 lines)
- `packages/compatibility/src/webserver/probe.ts` (new, about 120 lines)
- `packages/compatibility/src/webserver/index.ts` (new, about 20 lines)
- `packages/compatibility/tests/webserver/declaration.spec.ts` (new, about 180 lines)

**Validation**:

- The complete pinned behavior fixture passes.
- Removing one service member or changing exact/prefix, fallback, tap, containment, or disposal behavior makes the compatibility probe fail with a named seam.
- No exported compatibility type contains a DSH business route, method, session projection, or same-process handler reference.

### Subtask T013: Build the short randomized owner-only UDS lifecycle

**Purpose**: Create and retire a private local carrier endpoint whose filesystem ownership is explicit, whose path fits macOS UDS limits, and whose bind path cannot become an INET listener.

**Steps**:

1. Write failing lifecycle tests using a real Node HTTP server and an isolated temporary runtime root.
2. Derive a short runtime directory from a bounded prefix plus cryptographically random bytes; never embed the full home, workspace, profile, or application path in the UDS pathname.
3. Create the directory with mode `0700`, reject symlinks and pre-existing non-owned entries, and verify ownership/permissions after creation rather than trusting the requested mode.
4. Generate a short per-generation socket filename and assert the encoded pathname stays below the supported macOS and Linux limits with margin.
5. Bind with the string socket path only. Guard the listen adapter so a numeric port, `{port: ...}`, host, or other INET form is rejected before `server.listen`.
6. Remove stale sockets only inside the validated generation directory; never unlink an arbitrary caller-provided path.
7. On stop or failed boot, close the server, wait for connection retirement, unlink the socket, and remove only the now-empty owned directory.
8. Add a negative test that instruments all provider listen calls and proves no IPv4 or IPv6 address is requested.

**Files**:

- `packages/desktop-webserver/src/runtime-directory.ts` (new, about 150 lines)
- `packages/desktop-webserver/src/socket-lifecycle.ts` (new, about 140 lines)
- `packages/desktop-webserver/tests/socket-lifecycle.spec.ts` (new, about 220 lines)

**Validation**:

- Real bind/connect/close succeeds over UDS and reports a string address.
- The runtime directory is exactly mode `0700`; path-length, symlink, collision, and unsafe-cleanup cases fail closed.
- Instrumented tests observe zero numeric-port or host-bearing listen calls and zero residual socket/runtime entries after teardown.

### Subtask T014: Consume the one-use capsule and enforce capability authentication

**Purpose**: Admit only the owning shell generation while ensuring the 256-bit token and socket path never enter argv, environment, logs, renderer-visible state, or plugin request objects.

**Steps**:

1. Begin with failing tests for truncated, oversized, repeated, stale-generation, wrong-digest, missing-token, and token-mismatch capsules and requests.
2. Read one bounded BootCapsule from the fixed inherited descriptor, require EOF after one value, validate generation and payload/profile digests, and close the descriptor on success or failure.
3. Require a 32-byte cryptographically random token and compare presented values without timing-dependent early exit.
4. Keep the decoded capsule in generation-local mutable state only until activation; overwrite token buffers and clear the raw capsule immediately afterward.
5. Authenticate before URL parsing, route matching, fallback selection, index taps, or upgrade handler lookup so unauthenticated input reaches no plugin-controlled code.
6. Remove `X-DSH-Desktop-Token` case-insensitively from `headers`, `rawHeaders`, `headersDistinct`, and any normalized/cached request view before invoking a handler; do not replace it with a marker.
7. Implement the shell-only authenticated health route from `contracts/desktop-control.openapi.yaml` without placing it in the plugin registry or exposing its secret to renderer JavaScript.
8. Seed canaries and assert they are absent from errors, logger calls, inspection output, argv/environment snapshots, response bodies, and handler-observed requests.

**Files**:

- `packages/desktop-webserver/src/boot-capsule.ts` (new, about 180 lines)
- `packages/desktop-webserver/src/authentication.ts` (new, about 150 lines)
- `packages/desktop-webserver/src/health.ts` (new, about 100 lines)
- `packages/desktop-webserver/tests/authentication.spec.ts` (new, about 260 lines)

**Validation**:

- Only the valid current-generation token reaches authenticated health or dispatch.
- Every plugin-visible request view is token-free, including mixed-case and duplicate raw headers.
- Canary scans find neither token nor socket path in persisted/printed surfaces; the inherited descriptor is consumed and closed exactly once.

### Subtask T015: Implement structurally compatible HTTP dispatch and flow control

**Purpose**: Provide the upstream `webServer` registration API and ordinary Node request/response lifecycle over UDS while keeping paths and bodies opaque and bounded.

**Steps**:

1. Write failing tests that register synthetic handlers through the public service and exercise real UDS HTTP requests.
2. Implement exact and prefix tables, exact precedence, segment-safe prefix matching, longest-prefix selection, duplicate rejection, and idempotent disposer behavior matching the pinned declaration.
3. Implement the single fallback seat, default 404 before fallback registration, fallback release, index taps in registration order, and tap disposal.
4. Preserve the original method, path/query, request body stream, response status, headers, and response stream; do not parse or branch on DSH JSON or known product paths.
5. Contain rejected/throwing handlers per request: log redacted metadata, return 400 if possible, otherwise destroy only that response, and prove a subsequent request still succeeds.
6. Respect Node stream backpressure in both directions, cap configured in-flight bytes/connections, and propagate client abort or half-close to the active handler without buffering whole bodies.
7. Normalize the authenticated request to `Host: localhost` and the approved loopback HTTP `Origin` only after rejecting renderer spoofing; retain upstream Host/Origin policy as a second gate.
8. Keep the sentinel `host`/`port` getters structurally compatible but non-routable; the actual server address remains private provider state.

**Files**:

- `packages/desktop-webserver/src/web-server.ts` (new, about 300 lines)
- `packages/desktop-webserver/src/http-dispatch.ts` (new, about 180 lines)
- `packages/desktop-webserver/src/index.ts` (new, about 40 lines)
- `packages/desktop-webserver/tests/http-dispatch.spec.ts` (new, about 320 lines)

**Validation**:

- Exact, prefix, longest-prefix, fallback, index, duplicate/disposer, default-404, and 400-containment cases match the compatibility declaration.
- Slow-reader, slow-writer, abort, oversized-buffer, and post-error requests demonstrate bounded state and correct cancellation.
- Tests prove arbitrary paths work with no business-specific switch and all listening remains UDS-only.

### Subtask T016: Implement upgrade dispatch, WebSocket flow control, and teardown

**Purpose**: Preserve arbitrary upstream HTTP upgrades and long-lived WebSockets without stale-generation delivery, unbounded queues, or leaked upgraded sockets.

**Steps**:

1. Start with failing real-socket tests for successful upgrade, duplicate registration, unknown path, malformed URL, synchronous throw, asynchronous rejection, peer abort, and provider stop.
2. Match upgrade routes by exact pathname only and pass the authenticated, token-stripped `IncomingMessage`, `Duplex`, and initial `head` bytes unchanged to the registered owner.
3. Attach an error guard before dispatch, track every accepted upgraded socket, and remove it exactly once on close.
4. Destroy unmatched or failed upgrades without taking down the HTTP server or another upgraded connection.
5. Preserve kernel/Node backpressure: pause reads when the downstream high-water mark is reached, resume only on drain, bound aggregate queued bytes, and prioritize close/cancel control over bulk frames.
6. Fence every connection by Host generation; stopping or replacing a generation rejects new upgrades, closes ordinary connections, destroys tracked upgraded sockets, and waits for close completion.
7. Exercise text/binary-like opaque frames, fragmentation-sized writes, half-close, cancellation, and slow consumers without parsing RFC 6455 application payloads.
8. Add an explicit API-level assertion that no socket-exposed method returns or invokes upstream `inProcessHandler()`; only Node HTTP/upgrade semantics cross the UDS.

**Files**:

- `packages/desktop-webserver/src/upgrade-dispatch.ts` (new, about 200 lines)
- `packages/desktop-webserver/src/connection-registry.ts` (new, about 140 lines)
- `packages/desktop-webserver/tests/upgrade-dispatch.spec.ts` (new, about 300 lines)

**Validation**:

- Upgrade route behavior and error containment match the pinned provider contract.
- Backpressure/cancel/half-close tests stay within declared byte ceilings and do not starve close control.
- Teardown leaves zero upgraded or ordinary sockets, late events cannot cross generations, and no same-process handler reference is reachable.

### Subtask T017: Prove trust normalization, port compatibility, and carrier security

**Purpose**: Close the compatibility and security gate with independent negative controls covering request trust, sentinel-port misuse, diagnostics, and the no-INET invariant.

**Steps**:

1. Add failing integration tests that send missing/invalid tokens, spoofed desktop-token headers, DNS-rebinding-style `Host` values, custom/non-loopback origins, duplicate headers, and direct socket attempts.
2. Prove the provider rejects unauthenticated requests before handlers and presents only normalized `Host: localhost` plus approved loopback HTTP `Origin` to authenticated handlers.
3. Audit the exact staged first-party package closure for supported `webServer.port` reads; allow only compatibility-declared presentation/bind sites disabled by the desktop overlay and fail every unknown read with package/file/symbol evidence.
4. Create a synthetic third-party port-reader plugin fixture under `packages/compatibility/tests/webserver/fixtures/`; verify its sentinel connect/read attempt produces an actionable incompatibility result rather than connecting elsewhere.
5. Run a real child-process carrier fixture through boot, HTTP, streaming response, upgrade, cancellation, and shutdown while instrumenting IPv4/IPv6 listener creation; assert no application-created INET listener at any phase.
6. Scan fixture diagnostics with seeded token, socket-path, prompt, and response canaries; retain only protocol version, generation, transport phase, component identity, and redacted error category.
7. Document the UDS permissions, inherited-FD secret path, authentication order, header stripping, Host/Origin normalization, sentinel-port policy, backpressure limits, teardown, and failure modes.
8. Run the complete WP03 suite twice: once against the supported declaration and once against a deliberately altered dispatcher fixture that must fail before normal work.

**Files**:

- `packages/compatibility/src/webserver/port-audit.ts` (new, about 160 lines)
- `packages/compatibility/tests/webserver/port-audit.spec.ts` (new, about 220 lines)
- `packages/compatibility/tests/webserver/fixtures/port-reader-plugin.ts` (new, about 70 lines)
- `packages/desktop-webserver/tests/carrier.integration.spec.ts` (new, about 300 lines)
- `docs/carrier-security.md` (new, about 180 lines)

**Validation**:

- Host/Origin spoofing and token failures never reach a registered handler; supported normalized requests still pass upstream trust checks.
- The supported first-party audit is clean, while the negative third-party fixture and altered dispatcher each fail with actionable compatibility evidence.
- Process/socket instrumentation records only the expected UDS, all canaries remain absent, and clean/failure teardown leaves no socket or secret-bearing artifact.

## Definition of Done

- [ ] T012–T017 each began with an observed failing focused test and ended with the relevant suite green.
- [ ] The provider is structurally compatible with the pinned `webServer` service and exact/prefix/longest-prefix/fallback/index/upgrade semantics.
- [ ] Per-request failures are contained with 400-or-destroy behavior and do not terminate the Host.
- [ ] The randomized UDS lives under a verified mode-`0700` owner-only directory and stays within path limits.
- [ ] No provider code path requests an IPv4 or IPv6 listener.
- [ ] The generation token is 256-bit, inherited by FD only, consumed once, cleared, and absent from argv, environment, logs, diagnostics, persistence, and renderer state.
- [ ] Authentication precedes dispatch and strips the token from every handler-visible request view.
- [ ] HTTP and upgraded connections implement bounded backpressure, cancellation, generation fencing, and complete teardown.
- [ ] Loopback Host/Origin normalization preserves rather than replaces upstream trust policy.
- [ ] First-party `webServer.port` use is audited and the negative third-party port fixture fails loudly.
- [ ] Neither the UDS service nor any exported bridge exposes upstream `inProcessHandler()` or DSH business semantics.
- [ ] `docs/carrier-security.md` matches the implemented behavior and tests.

## Risks

- **Private dispatcher drift**: Keep all version knowledge in compatibility declarations and reject a changed upstream provider before Host boot.
- **UDS pathname limits**: Use short random components and test byte length on every supported platform.
- **Header-view leakage**: Test Node's raw, normalized, duplicate, and distinct header views with mixed casing.
- **Backpressure deadlock**: Test simultaneous slow producers/consumers and reserve progress for cancel/close control.
- **Sentinel misuse**: Treat any undeclared first- or third-party `port` dependency as an incompatibility, never as a reason to open loopback TCP.
- **Teardown races**: Fence by generation, make cleanup idempotent, and await ordinary plus upgraded socket retirement.

## Reviewer Guidance

Review public behavior against the pinned upstream provider rather than internal code similarity. Verify that authentication occurs before all route and upgrade lookup, token removal covers every Node request representation, errors never include secrets, and every stream has explicit buffering and teardown rules. Look for any numeric `listen`, product-specific path branch, renderer-visible token/socket data, same-process handler exposure, or compatibility fallback that could silently weaken the no-TCP and fail-loud requirements.
