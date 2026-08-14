---
work_package_id: WP13
title: Whole-Application Benchmark and Deterministic Evaluator
dependencies:
- WP11
- WP12
requirement_refs:
- FR-012
- FR-013
- FR-014
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- NFR-006
- NFR-007
- NFR-008
- NFR-011
- NFR-012
- C-006
- C-007
- C-008
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T071
- T072
- T073
- T074
- T075
- T076
agent: codex
history: []
agent_profile: researcher-robbie
authoritative_surface: packages/benchmark/src/
create_intent:
- scripts/benchmark-desktop.ts
- scripts/evaluate-shells.ts
- docs/performance.md
execution_mode: code_change
model: ''
owned_files:
- packages/benchmark/src/**
- packages/benchmark/tests/**
- tests/benchmark/**
- benchmarks/scenarios/performance/**
- benchmarks/baselines/**
- benchmarks/reports/**
- evidence/benchmarks/**
- scripts/benchmark-desktop.ts
- scripts/evaluate-shells.ts
- docs/performance.md
role: researcher
tags: []
---

# WP13: Whole-Application Benchmark and Deterministic Evaluator

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `researcher-robbie`
- **Role**: `researcher`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Build the candidate-neutral whole-application benchmark controller, raw-evidence validator, and deterministic shell evaluator. Measure the official browser baseline, Electron, and Tauri with identical payload bytes, profiles, fixtures, scenarios, settings, environment policy, developer-tool state, checkpoint schedules, and sample counts. Invalid or incomplete evidence must never enter aggregation.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP13 --agent codex
```

## Context

WP11 supplies immutable browser/candidate parity evidence and WP12 supplies lifecycle, privacy, no-TCP, and failure-mode evidence. Consume both as hard-gate inputs; WP13 may classify their results but must not repair, normalize away, or rerun them with weaker assertions.

Use acceptance-test-first TDD for T071–T076. Retain a focused RED result for every identity mismatch, missing process, invalid sample, threshold edge, and redaction leak; implement the smallest shared collector or evaluator behavior; then retain GREEN without a candidate-specific exception. Candidate identity may choose only the public launch adapter.

All timing and memory observations must come from external operating-system or renderer-boundary probes. Do not read candidate-private state, report renderer heap or shell PID RSS as whole-application memory, edit measured values, or discard an unfavorable valid sample.

### Subtask T071: Freeze the matched campaign and randomized ABBA schedule

**Purpose**: Predeclare one immutable measurement campaign so all three environments execute the same work and candidate order cannot bias results.

**Steps**:

1. RED: change one payload, profile, fixture, scenario, setting, sample count, display fact, power fact, or developer-tool flag and require campaign validation to fail before launch.
2. Define the campaign schema and canonical policy from `contracts/benchmark-result.schema.json`, including controller revision, candidate-order seed, identities, environment, scenarios, counts, confidence method, checkpoints, hard budgets, memory weights, and relative guardrails.
3. Bind the browser baseline, Electron, and Tauri to one digest-addressed scenario corpus and byte-identical payload, profile, replay data, settings, locale, theme, display, and disabled developer tools.
4. Generate seeded randomized ABBA samples for every candidate/scenario class: choose `electron, tauri, tauri, electron` or its inverse per block, and attach the matched browser-baseline run without changing inputs.
5. Predeclare at least thirty cold launches, thirty warm launches, and thirty randomized sustained-stream runs per declared stream class; reject missing, extra, duplicated, reordered, or post hoc runs.
6. Require AC power, nominal thermal state, bounded background-load checks, stable display state, and quiescence windows; record invalid observations instead of silently retrying them into a favorable sample.
7. GREEN: the same seed produces the same canonical schedule and digest twice, while every seeded identity, order, count, or environment violation fails deterministically.

**Files**: `packages/benchmark/src/{campaign,policy,schedule,scenario-corpus}.ts`, corresponding package tests, and `benchmarks/scenarios/performance/campaign.json` (new).

**Validation**: Focused tests reproduce the complete browser/Electron/Tauri schedule from its seed and reject any unequal input, biased order, hidden developer tools, or undeclared rerun.

### Subtask T072: Census the complete attributable process set and memory

**Purpose**: Measure whole-application memory from complete attributable process membership, with macOS de-duplication as the primary metric.

**Steps**:

1. RED: omit a renderer, GPU, network, content, Host, helper, tool child, or correlated WKWebView XPC process; reuse a PID with the wrong start time; or sum RSS as the decision metric, and require invalidation.
2. Census every attributable PID with role, parent PID when present, process start time, executable digest, application generation, and attribution method at every checkpoint.
3. Include ordinary descendants plus non-descendant WKWebView XPC services by creation-time, shell-metrics or explicit-registration, ownership, activity, and teardown correlation; ambiguity or incomplete membership invalidates the run.
4. Collect macOS de-duplicated physical footprint for the complete census as the sole decision memory measurement, avoiding shared-page double counting across shell, WebView, and Host processes.
5. Record per-process RSS only as a diagnostic for attribution and anomaly investigation; never aggregate RSS into a replacement score or use binary size, renderer heap, or one shell process as a proxy.
6. Fence every observation by PID and start time, reject stale or duplicate membership, and prove the attributed set disappears at clean teardown without capturing unrelated browser, Node, DSH, or XPC work.
7. GREEN: synthetic descendant/non-descendant controls and real macOS candidate probes produce complete, stable role membership and repeatable footprint checkpoints.

**Files**: `packages/benchmark/src/{process-census,process-attribution,memory-sampler}.ts`, corresponding package tests, and `tests/benchmark/process-membership.test.ts` (new).

**Validation**: The process suite fails every omitted, ambiguous, stale, unrelated, or double-counted process control and proves physical footprint is primary while RSS remains diagnostic.

### Subtask T073: Measure long-session footprint and bounded desktop-added state

**Purpose**: Compare retained memory and growth against the official browser baseline across representative steady-state and lifecycle checkpoints.

**Steps**:

1. RED: seed an unbounded proxy queue, retained retired renderer, superlinear candidate-only slope, missing checkpoint, or unequal final state and require the affected run to be invalid.
2. Run the identical browser, Electron, and Tauri scenarios at idle; every 10,000-event checkpoint from 10,000 through 100,000 events; and the declared 500-turn conversation checkpoint.
3. Exercise 20, 60, and 200 frame-per-second sustained streams and flood, large tool output, cancellation/approval traffic, session switch, renderer reload, and Host restart with the same replay bytes and actions.
4. At each predeclared phase, capture complete-process footprint, diagnostic RSS, desktop-owned buffered bytes, live proxy/exchange counts, renderer generation, and externally observable final-state and action-count digests.
5. Compare candidate-minus-browser retained state and footprint slopes against predeclared ceilings; require bounded desktop-added state and reject superlinear growth across the 100,000-event sequence.
6. After session switch, reload, and restart quiescence, require retired renderer/proxy state reclamation while leaving upstream-owned session retention out of the desktop penalty.
7. GREEN: all valid runs preserve event/action equality, meet bounded-state rules, and retain every declared checkpoint without candidate-specific normalization.

**Files**: `packages/benchmark/src/{memory-scenarios,retention-oracle,checkpoint-aggregator}.ts`, package tests, `tests/benchmark/long-session.test.ts`, and `benchmarks/scenarios/performance/{idle,long-history,stream-flood,large-tool,lifecycle}.json` (new).

**Validation**: Browser/Electron/Tauri runs cover idle, 10k–100k, 500 turns, stream flood, large tool output, switch, reload, and restart; leak, slope, reclamation, or hash controls fail.

### Subtask T074: Measure operational startup and interaction responsiveness

**Purpose**: Capture externally observed cold/warm prompt readiness, user-visible latency, control priority, and stream integrity under load.

**Steps**:

1. RED: report a merely visible empty composer as ready, source a phase from candidate-private state, omit a paint, hide a stall, or alter an event/hash and require failure.
2. Timestamp process start, window visible, renderer settled, Host connected, composer operational, and first session ready from external probes; prompt-ready requires a responsive composer that can start the first real session.
3. Collect at least thirty randomized cold and thirty randomized warm operational-prompt-ready launches per candidate, with each phase recorded separately and browser baseline context retained.
4. During long history, 20/60/200-frame streams, flood, and large tool output, inject deterministic typing, scrolling, cancellation, and approval actions and measure input-to-next-paint samples.
5. Record input-to-next-paint p95 and p99 with 95% bootstrap confidence intervals, every renderer/shell frame or main-loop stall, and request-to-ack control RTT without letting transcript traffic starve control traffic.
6. Require p95 at most 50 ms, p99 below 100 ms, zero stalls at or above 250 ms, control RTT p95 at most 100 ms, warm prompt-ready p95 at most 1.5 s, and cold p95 at most 3 s.
7. For every stream sample require complete ordered frames, zero duplicates or out-of-order delivery, expected counts, and matching final-state hashes; aggregates cannot hide one integrity failure.
8. GREEN: boundary probes reproduce phase order and percentiles, while each seeded budget, stall, RTT, ordering, count, or final-hash violation is disqualifying.

**Files**: `packages/benchmark/src/{startup-probe,responsiveness-probe,statistics,integrity-oracle}.ts`, package tests, and `tests/benchmark/{startup,responsiveness,integrity}.test.ts` (new).

**Validation**: Focused cold/warm, latency, stall, control, order, and hash suites enforce every absolute budget and preserve raw samples needed to recompute p95, p99, and confidence intervals.

### Subtask T075: Validate, redact, and commit complete raw evidence

**Purpose**: Make every accepted or excluded observation schema-valid, privacy-safe, attributable, and reproducible before aggregation.

**Steps**:

1. RED: remove a required raw field, add an unknown field, mismatch a digest, mark an invalid run without a reason, mark a valid run with one, or leak a seeded canary and require rejection.
2. Validate the exact campaign fields and closed objects in `contracts/benchmark-result.schema.json`: schema version, campaign id/time, controller revision, order seed, payload/profile/fixture digests, environment, policy, and runs.
3. Require environment identity to include digested machine id, hardware model and memory, arm64, macOS version/build, display dimensions/scale, AC power, locale, fixed theme, disabled developer tools, and per-run thermal state.
4. Preserve per-run candidate/scenario identity, timestamps, complete processes, memory checkpoints, startup phases, raw latency arrays, integrity counts/hashes, validity, and explicit invalidation reasons in canonical order.
5. Hash the schema, campaign manifest, scenario corpus, payload/profile/fixture inputs, raw evidence files, hard-gate inputs, and evaluator revision so every derived field can be traced without manual reconstruction.
6. Seed credentials, tokens, socket/home paths, unrestricted environment values, prompts, responses, and session-content canaries; byte-scan raw evidence, logs, baselines, reports, and build metadata for every value.
7. Keep the full scheduled-run ledger, including invalid runs and their reasons. Commit the complete validated, redacted campaign inputs and reproducible reports; never cherry-pick favorable samples or omit exclusions.
8. GREEN: two canonicalization passes yield identical digests, every canary is absent, and schema, identity, privacy, membership, environment, or schedule defects stop evaluation.

**Files**: `packages/benchmark/src/{raw-schema,validator,canonicalize,redaction}.ts`, package tests, `tests/benchmark/evidence-validation.test.ts`, `benchmarks/baselines/**`, and `evidence/benchmarks/**` (new).

**Validation**: `corepack pnpm run benchmark:validate` accepts only complete canary-clean campaigns, preserves all scheduled outcomes, and reproduces every committed input digest.

### Subtask T076: Apply hard gates and the deterministic shell decision

**Purpose**: Derive exactly one auditable outcome—Electron, Tauri, or no winner—from validated evidence and fixed policy.

**Steps**:

1. RED: let performance compensate for a failed hard gate, alter a threshold after collection, drop an unfavorable scenario, or hand-edit an outcome and require evaluator failure.
2. Apply payload, parity, no-TCP, lifecycle, integrity, responsiveness, startup, and evidence-validity hard gates before any comparative score; an invalid campaign or candidate cannot be selected.
3. Select the only hard-gate-passing candidate when exactly one passes; if neither passes, emit the legal no-winner outcome `none` with deterministic remediation inputs.
4. If both pass, compute the predeclared weighted aggregate of scenario p95 whole-application physical footprint and select Tauri only when it is at least 25% lower than Electron.
5. Also require no Tauri memory scenario to be more than 5% worse and no responsiveness or startup metric to miss its absolute budget or regress by more than 10%; one violation keeps Electron as the compatibility baseline.
6. Emit hard-gate results, input and evaluator digests, confidence data, aggregate and per-scenario memory comparisons, response/start comparisons, outcome, exclusions, and required remediation without editable derived values.
7. Expose fixed collection, validation, and evaluation commands; run evaluation twice over the committed complete corpus and require byte-identical canonical reports and outcome.
8. Document measurement preparation, ABBA scheduling, process attribution, footprint/RSS distinction, scenarios, startup phases, budgets, invalidation, privacy, thresholds, and no-winner handling.

**Files**: `packages/benchmark/src/{hard-gates,evaluator,decision-report}.ts`, corresponding package tests, `scripts/benchmark-desktop.ts`, `scripts/evaluate-shells.ts`, `tests/benchmark/evaluator.test.ts`, `benchmarks/reports/**`, and `docs/performance.md` (new).

**Validation**: `corepack pnpm run benchmark:desktop -- --candidate-order-seed 20260815 && corepack pnpm run benchmark:validate && corepack pnpm run benchmark:evaluate` reproduces `electron`, `tauri`, or `none` solely from the complete committed evidence and fixed policy.

## Definition of Done

- [ ] T071–T076 each retain focused RED evidence and matching GREEN evidence.
- [ ] Browser baseline, Electron, and Tauri consume identical payload, profile, fixture, scenario, setting, environment, checkpoint, and sample-count inputs.
- [ ] Seeded randomized ABBA blocks are reproducible and cannot be reordered or selectively rerun without invalidating the campaign.
- [ ] Every attributable descendant and correlated WKWebView XPC helper is present at each required checkpoint.
- [ ] De-duplicated macOS physical footprint is the primary memory metric and per-process RSS is diagnostic only.
- [ ] Idle, 10k–100k events, 500 turns, stream flood, large tool, session switch, renderer reload, and Host restart prove bounded desktop-added state and reclamation.
- [ ] Cold/warm startup phases, input-to-next-paint p95/p99, stalls, control RTT, event ordering, and final hashes meet absolute gates.
- [ ] Raw evidence matches the closed schema, records environment and all input digests, and is free of every seeded canary.
- [ ] Hard gates precede the fixed 25%, 5%, and 10% replacement rules, with `none` accepted when no candidate qualifies.
- [ ] The complete campaign ledger and reproducible reports are committed without cherry-picked samples or hidden exclusions.
- [ ] `docs/performance.md` matches the tested commands, invalidation policy, metrics, and evaluator order.

## Reviewer Guidance

Recompute the schedule, membership, checkpoint aggregates, percentiles, confidence intervals, hard gates, and final outcome from committed raw inputs. Trace one Electron and one Tauri ABBA block through the browser baseline, process census, physical-footprint checkpoints, responsiveness samples, schema validation, canary scan, and decision report.

Reject incomplete process membership, RSS-based selection, internal readiness timestamps, missing raw observations, candidate-specific scenarios or thresholds, edited reports, hidden invalid runs, cherry-picked data, or any outcome that cannot legally be `none`.
