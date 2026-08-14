---
work_package_id: WP05
title: Host Supervisor, Instance Lease, and Redacted Diagnostics
dependencies:
- WP01
- WP04
requirement_refs:
- FR-006
- FR-007
- FR-016
- FR-018
- NFR-009
- NFR-011
- C-005
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T023
- T024
- T025
- T026
- T027
- T028
agent: codex
history: []
agent_profile: node-norris
authoritative_surface: packages/supervisor/
create_intent:
- docs/lifecycle.md
execution_mode: code_change
model: ''
owned_files:
- packages/supervisor/src/**
- packages/supervisor/tests/**
- packages/diagnostics/src/**
- packages/diagnostics/tests/**
- docs/lifecycle.md
role: implementer
tags: []
---

# WP05: Host Supervisor, Instance Lease, and Redacted Diagnostics

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Implement the shell-neutral supervisor, instance lease, recovery policy, teardown discipline, and redacted diagnostics used by both desktop candidates. Guarantee one live Host generation per application instance, safe focus behavior for competing launches, bounded recovery, and useful failure UI state without exposing user or secret data.

Implement this work package with:

```sh
spec-kitty agent action implement WP05 --agent codex
```

## Context

WP01 supplies the frozen workspace and WP04 supplies the official Host launch plan and launcher seam. WP05 owns orchestration around that seam; candidate applications later adapt native window, focus, process, sleep/wake, and signal operations without duplicating policy.

The Host remains a standard Node process. Its one-use `BootCapsule` crosses a dedicated inherited file descriptor, never stdout, stderr, argv, or environment. Readiness comes from the authenticated health endpoint, and every signal is fenced by application instance id, generation id, PID, and process start time.

Use acceptance-test-first TDD for every subtask: add the smallest failing public-boundary test, record RED, implement the minimum behavior, then record GREEN and refactor only while focused tests remain green.

Keep lifecycle policy platform-neutral and make every deployment-varying timeout, retry limit, and jitter ratio an explicit validated configuration value.

Preserve these package boundaries:

- WP04 owns official-binary launch-plan construction; consume its public seam without duplicating it.
- `packages/supervisor` owns lifecycle decisions and process/lease adapter contracts.
- `packages/diagnostics` owns allowlisted event serialization and redaction.
- Candidate applications own native adapter implementations and loading-window rendering only.
- DSH remains authoritative for sessions, interactions, plugins, and durable user state.

### Subtask T023: Define lifecycle states, startup phases, and invariants

**Purpose**: Create one deterministic reducer that makes lifecycle races and the single-generation rule mechanically testable.

**Steps**:

1. Write failing table tests for `idle -> starting -> probing -> ready -> stopping -> stopped`, plus bounded `recovering` and terminal `failed` branches.
2. Define explicit startup phases for lease acquisition, payload/profile validation, runtime preparation, spawn, capsule transfer, health probing, profile settlement, and ready publication.
3. Model application instance id, monotonically increasing generation id, retry ordinal, expected-exit policy, failure category, and transition timestamps as immutable state.
4. Reject invalid transitions, stale events, a second live generation, readiness for mismatched identity, and recovery after intentional exit.
5. Inject clock and event sources so tests contain no wall-clock sleeps; expose a pure subscription surface for both shells.

**Files**: `packages/supervisor/src/{types,lifecycle-reducer,index}.ts` and `packages/supervisor/tests/lifecycle-reducer.test.ts` (new, about 500 lines total).

**Validation**: Transition tables cover every state/event pair; invalid and stale events fail closed; property-style sequences never observe more than one live Host generation.

### Subtask T024: Supervise one identity-fenced Host generation

**Purpose**: Connect the WP04 launcher to authenticated readiness and process-group ownership without treating application logs as control messages.

**Steps**:

1. Start failing integration tests with a real child fixture that records descriptor, PID, start time, process group, health replies, and exits.
2. Allocate the generation before spawn and send its `BootCapsule` once through the dedicated inherited FD; close the parent writer and reject truncation, reuse, or transfer through stdio/argv/env.
3. Treat stdout/stderr as untrusted log input only. Probe the authenticated health route and require matching instance, generation, PID, start time, payload/profile digests, and versions before ready.
4. Record PID, OS process start time, and process-group identity immediately after spawn; re-observe them before every SIGTERM or escalation.
5. Signal only the matching owned process group, reject stale/PID-reuse fixtures, and prove descendants are gone before another generation may start.

**Files**: `packages/supervisor/src/{generation-supervisor,health-probe,process-identity}.ts` and `packages/supervisor/tests/generation-supervisor.integration.test.ts` (new, about 650 lines total).

**Validation**: Valid capsule and health identity reach ready; mismatches never do; PID-reuse and stale-generation cases signal nothing; cleanup removes the complete owned group and leaves unrelated processes alive.

### Subtask T025: Enforce application and home/profile instance leases

**Purpose**: Ensure one Host per app instance and serialize ownership of each `(DSH_HOME, profile)` while making a second launch focus the owner.

**Steps**:

1. Write concurrent failing tests for two contenders, stale metadata, symlink-equivalent homes, spaces/CJK paths, different profiles, and owner death.
2. Derive an opaque lease key from canonical DSH home identity plus exact profile; never place the home path in diagnostics.
3. Acquire an owner-only file lock before Host creation and retain it through teardown. The winner publishes an owner-authenticated focus endpoint and non-secret instance identity.
4. Make the losing same-key launch request focus and exit without spawning. Permit a distinct profile only after the durable-store safety probe approves it; otherwise fail visibly.
5. Reclaim stale state only after PID+start-time fencing disproves ownership, and release the lease last during reverse-order teardown.

**Files**: `packages/supervisor/src/{instance-lease,focus-channel}.ts` and `packages/supervisor/tests/instance-lease.integration.test.ts` (new, about 550 lines total).

**Validation**: Contention produces one owner, one focus request, and one Host maximum; distinct-profile policy is explicit; stale cleanup never steals a live lease or exposes a home path.

### Subtask T026: Implement bounded recovery and intentional-exit suppression

**Purpose**: Recover unexpected Host failures predictably without restart storms, concurrent generations, or retries after user-directed exit.

**Steps**:

1. Begin with failing tests using injected monotonic time and deterministic randomness for attempt count, delay bounds, and total retry budget.
2. Implement capped exponential backoff with bounded jitter, maximum attempts, maximum elapsed budget, and explicit exhaustion state.
3. Classify spawn, capsule, probe, ready-process, transport half-close, and process-exit failures while preserving the failing startup phase.
4. Suppress automatic recovery for quit, safe exit, superseded generation, or other intentional-exit policy; explicit Retry starts a fresh approved cycle only after old-group cleanup.
5. On sleep pause retry timers; on wake revalidate lease, process identity, liveness, and health before resuming or recovering.

**Files**: `packages/supervisor/src/{recovery-policy,failure-classification}.ts` and `packages/supervisor/tests/recovery-policy.test.ts` (new, about 450 lines total).

**Validation**: Exact seeded schedules stay inside delay and budget bounds; exhaustion stops; intentional exits never restart; crash, sleep/wake, and half-close tests preserve a maximum Host count of one.

### Subtask T027: Make teardown and lifecycle races idempotent

**Purpose**: Retire every owned resource in reverse acquisition order across quit, crash, reload, and partially completed startup.

**Steps**:

1. Write failing fault-injection tests at every startup phase and every teardown boundary, including repeated stop calls.
2. Track acquired resources in an explicit disposer stack: health/probe streams, Host group, inherited descriptors, overlay/runtime artifacts, focus channel, then lease.
3. Stop new work, cancel timers/probes, request graceful SIGTERM, wait a bounded interval, identity-check before escalation, and await group disappearance before releasing artifacts.
4. Keep renderer reload independent: retire renderer-bound transport state while the existing ready Host and retry budget remain unchanged.
5. Cover Host crash with active descendants, app quit during backoff, sleep/wake during probing, transport half-close, and failures thrown by individual disposers.

**Files**: `packages/supervisor/src/{resource-stack,teardown}.ts` and `packages/supervisor/tests/teardown.integration.test.ts` (new, about 600 lines total).

**Validation**: Every injected path reaches a stable terminal state, disposers run once in reverse order, no owned descendants/artifacts remain, and unrelated processes/resources are untouched.

### Subtask T028: Produce redacted diagnostics and boot recovery state

**Purpose**: Give users actionable version, phase, transport, exit, and restart information plus safe recovery actions without retaining sensitive content.

**Steps**:

1. Start with failing canary tests spanning normal logs, child stdio, thrown errors, crash records, retry events, and serialized diagnostic reports.
2. Define allowlisted diagnostic events containing component/version, lifecycle phase, opaque instance/generation, transport state, exit category, retry decision/budget, and stable error code.
3. Exclude and canary-scan credentials, tokens, socket paths, prompts, responses, session content, secrets, unrestricted argv, and all environment values; bound and sanitize child-log fragments before sinks.
4. Implement a restrictive local log sink and reveal-log-location action without returning log content, token, socket path, or home path to renderer code.
5. Derive responsive boot UI state for starting, recovering, and failed phases; after failure expose only Retry, Reveal Log Location, and Safe Exit with correct enablement.
6. Document lifecycle states, lease/focus policy, identity fences, backoff parameters, intentional exits, reverse teardown, diagnostics fields, and shell adapter obligations.

**Files**: `packages/diagnostics/src/{events,redaction,writer,index}.ts`, corresponding tests, `packages/supervisor/src/boot-ui-state.ts`, its tests, and `docs/lifecycle.md` (new, about 900 lines total).

**Validation**: Useful version/phase/transport reports survive every fault fixture; seeded prohibited values are absent byte-for-byte from all artifacts; boot states expose exactly the three approved failure actions and remain usable before Host readiness.

## Definition of Done

- [ ] T023–T028 each have recorded RED and GREEN focused commands.
- [ ] Lifecycle transitions and startup phases are explicit, deterministic, and reject stale events.
- [ ] BootCapsule control uses one inherited FD only; stdio, argv, and environment never carry it.
- [ ] Generation, PID, start-time, instance, and process-group fencing protects every signal and restart.
- [ ] One app instance owns at most one Host; same home/profile contention focuses the owner.
- [ ] Recovery uses bounded exponential backoff, jitter, attempt/elapsed budgets, and intentional-exit suppression.
- [ ] Quit, crash, reload, sleep/wake, and half-close scenarios clean up in reverse order without orphans.
- [ ] Diagnostics are allowlisted, useful, and canary-clean; no prompt, response, secret, credential, or environment value persists.
- [ ] Boot UI state supports Retry, Reveal Log Location, and Safe Exit after failure.
- [ ] `docs/lifecycle.md` matches tested behavior and shell integration obligations.

## Risks

- **PID reuse or broad kill**: Require the full identity fence immediately before signaling the owned group.
- **Restart race**: Wait for old-group disappearance and retain the lease before allocating the next generation.
- **Sensitive child output**: Treat stdio as hostile, bounded input to an allowlisted redactor.
- **Sleep timing drift**: Use monotonic clocks and explicit suspend/resume semantics.
- **Cross-shell divergence**: Keep policy in shared reducers and platform behavior behind narrow adapters.

## Reviewer Guidance

Review invariants through fault tests, not happy-path structure. Trace every capsule byte, signal, retry, disposer, lease transition, and diagnostic field; reject any path that can duplicate Host, target an unfenced process, restart after intentional exit, leak content, or make candidate shells reimplement shared lifecycle policy.
