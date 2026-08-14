---
work_package_id: WP04
title: Ephemeral Profile Overlay and Official Host Launch
dependencies:
- WP02
- WP03
requirement_refs:
- FR-002
- FR-003
- FR-008
- FR-009
- FR-015
- FR-016
- FR-017
- C-003
- C-004
- C-005
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T018
- T019
- T020
- T021
- T022
agent: codex
history: []
agent_profile: node-norris
authoritative_surface: packages/profile-overlay/
create_intent:
- docs/profile-launch.md
execution_mode: code_change
model: ''
owned_files:
- packages/profile-overlay/src/**
- packages/profile-overlay/tests/**
- packages/desktop-surface/src/**
- packages/desktop-surface/tests/**
- packages/host-launcher/src/**
- packages/host-launcher/tests/**
- fixtures/profiles/desktop-fixture/**
- docs/profile-launch.md
role: implementer
tags: []
---

# Work Package Prompt: WP04 – Ephemeral Profile Overlay and Official Host Launch

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Launch the exact supported official Host through its public built `dsh` binary and one non-secret, ephemeral profile overlay. Preserve the selected Web profile's complete official and user-provided composition while replacing only its TCP carrier and false browser-surface context.

Start the implementation lane with:

```sh
spec-kitty agent action implement WP04 --agent codex
```

## Context

WP02 supplies the verified payload identity, staged standard Node runtime, and fail-loud compatibility set. WP03 supplies the authenticated UDS provider that implements the pinned `webServer` service. This work package composes those pieces without importing an internal launcher, copying the official Web roster, or mutating upstream or user profile files.

Use acceptance-test-first TDD for every subtask: write the focused test, run it and record RED, implement the smallest behavior, then rerun and record GREEN. Run compatibility checks before creating an overlay, spawning Host, or permitting user work. Do not edit manifests, locks, `wps.yaml`, or files outside `owned_files`.

### Subtask T018: Preflight the selected Web profile and supported launch seams

**Purpose**: Reject unsupported profile, payload, patch, or durable-data combinations before the launcher writes into a user home or starts Host.

**Steps**:

1. Write failing tests in `packages/profile-overlay/tests/profile-compatibility.spec.ts` for the supported profile and each named incompatibility.
2. Validate the exact WP02 payload identity, supported public `dsh` bin, Node engine, repeatable `--patch` support, absolute file-URL plugin entries, and required Web-profile rows.
3. Require the original `webserver` and `web-runtime` row identities and the official Web bundles; reject missing, renamed, duplicated, already-disabled, or behaviorally changed seams.
4. Resolve the full official roster plus user patch, home patch, and installed third-party bundles through the supported profile path; never reconstruct that roster locally.
5. Reject a newer unsupported durable schema or mixed plugin closure before overlay creation, Host spawn, session work, or user-home writes.
6. Return redacted structured diagnostics naming the failed seam, observed identity, and supported set without paths, credentials, profile contents, or user content.

**Files**:

- `packages/profile-overlay/src/compatibility.ts` and `packages/profile-overlay/src/index.ts` (new, about 150 lines)
- `packages/profile-overlay/tests/profile-compatibility.spec.ts` (new, about 170 lines)

**Validation**:

- Focused tests show RED then GREEN for every supported and unsupported identity.
- Unsupported fixtures prove zero spawn calls and byte-identical user/upstream trees.

### Subtask T019: Generate the disable-plus-insert ephemeral overlay

**Purpose**: Produce the smallest official-patch overlay that removes the TCP provider from composition while preserving every other selected-profile row.

**Steps**:

1. Write failing overlay snapshot and mutation tests in `packages/profile-overlay/tests/overlay.spec.ts`.
2. Patch the existing `webserver` row by id with `disabled: true`; never set, replace, or mutate that row's `name`.
3. Insert a distinct `desktop-webserver` row whose plugin entry is an absolute `file:` URL for the WP03 provider and whose configuration names only the fixed capsule descriptor.
4. Configure `web-runtime` with URL printing disabled and `surfaceContext: false`, preserving all unrelated configuration and trusted-host declarations.
5. Insert a distinct `desktop-surface` row with an absolute `file:` URL, without copying, deleting, or reordering the rest of the official or user roster.
6. Write the non-secret overlay mode 0600 inside the owned runtime directory, record its canonical digest, and provide idempotent cleanup; never include the token, socket path, or sentinel port.

**Files**:

- `packages/profile-overlay/src/overlay.ts` and `packages/profile-overlay/src/serialization.ts` (new, about 190 lines)
- `packages/profile-overlay/tests/overlay.spec.ts` (new, about 170 lines)

**Validation**:

- Golden output contains disable-plus-insert rows only and valid absolute file URLs.
- Tests prove source profile, user/home patches, installed plugins, and upstream remain byte-for-byte unchanged.

### Subtask T020: Restore truthful desktop surface semantics

**Purpose**: Preserve the Harness prompt source after browser-only `surfaceContext` is disabled, without advertising an unreachable Web URL.

**Steps**:

1. Write failing tests in `packages/desktop-surface/tests/desktop-surface.spec.ts` for registration, prompt output, disposal, and forbidden data.
2. Implement the desktop surface through the supported Harness/system-prompt extension point and register every contribution as a disposable effect.
3. Retain the official Harness source section and add only truthful orientation: the official renderer is hosted by the desktop shell and Host remains authoritative.
4. Exclude HTTP URLs, sentinel ports, UDS paths, tokens, process ids, launch arguments, credentials, and claims of shell-owned DSH business behavior.
5. Prove disabling `web-runtime.surfaceContext` plus enabling this row yields exactly one Harness source and no browser URL context.

**Files**:

- `packages/desktop-surface/src/index.ts` and `packages/desktop-surface/src/context.ts` (new, about 100 lines)
- `packages/desktop-surface/tests/desktop-surface.spec.ts` (new, about 140 lines)

**Validation**:

- RED/GREEN tests cover composition, load, prompt projection, and unload.
- Model-visible output is stable, truthful, secret-free, and contains no unreachable URL.

### Subtask T021: Build the official-bin Host launch plan

**Purpose**: Spawn the official built CLI under the exact staged standard Node runtime without internal launcher imports or shell-specific runtime ABI.

**Steps**:

1. Write failing spawn-plan and real-child tests in `packages/host-launcher/tests/official-launch.spec.ts`.
2. Resolve absolute `nodeExecutable` and public `dsh` bin paths from the verified WP02 payload; reject global PATH fallbacks, package internals, unsupported Node, and paths outside the payload.
3. Build argv from the public bin, selected profile, and one repeatable `--patch` overlay only; preserve official profile/home/user resolution and never invoke `runProfile()` directly.
4. Pass the one-use bounded BootCapsule on the fixed inherited descriptor. Keep token and socket path out of argv, environment, stdout/stderr parsing, overlay, and diagnostics.
5. Spawn in its own identity-fenced process group with the minimal environment allowlist; expose child liveness and authenticated health probing rather than log-based readiness.
6. Ensure every compatibility failure precedes runtime mutation and spawn, and every pre-spawn or child-exit path exposes overlay cleanup to WP05 supervision.

**Files**:

- `packages/host-launcher/src/boot-plan.ts`, `launch.ts`, and `index.ts` (new, about 230 lines)
- `packages/host-launcher/tests/official-launch.spec.ts` (new, about 200 lines)

**Validation**:

- Captured executable is staged Node and argv begins with the public built DSH bin plus exactly one overlay.
- Secret canaries are absent from argv, environment, overlay, child logs, errors, and diagnostics.

### Subtask T022: Prove clean-home and existing-home launch behavior

**Purpose**: Exercise the real supported launch path with one canonical keyless profile fixture and document its compatibility and cleanup guarantees.

**Steps**:

1. First add failing integration tests in `packages/host-launcher/tests/profile-launch.integration.spec.ts` using only `fixtures/profiles/desktop-fixture/**` as the canonical profile fixture.
2. Model the official Web profile, deterministic replay provider, user/home patch layers, and representative installed plugin reference without copying the official roster or using the browser fixture transport.
3. Launch a clean isolated home through staged Node, the public DSH bin, and the generated overlay; prove official index/boot composition survives and the original TCP row never listens.
4. Launch an existing-home copy and compare before/after hashes with the official baseline; profiles, settings, credential references, plugins, sessions, and upstream files must not be rewritten or migrated by desktop setup.
5. Add negative fixtures for unsupported row identity, payload, Node, absolute-entry behavior, plugin closure, and durable schema; assert failure before Host/user work and actionable redacted diagnostics.
6. Test paths with spaces and CJK characters, overlay removal on success/failure, and repeat launch without residue; document supported launch, development oracle, and cleanup behavior.

**Files**:

- `fixtures/profiles/desktop-fixture/**` and `packages/host-launcher/tests/profile-launch.integration.spec.ts` (new, about 430 lines)
- `docs/profile-launch.md` (new, about 120 lines)

**Validation**:

- Focused integration tests show RED then GREEN for clean and existing homes.
- Filesystem inventories prove only official baseline writes and no persistent overlay or upstream mutation.

## Definition of Done

- [ ] T018–T022 each preserve a recorded focused RED command and passing GREEN command.
- [ ] Preflight rejects unsupported compatibility before overlay creation, Host spawn, session work, or user-home writes.
- [ ] The original `webserver` row is disabled by id, its name is untouched, and the absolute-file-URL desktop provider is inserted separately.
- [ ] The complete official/user/plugin roster remains profile-loader-owned, and `surfaceContext: false` is paired with one truthful desktop surface.
- [ ] The staged supported Node launches the public built DSH bin with one ephemeral, non-secret overlay and inherited capsule.
- [ ] Canonical fixture tests cover clean home, existing home, hostile paths, cleanup, and byte-identical upstream/profile inputs.
- [ ] `corepack pnpm --filter @deepseek-ai/dsh-desktop-profile-overlay test`, desktop-surface tests, and host-launcher tests pass.
- [ ] `corepack pnpm run typecheck`, `corepack pnpm run lint`, and the relevant integration gate pass.

## Risks

- Upstream patch or row semantics may drift. Pin the behavior probe and fail before work rather than guessing or copying the roster.
- Absolute file URLs can be malformed on spaces or Unicode. Construct them with Node URL APIs and cover non-ASCII fixtures.
- Launch secrets can leak through convenient process surfaces. Keep the capsule descriptor-only and assert canary absence.
- Cleanup races can hide profile mutation. Hash durable inputs independently and make cleanup idempotent for WP05.

## Reviewer Guidance

Review the generated overlay before launcher mechanics: it must disable and insert, never rename or replace. Confirm compatibility failures occur before any durable write or spawn, the official public CLI/profile loader remains the only composition path, and tests use the canonical fixture for both clean and existing homes. Reject internal launcher imports, copied official rosters, global runtime fallbacks, persisted overlays, false URLs, or any secret-bearing argv/environment/log field.
