---
work_package_id: WP08
title: Deterministic Architecture Fixture and Carrier Gate
dependencies:
- WP03
- WP04
- WP05
- WP06
- WP07
requirement_refs:
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-010
- FR-011
- FR-012
- NFR-001
- NFR-005
- NFR-006
- NFR-009
- NFR-011
- NFR-012
- C-003
- C-004
- C-005
- C-006
- C-007
- C-010
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T041
- T042
- T043
- T044
- T045
- T046
agent: codex
history: []
agent_profile: implementer-ivan
authoritative_surface: tests/architecture/
create_intent:
- docs/architecture-gate.md
execution_mode: code_change
model: ''
owned_files:
- packages/test-support/src/**
- packages/test-support/tests/**
- fixtures/histories/**
- tests/architecture/**
- docs/architecture-gate.md
role: implementer
tags: []
---

# Work Package Prompt: WP08 – Deterministic Architecture Fixture and Carrier Gate

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Build the deterministic, keyless architecture-viability gate that exercises a real assembled DSH Host, official renderer, interactions, and unchanged plugins over the authenticated private carrier. Produce one immutable gate definition and evidence format that the Electron and Tauri lanes must consume unchanged; a candidate that cannot pass it is disqualified before broader parity or performance work.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP08 --agent codex
```

## Context

WP03 supplies the authenticated Unix-domain WebServer provider, WP04 supplies the canonical `desktop-fixture` profile and public-bin launch path, WP05 supplies generation-safe supervision, WP06 supplies browser-primitive conformance, and WP07 supplies the independently derived inventory and out-of-tree plugin. WP08 assembles those public surfaces without adding a candidate shell, a DSH business bridge, or a second fixture transport.

The fixture must start the staged standard Node runtime and official built `dsh` binary with the canonical profile and ephemeral overlay. Only deterministic model/provider output may be replayed. The Host, profile composition, session store, transport, renderer resources, plugin loading, interaction handling, cancellation, recovery, and persistence paths are real. Never use the browser `?fixture` query transport, a mock Host, direct session-state injection, or an in-process replacement for the public launch path.

Use acceptance-test-first TDD for T041–T046. Add the smallest black-box assertion at the public process, protocol, or renderer boundary, run it and retain the intended RED result, implement the minimum behavior, then retain the focused GREEN result. Do not weaken the gate with candidate flags, skips, alternate fixtures, path allowlists, or per-engine expectations.

### Subtask T041: Assemble the canonical real-Host fixture

**Purpose**: Create one deterministic fixture controller that boots the exact payload through the supported public entry and owns only test orchestration, replay input, and observable evidence.

**Steps**:

1. RED: launch an intentionally incomplete fixture and assert that the gate rejects any path that omits staged Node, the official public `dsh` bin, the WP04 overlay, or `fixtures/profiles/desktop-fixture/`.
2. Build an isolated fixture home from the canonical profile, deterministic settings, durable session seed, and versioned history manifests; seed time, ids, and scheduling, and record payload, profile, fixture, overlay, and history digests before work.
3. Start the real Host with the verified payload, public binary, inherited BootCapsule, authenticated health probe, and supervisor adapter; do not import an internal launcher or start a mock server.
4. Replay only model/provider responses while sending prompts, interactions, tool controls, and reconnects through the ordinary official client routes.
5. Explicitly reject URLs containing `?fixture`, fixture-only carrier headers, direct projection writes, and test hooks that bypass the Host connection or session log.
6. GREEN: run two isolated launches with the same seed and prove identical scenario order, observable state hashes, action counts, digests, and redacted trace identities.

**Files**:

- `packages/test-support/src/{fixture-home,fixture-host,deterministic-replay}.ts`, `packages/test-support/tests/fixture-host.integration.test.ts`, and `fixtures/histories/{architecture-session,stream-flood}.json` (new)

**Validation**:

- The real child identifies staged Node and the official `dsh` bin with matching authenticated health; a mock Host, internal launcher, noncanonical profile, direct state injection, or `?fixture` transport fails before scenarios.

### Subtask T042: Prove exact renderer and boot assets over authenticated UDS

**Purpose**: Verify that the private carrier serves the unmodified official application graph rather than a desktop-built substitute or partial asset copy.

**Steps**:

1. RED: request the official root through the authenticated UDS with one required asset removed and prove the gate names the missing inventory item.
2. Fetch the official index, capture the Host-composed boot manifest, and load its exact entry modules, styles, source maps where declared, and first-party dynamic plugin bundles through ordinary registered routes.
3. Compare renderer bytes and every manifest-referenced asset with the staged payload and WP07 expected inventory; the live manifest cannot redefine the expected denominator.
4. Prove authentication is shell-injected, rejected before dispatch when absent or wrong, and stripped from every handler-visible request view.
5. Exercise SPA fallback, cache/conditional/range behavior, content types, module resolution, and arbitrary queries over the UDS generation and normalized loopback trust headers, with no product-path branch, TCP fallback, or direct filesystem load.
6. GREEN: repeat the resource graph walk and require identical renderer, boot-graph, and asset digests with zero missing, extra, rewritten, or desktop-reimplemented entries.

**Files**:

- `packages/test-support/src/{asset-walker,boot-graph}.ts`, `packages/test-support/tests/official-assets.integration.test.ts`, and `tests/architecture/official-renderer.test.ts` (new)

**Validation**:

- Official index, boot manifest, and dynamic plugin assets arrive only through authenticated UDS and match staged bytes; corrupting one row or asset is a deterministic hard failure.

### Subtask T043: Exercise ordered streams, tools, and interactions

**Purpose**: Prove that the assembled Host and carrier preserve user-visible order and control semantics across the complete viability scenario.

**Steps**:

1. RED: run a fixture with a duplicated, dropped, or reordered event and require a failure that identifies the opaque scenario step and sequence position.
2. Create and resume a real session, stream assistant text in deterministic chunks, and drive an ordinary tool call through start, progress, result, and completion.
3. Exercise terminal output and input plus a rendered diff, preserving chunk order, binary-safe content, final transcript state, and tool terminal status.
4. Exercise an approval and an ask-user interaction through their official request and response paths; assert each accepted response reaches Host exactly once.
5. Issue cancellation during flood output, then steer the surviving session and resume it through the supported public flow without inventing a desktop control method.
6. Record sequence/action counts, final session/transcript digests, and control acknowledgements under slow-consumer and 20/60/200-frame-per-second variants with bounded queues and unstarved control traffic.
7. GREEN: require ordered completeness, equal final-state hashes, zero duplicate actions, and deterministic outcomes across repeated isolated homes.

**Files**:

- `packages/test-support/src/{scenario-runner,trace-assertions}.ts`, `packages/test-support/tests/scenario-runner.integration.test.ts`, and `tests/architecture/session-interactions.test.ts` (new)

**Validation**:

- Stream, tool, terminal, diff, approval, ask-user, cancel, steer, and resume follow one declared order and final-state digest; omission, Host bypass, or duplicate acknowledgement fails the command.

### Subtask T044: Prove renderer reload and Host restart resynchronization

**Purpose**: Demonstrate that renderer and Host generations recover independently while authoritative state prevents stale delivery and duplicate external actions.

**Steps**:

1. RED: inject a renderer reload during active streaming and a Host exit during an interaction, then show the incomplete harness duplicates or loses an action.
2. Retire the renderer generation while keeping the ready Host and durable session alive; close its Fetch, SSE, and WebSocket work and drop accounted late events.
3. Recreate the renderer, reload the exact boot graph, and resynchronize from authoritative Host/session state without replaying completed tool or interaction requests.
4. Crash the real Host with an active session and terminal/subprocess, then use WP05 bounded recovery and identity fencing to remove the old group before one replacement starts.
5. Reconnect once to the replacement generation, restore durable state, and refuse automatic replay for any tool whose external side effect may already have occurred.
6. Assert old-generation work never reaches replacements, then compare uninterrupted, renderer-reloaded, and Host-restarted runs by final state, completed-action ids, interaction outcomes, and generation trace.
7. GREEN: prove equal final states, one execution per accepted action, bounded restart count, and zero retained retired-generation work.

**Files**:

- `packages/test-support/src/{fault-controller,resync-oracle}.ts`, `packages/test-support/tests/resynchronization.integration.test.ts`, and `tests/architecture/recovery.test.ts` (new)

**Validation**:

- Renderer reload preserves Host without loss or duplication; Host restart retires the old group, starts at most one fenced generation, and never delivers or replays stale work.

### Subtask T045: Prove unchanged external plugin and arbitrary route viability

**Purpose**: Verify ordinary third-party installation, browser contribution loading, standard Node ABI compatibility, and generic route carriage before either candidate integrates the gate.

**Steps**:

1. RED: omit the WP07 out-of-tree plugin or one of its Host/browser contributions and require the independent inventory plus scenario oracle to fail.
2. Install the plugin through the canonical profile mechanism, not the staged first-party payload or candidate resources, and load its Host capability and dynamic browser module unchanged.
3. Build and load its minimal native-addon ABI smoke under the staged standard Node runtime; prove the addon is never loaded by Electron's embedded runtime or a Rust process.
4. Exercise custom streaming HTTP/EventSource and arbitrary WebSocket upgrade paths, including path/query, subprotocol, ordered text/binary frames, backpressure, ping/pong, close, and peer failure, without adding route names or schemas to production contracts.
5. Keep the official `/plugins/events` HMR EventSource connected, including chunk-split fields, id/retry state, reconnect, clean close, and no emitted rebuild case.
6. Disable, reload, and upgrade the ordinarily installed plugin; require contributions and routes to disappear/reappear according to the live profile while the independent expectation stays fixed.
7. GREEN: pass the unchanged plugin lifecycle, native ABI, HMR SSE, custom-route, and arbitrary-upgrade scenarios with no candidate-specific code.

**Files**:

- `packages/test-support/src/plugin-oracle.ts`, `packages/test-support/tests/plugin-routes.integration.test.ts`, and `tests/architecture/external-plugin.test.ts` (new)

**Validation**:

- Out-of-tree Host/browser contributions and native addon use ordinary installation and standard Node ABI; custom HTTP/EventSource, HMR SSE, and arbitrary WebSockets need no path allowlist or candidate branch.

### Subtask T046: Publish the immutable hard gate and redacted evidence

**Purpose**: Expose one deterministic command and evidence record that both shell candidates must consume byte-for-byte before implementation can be considered viable.

**Steps**:

1. RED: run the aggregate command with one missing scenario, changed fixture digest, candidate override, INET listener, or seeded secret and require a nonzero result.
2. Define `corepack pnpm run test:architecture` as the only aggregate WP08 entry; it runs T041–T045 in a fixed declared order with bounded timeouts and deterministic seeds.
3. Export a candidate-neutral gate descriptor containing fixture/scenario identities and adapter obligations. WP09 and WP10 may supply only their adapter factory; they may not copy, skip, reorder, edit, or override assertions.
4. Audit every attributable Host, tool child, test controller, and carrier process for IPv4 and IPv6 listeners at boot, asset load, stream, reload, recovery, idle, and shutdown; require zero application-created INET listeners.
5. Emit only approved digests, opaque ids, phases, generations, counts, result codes, and no-listener evidence; seed prohibited-value canaries and scan stdout, stderr, logs, traces, snapshots, and evidence byte-for-byte.
6. Document prerequisites, real-entry topology, deterministic replay limit, scenarios, digests, redaction, failures, candidate-consumption rule, and exact command.
7. GREEN: run the aggregate gate twice from fresh fixture homes and require identical digest/trace evidence, clean teardown, and no candidate escape hatch.

**Files**:

- `tests/architecture/{gate,evidence,socket-audit}.test.ts`, `packages/test-support/src/{gate,evidence}.ts`, `packages/test-support/tests/evidence.test.ts`, and `docs/architecture-gate.md` (new)

**Validation**:

- `corepack pnpm run test:architecture` passes twice with deterministic redacted evidence and no INET listener; missing behavior, digest drift, candidate conditionals, canaries, residue, or listeners fail it.

## Definition of Done

- [ ] T041–T046 each retain an observed focused RED command and the corresponding GREEN result.
- [ ] The fixture uses staged Node, the public built `dsh` binary, the canonical `desktop-fixture`, a real Host/session store, and only deterministic model/provider replay.
- [ ] No architecture path uses `?fixture`, a mock Host, direct projection injection, internal launcher import, or loopback carrier fallback.
- [ ] Exact official renderer, boot manifest, first-party assets, and dynamic plugin assets load through authenticated UDS and match independent identities.
- [ ] Streams, tools, terminal, diff, approval, ask-user, cancel, steer, and resume remain ordered, complete, bounded, and duplicate-free.
- [ ] Renderer reload and Host restart resynchronize from authoritative state with fenced generations and no repeated external action.
- [ ] The ordinarily installed out-of-tree plugin, custom routes, HMR SSE, arbitrary WebSocket, and native-addon ABI smoke pass unchanged.
- [ ] Socket audits find no application-created IPv4 or IPv6 listener in any phase.
- [ ] Evidence is deterministic, digest-based, traceable, and free of secrets, paths, prompts, responses, session content, argv, and environment values.
- [ ] WP09 and WP10 consume the same gate descriptor, fixtures, command, assertions, and expected results without skips or overrides.
- [ ] `docs/architecture-gate.md` describes the implemented command, topology, evidence, failures, and hard-gate consequence.
