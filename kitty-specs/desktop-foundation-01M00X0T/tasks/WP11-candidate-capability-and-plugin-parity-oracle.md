---
work_package_id: WP11
title: Candidate Capability and Plugin Parity Oracle
dependencies:
- WP09
- WP10
requirement_refs:
- FR-002
- FR-003
- FR-007
- FR-008
- FR-010
- FR-011
- FR-012
- NFR-001
- NFR-007
- NFR-010
- NFR-012
- C-003
- C-004
- C-005
- C-006
- C-007
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T059
- T060
- T061
- T062
- T063
- T064
agent: codex
history: []
agent_profile: reviewer-renata
authoritative_surface: tests/parity/
create_intent:
- docs/parity.md
execution_mode: code_change
model: ''
owned_files:
- tests/parity/**
- benchmarks/scenarios/parity/**
- docs/parity.md
role: reviewer
tags: []
---

# WP11: Candidate Capability and Plugin Parity Oracle

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `reviewer-renata`
- **Role**: `reviewer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Build the disqualifying capability and plugin parity oracle for the official browser baseline, Electron, and Tauri. Run WP07's independently generated expected inventory unchanged against each live boot graph and complete reference flow; a live or candidate-declared manifest is observation only and can never define, shrink, classify, or excuse the expected set.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP11 --agent codex
```

## Context

WP09 and WP10 provide candidate launch adapters. WP07 owns the expected inventory and unchanged plugin fixture; WP08 owns the real Host fixture. This package may select a launch adapter by opaque candidate id, but it must share expectations, scenarios, assertions, digest rules, and report logic.

Use acceptance-test-first TDD for every subtask. Retain the focused RED command and observed failure, implement only the oracle behavior needed for GREEN, then retain the matching GREEN result. Do not add candidate allowances, skips, desktop-owned product behavior, or a second expected inventory.

### Subtask T059: Lock independent expectations and the browser baseline

**Purpose**: Establish the independently generated WP07 inventory and official browser run as immutable oracle inputs before candidate comparison.

**Steps**:

1. RED: omit one closure-declared contribution from a self-declared live manifest and prove the harness rejects the manifest as an expectation source instead of accepting its smaller denominator.
2. Load WP07's canonical expected inventory, requirement map, plugin-fixture identity, scenario-corpus identity, and negative-control identity from explicit digest-addressed inputs.
3. Verify schema versions and payload, profile, renderer, inventory, fixture, and scenario digests before starting the browser baseline; reject absent or mismatched identity.
4. Boot the official browser application with the staged payload, real profile, Host, session store, and deterministic provider replay, never the browser `?fixture` carrier.
5. Capture the live boot graph as observation and compare every expected stable id, entry digest, contribution kind, activation check, and unexpected row without mutating expectations.
6. GREEN: repeat from two clean homes and require identical expected-set digest, baseline observation digest, ordered diagnostics, and complete activation results.

**Files**:

- `tests/parity/{oracle-input,browser-baseline,live-boot-graph}.test.ts`
- `benchmarks/scenarios/parity/inventory-baseline.json`

**Validation**: `corepack pnpm exec vitest run tests/parity/oracle-input.test.ts tests/parity/browser-baseline.test.ts tests/parity/live-boot-graph.test.ts` passes, while a live-manifest denominator fails.

### Subtask T060: Compare Electron and Tauri live boot graphs

**Purpose**: Apply one expected inventory and baseline interpretation to both candidate boot graphs with no shell-specific allowance.

**Steps**:

1. RED: give one candidate a changed payload or fixture digest and another a missing boot row; require identity failure and exact missing-item failure before parity can pass.
2. Invoke the WP09 Electron and WP10 Tauri launch adapters through one candidate-neutral runner; candidate identity may select launch mechanics only.
3. Require browser, Electron, and Tauri runs to report matching payload, profile, renderer, expected-inventory, plugin-fixture, and scenario-corpus digests.
4. Capture each Host-composed live boot graph after settlement and compare it directly with the unchanged WP07 expected set, not with the browser observation or the other candidate.
5. Compare activation outcomes with the browser baseline while preserving missing, unexpected, digest-mismatched, degraded, skipped, and desktop-reimplemented statuses.
6. Prohibit candidate branches in expected items, checks, thresholds, normalization, result interpretation, and failure severity.
7. GREEN: randomize candidate execution order and require the same per-item outcomes, failure codes, and canonical comparison digest.

**Files**:

- `tests/parity/{candidate-runner,candidate-boot-graphs,digest-identity}.test.ts`
- `benchmarks/scenarios/parity/candidate-boot-graphs.json`

**Validation**: `corepack pnpm exec vitest run tests/parity/candidate-runner.test.ts tests/parity/candidate-boot-graphs.test.ts tests/parity/digest-identity.test.ts` passes for matching inputs and rejects either candidate's drift.

### Subtask T061: Prove unchanged external-plugin lifecycle and routes

**Purpose**: Match ordinary plugin install, use, unload, reload, and upgrade behavior across the baseline and both candidates without a desktop-specific package or route.

**Steps**:

1. RED: skip one lifecycle transition or substitute a candidate-owned client contribution and require the scenario and inventory item to fail.
2. Install the exact packed WP07 plugin through the ordinary profile mechanism in clean browser, Electron, and Tauri homes; verify archive and installed-tree digests match.
3. Use its Host contribution and dynamic client UI through public DSH surfaces, then exercise its streaming HTTP, EventSource, RPC/stream, and text/binary WebSocket upgrade routes.
4. Unload and uninstall it, proving Host effects, client UI, routes, streams, sockets, listeners, and timers disappear while official capabilities remain usable.
5. Reload it once and require one replacement generation, no duplicate action, retired old streams, and baseline-matching observable state.
6. Upgrade version one to version two through the ordinary mechanism; reject mixed closures, stale assets, old route results, or shell-specific metadata.
7. GREEN: require matching lifecycle order, Host/client results, custom-route bytes, close behavior, native-addon identity, and final digests in all three environments.

**Files**:

- `tests/parity/{external-plugin,plugin-lifecycle,plugin-routes}.test.ts`
- `benchmarks/scenarios/parity/external-plugin-lifecycle.json`

**Validation**: `corepack pnpm exec vitest run tests/parity/external-plugin.test.ts tests/parity/plugin-lifecycle.test.ts tests/parity/plugin-routes.test.ts` passes with the fixture bytes unchanged.

### Subtask T062: Exercise the complete official user-flow corpus

**Purpose**: Prove that inventory activation corresponds to complete official behavior rather than module presence alone.

**Steps**:

1. RED: remove one required flow or replace it with direct state injection; require corpus coverage and provenance validation to fail.
2. Drive settings, credential references, model selection, preset selection, session creation, session resume, and attachment selection through official public UI and Host paths.
3. Exercise streamed responses, tools, diff, terminal input/output, approval, ask-user, plan, goals, jobs, subagent, and deliverables through the real session and interaction pipeline.
4. Record baseline and candidate observable outputs as typed results, stable action counts, transcript/state digests, contribution ids, and interaction outcomes without recording user content.
5. Require every flow to map to its WP07 inventory item and requirement; unknown, unmapped, skipped, or partially observed flows fail the run.
6. Keep deterministic replay limited to model/provider output. Do not mock Host, inject projections, call candidate business bridges, or replace official UI.
7. GREEN: run the full corpus in all environments and require baseline-equivalent outcomes with deterministic ordering and no candidate-specific assertion.

**Files**:

- `tests/parity/{official-flows,flow-coverage,observable-results}.test.ts`
- `benchmarks/scenarios/parity/official-user-flows.json`

**Validation**: `corepack pnpm exec vitest run tests/parity/official-flows.test.ts tests/parity/flow-coverage.test.ts tests/parity/observable-results.test.ts` passes only with every declared flow complete.

### Subtask T063: Verify existing-home diffs and renderer reload

**Purpose**: Preserve existing DSH homes and prove renderer recreation converges on authoritative Host state without duplicated actions.

**Steps**:

1. RED: add a candidate-only durable write and duplicate one completed action after reload; require the filesystem and action-count oracles to identify both differences.
2. Snapshot a supported existing home before each run with normalized relative paths, metadata, content digests, profile/plugin inventory, durable schema facts, and resumable session ids.
3. Execute the same official baseline and candidate flows, then compare each after-state with its before-state and the browser baseline's allowed writes.
4. Permit only baseline-equivalent profile and session changes; reject candidate metadata, migration, rewrite, deletion, permission drift, or changed unrelated credentials/settings files.
5. Reload the renderer during active streaming and pending tool, terminal, approval, and ask-user work while preserving one Host and retiring old renderer exchanges.
6. Compare uninterrupted and reloaded final-state digest, transcript digest, accepted event count, user-action count, tool-effect count, and interaction-resolution count.
7. GREEN: repeat existing-home and reload cases for both candidates with identical allowed-diff classifications and exact final-state/action counts.

**Files**:

- `tests/parity/{existing-home,allowed-diff,renderer-reload}.test.ts`
- `benchmarks/scenarios/parity/{existing-home,renderer-reload}.json`

**Validation**: `corepack pnpm exec vitest run tests/parity/existing-home.test.ts tests/parity/allowed-diff.test.ts tests/parity/renderer-reload.test.ts` passes and any candidate-only write or duplicate action fails.

### Subtask T064: Enforce negative controls and publish the parity report

**Purpose**: Make false passes impossible and emit one deterministic candidate-neutral release-gate report.

**Steps**:

1. RED: force one expected item into each of missing, degraded, skipped, and desktop-reimplemented states and prove every state disqualifies the affected candidate.
2. Run WP07's removed-bundle and corrupted-bundle controls against the unchanged expected inventory; an absent, skipped, wrong-item, or unexpectedly passing control invalidates the run.
3. Add observation-layer controls for suppressed activation, incomplete flow, altered plugin bytes, payload/fixture digest mismatch, and candidate-specific expected-result overrides.
4. Define one report schema containing immutable input digests, the expected set once, baseline and candidate observations, flow and plugin evidence, existing-home/reload results, controls, and per-item status.
5. Treat candidate ids as metadata only. Sort all records canonically and exclude machine paths, timestamps, secrets, user content, and candidate-dependent normalization from report identity.
6. Expose `corepack pnpm run test:parity` as the aggregate command with fixed scenarios, assertions, controls, and failure severity for browser, Electron, and Tauri.
7. GREEN: run twice from clean homes in randomized candidate order and require the same candidate-neutral report digest, zero non-pass items, and all controls observed failing as designed.

**Files**:

- `tests/parity/{negative-controls,report,parity-gate}.test.ts`
- `benchmarks/scenarios/parity/negative-controls.json`
- `docs/parity.md`

**Validation**: `corepack pnpm run test:parity` passes only for matching digests, complete controls, unchanged plugin behavior, full flows, and zero missing, degraded, skipped, or desktop-reimplemented items.

## Definition of Done

- [ ] T059–T064 each retain focused RED and GREEN commands and results.
- [ ] WP07's independently generated expected inventory remains the sole denominator for every live boot graph.
- [ ] Browser, Electron, and Tauri use matching payload and fixture identities, scenarios, assertions, and failure rules.
- [ ] The unchanged external plugin passes install, use, unload, reload, upgrade, Host/client, custom-route, and native-addon checks.
- [ ] Every declared official user flow passes through real Host, session, interaction, and renderer paths.
- [ ] Existing-home changes match the browser allowed-diff oracle, and renderer reload preserves exact final state and action counts.
- [ ] Required negative controls fail for missing, degraded, skipped, desktop-reimplemented, removed, corrupted, and digest-mismatched evidence.
- [ ] `docs/parity.md` documents the aggregate command, evidence, failure policy, and candidate-neutral report.

## Reviewer Guidance

Start with provenance: trace one expected row from the WP07 closure/profile artifact into all three live comparisons and confirm no live manifest can redefine it. Then sample every official flow and the complete plugin lifecycle, inspect existing-home and reload equality, and execute each negative control. Reject any candidate-specific expectation, allowance, skip, desktop business implementation, mismatched digest, or report normalization.
