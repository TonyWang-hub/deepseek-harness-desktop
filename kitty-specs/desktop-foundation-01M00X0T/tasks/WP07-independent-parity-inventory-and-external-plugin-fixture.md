---
work_package_id: WP07
title: Independent Parity Inventory and External Plugin Fixture
dependencies:
- WP02
requirement_refs:
- FR-002
- FR-010
- FR-011
- FR-012
- NFR-001
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
- T035
- T036
- T037
- T038
- T039
- T040
agent: codex
history: []
agent_profile: implementer-ivan
authoritative_surface: packages/parity/
create_intent:
- scripts/generate-parity-inventory.ts
- docs/parity-inventory.md
execution_mode: code_change
model: ''
owned_files:
- packages/parity/src/**
- packages/parity/tests/**
- fixtures/plugins/parity-probe/**
- scripts/generate-parity-inventory.ts
- docs/parity-inventory.md
role: implementer
tags: []
---

# WP07: Independent Parity Inventory and External Plugin Fixture

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Create the candidate-independent parity oracle and an ordinarily installed out-of-tree plugin fixture before either desktop shell is developed. The expected contribution set must come from the pinned payload closure plus the official Web-profile bundle patches, never from the live Host graph that it evaluates.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP07 --agent codex
```

## Context

WP02 provides the exact payload identity, staged package closure, integrity records, and official renderer bytes. Treat those immutable inputs and the official profile composition as the only sources for the expected first-party browser-contribution denominator.

The live Host-composed boot manifest is evidence to compare against that denominator. It must never add, remove, classify, or excuse an expected item, because a missing package or broken bundle would otherwise redefine the test into a false pass.

Use acceptance-test-first TDD for every subtask. Add the smallest focused test, record its expected RED result, implement only the parity or fixture behavior required to turn it GREEN, and retain the exact command and result.

This work package owns no Electron or Tauri code. It must not import either application, branch on a candidate label, prebundle the fixture into a shell, or implement any renderer transport primitive; WP08–WP10 consume its immutable inventory, fixture, digest, and report interfaces later.

### Subtask T035: Derive the expected browser contribution inventory independently

**Purpose**: Generate the complete expected first-party browser contribution set from immutable release inputs without consulting a running Host or live boot graph.

**Steps**:

1. RED: create fixture payload metadata in which the pinned closure and official Web-profile patches declare several browser rows, then prove the generator fails because no independent extractor exists.
2. Define versioned input and output records for payload digest, profile identity, source package, bundle row id, contribution entry, content digest, contribution kind, and stable inventory id.
3. Read only WP02's verified package closure, staged package metadata, and the exact official profile bundle patches selected by the supported profile. Reject working-tree paths, unresolved ranges, absent integrity, and mismatched payload digests.
4. Resolve profile patch ordering and enabled rows deterministically without invoking `dsh`, importing Host runtime code, reading a generated boot manifest, or observing a live plugin tree.
5. Derive each expected browser entry and asset digest from its closure member and official row. Use normalized package-relative paths and sorted UTF-8 keys so filesystem enumeration order cannot affect output.
6. Fail on duplicate stable ids, missing referenced packages or entries, unsupported patch operations, inactive required official rows, and bytes that disagree with WP02's closure identity.
7. GREEN: generate the same ordered inventory from two differently enumerated copies of one payload and assert byte-identical canonical JSON and digest.

**Files**:

- `packages/parity/src/{inventory-types,official-profile,expected-inventory,canonical-json}.ts`
- `packages/parity/tests/{expected-inventory,official-profile}.test.ts`

**Validation**: `corepack pnpm --filter ./packages/parity test -- expected-inventory official-profile` passes, and a dependency guard proves production inventory generation cannot import a Host boot-graph or candidate module.

### Subtask T036: Classify every item and map it to requirements and checks

**Purpose**: Make additions, removals, and unknown contribution types fail until each expected item has a deterministic classification and executable requirement map.

**Steps**:

1. RED: feed known browser modules, unknown entry metadata, duplicate mappings, and an unmapped contribution to the classifier; assert unknown, ambiguous, and unmapped inputs fail with stable item ids.
2. Define a closed classification vocabulary for official client contribution, dynamic client module, browser resource, and representative cross-cutting flow; do not infer a class from live activation or visible text.
3. Classify from package identity, official bundle row metadata, declared entry type, and versioned mapping rules. Require an explicit reviewed rule when an upstream entry cannot be classified mechanically.
4. Map every inventory item to its source requirement, activation check, and any required reference scenario. Enforce at least FR-002, FR-010, FR-012, NFR-001, and the applicable plugin/user-flow coverage.
5. Add candidate-neutral flow records for session create/resume, streaming response, tools, terminal/diff/plan, approval and ask-user, settings/credentials, attachments/downloads, reload, and contribution lifecycle.
6. Compare an observed live boot graph with the independent expected set as a separate pure operation. Report missing, unexpected, digest-mismatched, degraded, skipped, or desktop-reimplemented entries as failures; never mutate the expected set.
7. GREEN: randomize source and observation order and prove the classification, requirement map, comparison result, and diagnostic ordering stay byte-identical.

**Files**:

- `packages/parity/src/{classification,requirement-map,compare-live-graph,parity-status}.ts`
- `packages/parity/tests/{classification,requirement-map,compare-live-graph}.test.ts`

**Validation**: `corepack pnpm --filter ./packages/parity test -- classification requirement-map compare-live-graph` passes with zero unclassified or unmapped expected items and no skip or candidate-allowance state.

### Subtask T037: Prove the oracle with removed and corrupted bundle controls

**Purpose**: Demonstrate that missing or byte-corrupted official browser contributions cannot shrink the denominator or produce a passing report.

**Steps**:

1. RED: run the current comparator against a temporary staged-payload copy after removing one expected bundle entry and show that the test wrongly lacks a required negative-control result.
2. Build hermetic mutation helpers that copy a verified fixture payload into a temporary directory, remove one declared contribution for the removed control, and flip a deterministic byte for the corrupted control.
3. Preserve the original payload lock, closure record, official profile patches, expected inventory, and expected digest while applying each mutation; never regenerate expectations from the damaged copy.
4. Require the removed control to fail with the exact missing stable id and the corrupted control to fail with expected and observed content digests. Reject a generic count-only error.
5. Prove each control fails before activation evidence can be marked passing and that restoring the exact bytes returns the clean control to pass.
6. Make the negative-control result mandatory in a valid parity report. A skipped, unexpectedly passing, wrong-item, or non-reproducible control invalidates the entire run.
7. GREEN: execute clean, removed, and corrupted cases twice and assert stable failure codes, item ids, and report digests.

**Files**:

- `packages/parity/src/negative-controls.ts`
- `packages/parity/tests/{negative-controls,fixtures/payload-control/**}`

**Validation**: `corepack pnpm --filter ./packages/parity test -- negative-controls` passes only when both mutations are detected against the unchanged independently derived denominator.

### Subtask T038: Build and install the unchanged out-of-tree plugin fixture

**Purpose**: Prove an ordinary plugin package can contribute Host behavior, dynamic browser UI, and generic network routes without a desktop-specific build or shell registration.

**Steps**:

1. RED: create a real temporary profile that uses the formal profile bundle/install mechanism and show the absent fixture cannot be resolved or activated by the official baseline.
2. Create `parity-probe` as a standalone publishable plugin package outside the staged first-party payload. Give it normal package metadata, a bundle/profile entry, Host entry, dynamic client entry, static assets, and no import from this repository's shell or parity internals.
3. Add one Host contribution with an opaque probe state and one visible client interaction rendered by the ordinary dynamic module loader. The client must discover Host behavior through public DSH facilities.
4. Register arbitrary-path streaming HTTP, EventSource, and RFC 6455 upgrade probes through the public `webServer` contribution mechanism. Keep route bytes opaque and include text, binary, ordered streaming, cancellation, and close evidence.
5. Pack the fixture reproducibly, install that unchanged artifact through the same formal profile mechanism available to plugin authors, and record package, archive, installed-tree, Host-entry, and client-entry digests.
6. Launch the official browser baseline from the staged WP02 runtime and selected real profile. Assert Host activation, dynamic UI interaction, finite and streaming HTTP, infinite EventSource, upgrade text/binary frames, and clean close.
7. GREEN: reinstall the same packed artifact into a clean profile and prove all observations and fixture digests are identical without copying it into the official payload or either candidate.

**Files**:

- `fixtures/plugins/parity-probe/{package.json,cordis.yml,src/**,client/**,assets/**}`
- `packages/parity/tests/{external-plugin,fixtures/profile-install/**}.test.ts`

**Validation**: `corepack pnpm --filter ./packages/parity test -- external-plugin` passes against the ordinary official profile path and source inspection finds no Electron, Tauri, desktop bridge, private socket, or candidate-specific entry.

### Subtask T039: Exercise plugin lifecycle, upgrade, and the packaged native-addon probe

**Purpose**: Cover ordinary unload/reload/upgrade behavior and prove packaged native code loads in the exact standard Node Host ABI rather than a shell runtime.

**Steps**:

1. RED: activate fixture version one, then disable, remove, reload, and upgrade it; assert the incomplete harness fails to account for Host effects, client UI, routes, sockets, and native-addon identity at every transition.
2. Add deterministic version-one and version-two fixture packages through the same reproducible pack path. Version two changes a visible version marker and route result without adding any desktop-only metadata or install step.
3. Verify disable and uninstall remove Host effects, client contribution, HTTP/EventSource/upgrade routes, timers, listeners, and sockets while unrelated official contributions and sessions remain available.
4. Verify reload creates one replacement generation, does not duplicate contributions or actions, retires old streams, and exposes the same version and digest after reconnect.
5. Upgrade through the formal profile package mechanism, preserve ordinary plugin-owned durable facts, activate only version two, and reject a mixed installed closure or stale version-one browser asset.
6. Include a minimal packaged native addon compiled for the pinned standard Node runtime supported by WP02. Its Host probe reports the exact Node version, module ABI, platform, architecture, and `process.release.name` without exposing paths.
7. Run the packed fixture with the staged Node executable and official `dsh` binary; require successful native loading under the declared standard Node ABI and fail if the addon runs in Electron, a Rust process, or any unpinned runtime.
8. GREEN: run install, use, unload, reload, upgrade, and native-addon cases twice from clean profiles and compare lifecycle event order plus final digests.

**Files**:

- `fixtures/plugins/parity-probe/{versions/**,native/**,scripts/**}`
- `packages/parity/tests/{plugin-lifecycle,native-addon}.test.ts`

**Validation**: `corepack pnpm --filter ./packages/parity test -- plugin-lifecycle native-addon` passes with no leaked contribution or open route after unload and with the packaged probe identifying only the WP02 standard Node ABI.

### Subtask T040: Publish a reproducible candidate-neutral inventory and report interface

**Purpose**: Produce one digest-addressed inventory, fixture identity, and report format that the browser baseline and both later candidate lanes can consume unchanged.

**Steps**:

1. RED: serialize semantically identical inventories and reports with reordered inputs, changed absolute roots, and different candidate labels; prove the current output is unstable or permits candidate-specific expectations.
2. Define a versioned report containing payload, official-profile, expected-inventory, requirement-map, fixture, scenario-corpus, observation, negative-control, and generator digests plus pass/fail results for every stable id.
3. Canonicalize sorted records, relative logical names, normalized line endings, integer schema versions, and SHA-256 digests. Exclude timestamps, temporary roots, usernames, machine paths, secrets, and nondeterministic archive metadata from identity.
4. Expose pure library entry points for generation and comparison plus `scripts/generate-parity-inventory.ts` for a checked command-line path. Accept explicit payload/profile/output inputs and fail rather than discovering a live graph implicitly.
5. Make candidate identity report metadata only. It may select observed evidence, but it cannot change inventory items, classifications, requirements, fixtures, scenarios, expected outcomes, thresholds, or negative controls.
6. Add a reproducibility test that generates on two clean roots and proves byte-identical inventory, requirement map, fixture identity, and digest. Add a consumer-contract test that loads the same artifact for two opaque candidate labels.
7. Document generation inputs, formal plugin installation, report fields, lifecycle/native probes, negative controls, candidate consumption, upgrade procedure, and failures that disqualify a candidate.
8. GREEN: run the CLI twice before any candidate application exists, compare bytes and digests, and validate the result through the public package parser.

**Files**:

- `packages/parity/src/{report,artifact,consumer,index}.ts`
- `packages/parity/tests/{report,reproducibility,consumer-contract}.test.ts`
- `scripts/generate-parity-inventory.ts`
- `docs/parity-inventory.md`

**Validation**: `corepack pnpm --filter ./packages/parity test && corepack pnpm exec tsx scripts/generate-parity-inventory.ts --help` passes, and two clean-root generations are byte-identical and loadable without any candidate source tree.

## Definition of Done

- [ ] T035–T040 each retain focused RED and GREEN commands and results.
- [ ] The expected first-party browser inventory comes only from the pinned closure and official profile patches, never the live Host graph.
- [ ] Every expected item has one stable classification, requirement map, activation check, and required scenario set.
- [ ] Removed and corrupted bundle controls fail against the unchanged denominator and are mandatory report evidence.
- [ ] The out-of-tree fixture installs formally and unchanged, then proves Host, dynamic client UI, HTTP, EventSource, upgrade, unload, reload, and upgrade behavior.
- [ ] The packaged native addon loads under the pinned standard Node ABI and no shell-specific runtime.
- [ ] Canonical inventory, fixture, and report digests reproduce across clean roots and are consumable by both future candidates without allowances.
- [ ] No Electron or Tauri implementation, copied suite, prebundled fixture, or candidate-specific expected result is added.

## Risks

- **Circular oracle**: A live graph used as the denominator can hide a missing package; enforce input provenance and dependency guards.
- **Fixture privilege**: A repository-private install shortcut would not prove plugin compatibility; exercise only the formal profile mechanism with the packed artifact.
- **Native false positive**: JavaScript-only runtime checks do not prove addon loading; require a real packaged `.node` module plus exact runtime and ABI evidence.
- **Digest drift**: Paths, timestamps, archive order, or platform separators can corrupt reproducibility; canonicalize or exclude them before hashing.

## Reviewer Guidance

Review the oracle before the fixture implementation. Trace one official row from the WP02 closure and official profile patches into its stable inventory item, classification, requirement map, expected digest, live comparison, and both negative controls. Then trace fixture install, Host/client activation, generic HTTP/EventSource/upgrade traffic, unload, reload, version upgrade, and native-addon loading through public plugin mechanisms. Reject any candidate import, live-derived expectation, skip state, desktop-specific fixture change, or report field that can alter the denominator.
