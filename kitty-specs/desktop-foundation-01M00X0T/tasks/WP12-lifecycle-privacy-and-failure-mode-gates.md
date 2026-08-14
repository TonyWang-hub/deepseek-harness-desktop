---
work_package_id: WP12
title: Lifecycle, Privacy, and Failure-Mode Gates
dependencies:
- WP09
- WP10
requirement_refs:
- FR-005
- FR-006
- FR-007
- FR-008
- FR-016
- NFR-005
- NFR-006
- NFR-007
- NFR-009
- NFR-011
- C-005
- C-007
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T065
- T066
- T067
- T068
- T069
- T070
agent: codex
history: []
agent_profile: debugger-debbie
authoritative_surface: tests/lifecycle/
create_intent:
- scripts/audit-sockets.ts
- scripts/audit-process-tree.ts
- docs/security.md
- docs/failure-modes.md
execution_mode: code_change
model: ''
owned_files:
- packages/lifecycle-contract/src/**
- packages/lifecycle-contract/tests/**
- tests/lifecycle/**
- tests/security/**
- scripts/audit-sockets.ts
- scripts/audit-process-tree.ts
- docs/security.md
- docs/failure-modes.md
role: investigator
tags: []
---

# WP12: Lifecycle, Privacy, and Failure-Mode Gates

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `debugger-debbie`
- **Role**: `investigator`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Build one candidate-neutral, test-first hard gate for lifecycle ownership, recovery, private carriage, durable-home preservation, and artifact privacy. Exercise Electron and Tauri through their public candidate adapters with the same matrix, fixtures, assertions, time budgets, and expected outcomes; candidate-specific skips, weakened assertions, or alternate evidence are failures.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP12 --agent codex
```

## Context

WP09 and WP10 supply packaged candidate adapters. WP05 remains the lifecycle-policy owner, WP06 owns renderer transport semantics, and WP08 supplies the real assembled Host fixture. WP12 owns independent destructive testing and release-gate evidence, not replacement supervisor or proxy behavior.

Use acceptance-test-first TDD throughout. For every matrix row, first retain a focused RED result against an omitted or deliberately broken behavior, implement only the shared oracle, fixture, or audit needed to observe the public result, then retain GREEN for both candidates without changing the assertion descriptor.

Keep all fault schedules deterministic with injected monotonic time, seeded randomness, bounded waits, and identity-fenced cleanup. Never diagnose ownership from executable names alone, and never permit a fault test to kill an unrelated Node or DSH process.

### Subtask T065: Define the shared lifecycle fault matrix and evidence contract

**Purpose**: Establish one immutable scenario and assertion vocabulary that proves both candidates face identical failure gates.

**Steps**:

1. RED: provide candidate-specific expected results or skip one candidate and require matrix validation to fail before launch.
2. Define typed scenario phases, fault triggers, expected lifecycle transitions, allowed recovery actions, terminal resource assertions, and redacted evidence fields.
3. Require the candidate factory to expose only launch, observe, fault, user-action, and teardown controls; keep DSH methods and state out of the test bridge.
4. Expand each scenario over `electron` and `tauri` from one descriptor and one assertion implementation, with byte-identical payload, profile, home, and replay fixture identities.
5. Reject missing rows, candidate conditionals, retries hidden by the runner, unbounded waits, unknown process attribution, or evidence without generation and process-start fencing.
6. GREEN: prove a known-good fake adapter passes both expansions and each seeded contract violation fails the same assertion for either candidate.

**Files**: `packages/lifecycle-contract/src/{fault-matrix,candidate-contract,evidence}.ts` and `packages/lifecycle-contract/tests/{fault-matrix,evidence}.test.ts` (new).

**Validation**: `corepack pnpm exec vitest run packages/lifecycle-contract/tests/fault-matrix.test.ts packages/lifecycle-contract/tests/evidence.test.ts` passes with identical assertion digests for both candidates.

### Subtask T066: Audit the whole attributable process set and every listener

**Purpose**: Prove private carriage and complete process ownership from operating-system observations rather than application declarations.

**Steps**:

1. RED: start an attributable child with an IPv4 listener, an IPv6 listener, or an omitted descendant and require the audit to identify the exact invalid run.
2. Census shell, renderer/WebView, GPU, network, Host, helper, tool, terminal, and other descendants by PID plus start time; correlate non-descendant WebView helpers explicitly.
3. Inspect the whole attributable process set for listening IPv4 and IPv6 sockets at boot, idle, active stream, Host recovery/restart, and shutdown quiescence.
4. Require zero application-created INET listeners, including wildcard, loopback, IPv4-mapped IPv6, remote-debugging, development-server, and transient restart listeners.
5. Snapshot owned process groups before and after each phase, detect duplicate Host generations and orphan descendants, and leave unrelated control processes untouched.
6. Emit only roles, opaque identities, phases, generations, counts, and result codes; exclude commands, paths, socket names, and environment values.

**Files**: `scripts/audit-sockets.ts`, `scripts/audit-process-tree.ts`, and `tests/security/{socket-audit,process-tree-audit}.test.ts` (new).

**Validation**: Focused audits fail every seeded IPv4/IPv6 or missing-process control and pass all boot, idle, stream, restart, and shutdown checkpoints for both candidates.

### Subtask T067: Inject Host and transport failures across the full lifecycle

**Purpose**: Verify generation invalidation, bounded recovery, and process-group cleanup under Host and carrier faults.

**Steps**:

1. RED: kill Host pre-ready, idle, mid-stream, mid-tool, and mid-persistence; also inject transport half-close, corrupt frame, and a bounded hang.
2. Assert each fault invalidates every exchange, socket, event, timer, and renderer observation fenced to the retired Host generation before replacement traffic is accepted.
3. Verify deterministic capped exponential backoff, bounded jitter, attempt and elapsed budgets, visible exhaustion, and no automatic crash loop after the budget ends.
4. Require old-group disappearance before allocating a replacement, a maximum concurrent Host count of one, and no orphan Host, tool, terminal, or subprocess group after quiescence.
5. Preserve committed durable state, never replay an externally effectful tool with an unknown result, and expose an explicit unknown-result warning when acknowledgement was interrupted.
6. GREEN: run every fault at every applicable phase for both candidate factories with the same transition, timing-bound, generation, warning, and cleanup assertions.

**Files**: `packages/lifecycle-contract/src/{host-faults,recovery-oracle}.ts`, its package tests, and `tests/lifecycle/host-failure-matrix.test.ts` (new).

**Validation**: Seeded schedules stay within declared bounds; all stale work is rejected; no scenario observes a crash loop, concurrent Host, duplicated side effect, or orphan process group.

### Subtask T068: Exercise renderer, native-shell, and operating-state failures

**Purpose**: Prove disposable renderers, ownership leases, and actionable recovery across shell and environment failures.

**Steps**:

1. RED: crash the renderer and native shell, launch a second instance, suspend and wake, go offline, deny disk access, exhaust writable storage, and hold the profile lock.
2. Require renderer recreation to keep the current healthy Host, retire old renderer state, resynchronize once from authoritative Host state, and duplicate no completed action.
3. On native-shell relaunch, fence stale lease and process identities before cleanup or adoption; never create a second Host or terminate an unrelated process.
4. Make the same-home/profile second instance focus the authenticated owner and exit without spawning; fail distinct unsafe ownership visibly.
5. On sleep/wake revalidate lease, process identity, health, timers, and generation before resuming; offline local operation must not invent a network listener or restart loop.
6. Turn disk, permission, and profile-lock failures into bounded phase-specific failure state with Retry, Reveal Log Location, and Safe Exit, without partial durable mutation.

**Files**: `packages/lifecycle-contract/src/{shell-faults,resync-oracle}.ts`, its package tests, and `tests/lifecycle/{renderer-native,operating-state}.test.ts` (new).

**Validation**: Both candidates resync exactly once, preserve ordered state, show unknown-result warnings where required, duplicate no side effect, and finish with one-or-zero owned Host as the scenario specifies.

### Subtask T069: Gate durable-home diffs and prohibited artifact content

**Purpose**: Protect clean and existing DSH homes while proving secrets and conversation content never persist in desktop artifacts.

**Steps**:

1. RED: seed unique credentials, auth tokens, socket/home paths, environment values, prompts, responses, and session canaries, then deliberately leak one into each artifact class.
2. Run clean-home and supported existing-home scenarios against the official browser baseline and derive one reviewed allowed-diff manifest for ordinary profile and session writes.
3. Compare path, type, mode, digest, symlink target, and deletion inventories; allow only baseline-equivalent durable changes and desktop-owned files outside DSH home.
4. Reject rewrites, deletion, silent migration, permission drift, partial persistence, or candidate-specific allowed diffs; reject newer unsupported durable schemas before Host work.
5. Byte-scan stdout, stderr, local logs, crash diagnostics, lifecycle evidence, benchmark inputs/reports, build metadata, package manifests, and packaged build artifacts.
6. Preserve useful allowlisted phase, version, generation, exit category, retry decision, and stable error-code diagnostics while excluding every seeded secret and prompt value.

**Files**: `tests/security/{artifact-privacy,home-diff}.test.ts`, `packages/lifecycle-contract/src/{artifact-scan,home-diff}.ts`, corresponding package tests, and `docs/security.md` (new).

**Validation**: Every leak control fails byte-for-byte; both candidates produce the same clean/existing-home allowed diffs and leave all logs, crash, benchmark, and build artifacts canary-clean.

### Subtask T070: Publish the aggregate failure-mode hard gate

**Purpose**: Make intentional exit and every destructive scenario converge on one reproducible release-blocking result.

**Steps**:

1. RED: omit a matrix row, weaken one candidate assertion, leave one process/socket/artifact, or restart after intentional exit and require a nonzero aggregate result.
2. Run T065–T069 in a fixed order for Electron and Tauri using the same scenario descriptor, assertion digest, time budgets, allowed-diff manifest, and privacy canaries.
3. During user quit or Safe Exit, suppress recovery, stop new work, cancel control and data streams, close renderer channels, terminate the identity-fenced Host group, remove runtime artifacts, then release the lease last.
4. Inject quit pre-ready, idle, mid-stream, mid-tool, mid-persistence, during backoff, and during renderer recreation; require idempotent reverse-order teardown after repeated exit requests.
5. Re-run process and IPv4/IPv6 audits after quiescence, require no owned process group or private carrier residue, and prove unrelated Node/DSH processes survive.
6. Document the complete matrix, generation rules, unknown-result warning, backoff/exhaustion, reverse teardown, home-diff policy, privacy scans, evidence fields, and exact commands.
7. GREEN: execute the aggregate gate twice from fresh fixture roots and require deterministic redacted evidence plus identical candidate assertions on both runs.

**Files**: `tests/lifecycle/{gate,intentional-exit}.test.ts`, `tests/security/gate.test.ts`, and `docs/failure-modes.md` (new).

**Validation**: `corepack pnpm exec vitest run packages/lifecycle-contract/tests tests/lifecycle tests/security` passes twice; any listener, leak, duplicate Host, stale event, repeated side effect, orphan, unauthorized home diff, or teardown-order violation blocks both candidates equally.

## Definition of Done

- [ ] T065–T070 each retain focused RED evidence and matching GREEN evidence for both candidates.
- [ ] Electron and Tauri consume one matrix and one assertion implementation with no skips or candidate-specific outcomes.
- [ ] Whole attributable process-set audits cover IPv4 and IPv6 listeners at boot, idle, stream, restart/recovery, and shutdown.
- [ ] Host death at every required phase plus half-close, corrupt-frame, and hang faults invalidates generations and recovers only within bounded policy.
- [ ] Renderer/native crashes, second launch, sleep/wake, offline, disk, permission, and profile-lock cases remain responsive and ownership-safe.
- [ ] No fault creates a crash loop, concurrent Host, duplicated external side effect, stale delivery, or orphan process group.
- [ ] Renderer recovery resynchronizes from Host authority and warns when an interrupted external action has an unknown result.
- [ ] Clean and existing-home inventories differ only by the shared reviewed baseline allowance.
- [ ] Seeded secrets and prompts are absent from logs, crash diagnostics, benchmark evidence, and build artifacts.
- [ ] Intentional exit suppresses restart and completes idempotent reverse-order teardown without harming unrelated processes.
- [ ] `docs/security.md` and `docs/failure-modes.md` match the tested gate, evidence, and operator commands.

## Reviewer Guidance

Review the shared matrix and externally observed evidence, not candidate implementation structure. Trace each fault from injection through generation retirement, user-visible state, process cleanup, privacy scan, and final gate result.

Reject candidate branches, incomplete process attribution, unbounded waits, broad process killing, hidden retries, content-bearing evidence, or any result that cannot be reproduced with the same assertions for Electron and Tauri.
