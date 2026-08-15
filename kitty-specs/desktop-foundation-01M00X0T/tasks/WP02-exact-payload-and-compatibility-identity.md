---
work_package_id: WP02
title: Exact Payload and Compatibility Identity
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-009
- FR-015
- FR-017
- NFR-010
- NFR-011
- C-001
- C-003
- C-005
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
- T011
agent: "codex"
history: []
agent_profile: node-norris
authoritative_surface: packages/payload/
create_intent:
- config/payload.lock.json
- scripts/stage-payload.ts
- scripts/verify-payload.ts
- scripts/verify-upstream-compat.ts
- docs/compatibility.md
execution_mode: code_change
model: ''
owned_files:
- packages/payload/src/**
- packages/payload/tests/**
- packages/compatibility/src/payload/**
- packages/compatibility/tests/payload/**
- config/payload.lock.json
- scripts/stage-payload.ts
- scripts/verify-payload.ts
- scripts/verify-upstream-compat.ts
- docs/compatibility.md
role: implementer
tags: []
shell_pid: "6716"
---

# WP02: Exact Payload and Compatibility Identity

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Create a deterministic, fail-loud payload pipeline that identifies every executable DSH and Node byte used by the desktop foundation. The result must stage one clean official payload, reject unknown or mixed identities before Host boot, and support read-only compatibility evaluation of a local upstream commit without ever modifying or packaging its working tree.

## Context

WP01 establishes the workspace, package manifests, pinned toolchains, and shared verification commands. This package supplies the exact payload and compatibility identity consumed by the private carrier, profile overlay, both shell candidates, parity oracle, and benchmark evidence; every later lane must be able to compare the same `payloadDigest` rather than infer compatibility from semver.

The compatibility set is atomic: an exact published `@deepseek-ai/dsh` release, the complete resolved npm dependency closure, every DSH-family package identity, the official renderer bytes, a standard Node 24 distribution for the target platform, and the desktop adapter version. Upstream package ranges are not proof of compatibility. A semver-identical package with different bytes, an omitted transitive dependency, or an unrecognized Node archive is incompatible.

Keep responsibilities explicit. `packages/payload` owns deterministic staging, canonical manifests, hashing, and verification mechanics. `packages/compatibility/src/payload` owns the supported identities, validation policy, diagnostic taxonomy, and upgrade-boundary rules. The sibling `deepseek-harness` repository is an optional read-only oracle, never a workspace member, staging source, or write target. Do not modify upstream, use `patch-package`, import unpublished DSH internals, fall back to a global `node`/`dsh`, or hide a mismatch behind a warning.

Implement this work package with acceptance-test-first TDD. For every subtask, add a focused test, run it and observe the expected failure for the missing behavior, then write the minimum production code and rerun the focused test. Preserve the RED and GREEN commands in the implementation handoff.

Start the implementation lane with:

```sh
spec-kitty agent action implement WP02 --agent codex
```

### Subtask T007: Define the atomic compatibility identity and checked-in payload lock

**Purpose**: Define one canonical identity that proves the selected DSH release, npm closure, renderer, standard Node distribution, and desktop adapter belong to the same supported set.

**Steps**:

1. Write failing contract tests in `packages/compatibility/tests/payload/compatibility-identity.test.ts` before creating the implementation.
   - Accept one complete fixture whose release, resolved closure, renderer digest, Node archive and unpacked digests, platform, architecture, and adapter version match the declaration.
   - Reject a version range, missing closure member, duplicate or unsorted package row, changed integrity/content/renderer/runtime digest, unsupported Node engine, or changed adapter version.
   - Prove that the same package name and semver with different content bytes is rejected.
   - Assert structured diagnostics include a stable error code, component name, expected identity, observed identity, and supported set without printing local paths, environment values, or file contents.

2. Add the persisted identity types and parser under `packages/compatibility/src/payload/`.
   - Model the source as a tagged `registry` or `clean-archive` identity; a working-tree path is never a persisted source.
   - Represent SHA-256 values only after validating lowercase 64-character hex input at the JSON/file boundary.
   - Require an exact DSH version, sorted DSH-family identities, a digest over the complete resolved npm dependency closure, official renderer digest, exact Node version/platform/architecture, Node archive integrity, unpacked-runtime digest, adapter version, and manifest schema version; keep secrets and unrestricted filesystem paths out of every serializable type.

3. Implement deterministic canonical serialization and compatibility comparison.
   - Normalize only representation details explicitly owned by the schema; do not sort away dependency edges or otherwise make two different closures compare equal.
   - Return an immutable validated value on success and a typed fail-loud result on mismatch.
   - Do not use permissive defaults for a missing identity field.

4. Create `config/payload.lock.json` as the sole checked-in release selection.
   - Pin the approved DSH version and registry integrity, the exact Node 24.17.x distribution for macOS arm64 and its published archive integrity, the adapter version, and the expected identity fields needed to reconstruct the manifest.
   - Do not use `latest`, semver ranges, mutable URLs, host-global executable paths, credentials, or the sibling checkout path.
   - Keep platform-specific Node records explicit so later Windows/Linux productization can add reviewed records rather than silently choosing one.

5. Run the focused test once in RED state and again after implementation, followed by the package typecheck configured by WP01. Record both commands and why the initial failure was correct.

**Files**: `packages/compatibility/src/payload/{compatibility-identity,diagnostics,index}.ts`, `packages/compatibility/tests/payload/compatibility-identity.test.ts`, and `config/payload.lock.json` (new).

**Validation**:

- Focused tests visibly fail before the parser/comparator exists and pass afterward.
- A one-byte mutation with unchanged package semver produces the expected incompatibility code.
- Parsing the checked-in lock succeeds; replacing any exact version with a range fails.
- Diagnostics contain identity metadata only and pass canary scans for tokens, prompts, responses, home paths, and unrestricted environment data.

### Subtask T008: Stage a clean official DSH and npm dependency closure deterministically

**Purpose**: Assemble the official DSH Host and renderer package tree from locked release inputs into a clean staging root while proving that the complete resolved npm closure matches the atomic identity.

**Steps**:

1. Begin with failing tests in `packages/payload/tests/staging.test.ts` using small local package archives and an isolated temporary destination.
   - Seed the destination with a stale file and prove a successful stage does not retain it.
   - Include nested and peer-resolved dependencies and prove every resolved package participates in the closure manifest and digest.
   - Mutate a transitive archive, omit a package, add an undeclared package, or change a DSH-family version and expect staging to fail before promotion.
   - Interrupt a fixture stage and prove no partial directory becomes the selected payload.
   - Verify repeated staging from identical inputs produces byte-identical manifests and payload digests.

2. Implement deterministic file and dependency-closure discovery under `packages/payload/src/`.
   - Enumerate the complete installed npm tree used at runtime, preserving package identity and dependency edges.
   - Record every DSH-family package as name, exact version, resolved source, registry integrity, and unpacked-content digest.
   - Compute an additional digest over the complete runtime npm closure so a changed non-DSH transitive dependency cannot pass unnoticed.
   - Hash files by stable relative POSIX path, file kind, executable mode where relevant, length, and content; reject unsafe symlinks, path escape, duplicate paths, unreadable entries, and arbitrary exclusions beyond declared deterministic package-manager metadata.

3. Implement clean staging as a transaction.
   - Resolve/download/install only the exact lock-selected release through the package-manager mechanism established by WP01; no floating metadata lookup may alter the selection.
   - Assemble inside a newly created desktop-owned temporary directory, verify all inputs and produced bytes there, fsync/close required resources, then atomically promote the verified directory.
   - On failure or cancellation, remove only the identity-fenced temporary directory, leave the last verified payload untouched, and never read or write DSH working-tree bytes.

4. Preserve the official product bytes.
   - Copy the official built Host packages, browser application, dynamic plugin assets, and declared runtime files without rewriting source, injecting desktop UI code, applying patches, pruning unknown contributions, or rebuilding a replacement renderer.
   - Derive and record the renderer digest from the exact staged official frontend distribution, including its boot entry and dynamic assets.
   - Make the staged-file manifest independently verifiable without relying on source mtimes or directory enumeration order.

5. Create `scripts/stage-payload.ts` as a narrow CLI over the package API.
   - Default to `config/payload.lock.json` and an application-owned output beneath the repository build/artifact area selected by WP01.
   - Support explicit lock/output/cache arguments for tests without accepting a floating version flag.
   - Print only schema version, exact component versions, platform/architecture, and final digests; redact paths where they could expose a home or checkout location.

6. Observe the focused staging test fail for missing behavior, implement to GREEN, then run the stage twice against the deterministic fixture and compare the resulting manifests byte for byte.

**Files**: `packages/payload/src/{canonical-manifest,npm-closure,stage,index}.ts`, `packages/payload/tests/staging.test.ts` and owned fixtures, and `scripts/stage-payload.ts` (new).

**Validation**:

- The RED test fails because clean transactional staging is absent; the GREEN test passes without weakening assertions.
- Two isolated runs from the same fixture have identical closure, renderer, staged-file, and payload digests.
- Stale, partial, mixed-family, missing-transitive, unexpected-package, and semver-identical/content-different fixtures all fail before atomic promotion.
- A filesystem scan confirms no stage operation changes files outside desktop-owned temporary/cache/output roots.

### Subtask T009: Verify and stage the standard Node runtime and official public DSH binary

**Purpose**: Guarantee that both shell candidates launch the same official public `dsh` binary with the exact standard Node distribution, rather than Electron's runtime, a globally installed tool, or an unpublished internal entry.

**Steps**:

1. Write failing tests in `packages/payload/tests/runtime-entry.test.ts` with fixture Node archives and package manifests.
   - Accept a checksum-matching archive with the declared platform, architecture, version, executable layout, and unpacked-runtime digest.
   - Reject a correct filename with incorrect bytes, a wrong architecture, a symlinked executable escaping the runtime root, a missing executable, or an unexpected runtime layout.
   - Resolve the DSH command only from the staged root package's public `package.json` `bin` declaration and reject a missing, ambiguous, absolute, escaping, or non-file target.
   - Prove `process.execPath`, `$PATH`, a host-global `node`/`dsh`, and an Electron executable cannot satisfy the resolver.

2. Implement safe Node archive verification and extraction in `packages/payload/src/node-runtime.ts`.
   - Select the exact distribution record by explicit platform and architecture from the validated payload lock.
   - Verify the downloaded archive integrity before extraction, compute the canonical unpacked-runtime digest afterward, and avoid persisting cache paths or transport credentials.
   - Extract into the same transactional staging root as T008 with traversal, link, ownership, and executable-mode checks.

3. Implement `packages/payload/src/dsh-entry.ts`.
   - Read the staged `@deepseek-ai/dsh` package manifest through its public package boundary.
   - Resolve the supported public `dsh` bin entry beneath that package and record its relative path and content digest in the payload manifest.
   - Construct a secret-free launch identity containing the staged standard Node executable and public bin path; actual profile/capsule process launch belongs to later work packages.
   - Fail with actionable component diagnostics instead of falling back to a guessed `dist`, `lib`, source, or sibling-checkout path.

4. Extend payload-manifest verification so Node archive integrity, unpacked runtime, public bin, DSH package closure, renderer, and staged-file identities all contribute to one `payloadDigest`.
   - Changing any one component must change the digest and invalidate a manifest still claiming the previous value.
   - The manifest must distinguish source archive integrity from unpacked content digests.

5. Run the focused test in RED and GREEN states, then use the fixture stage to assert the launch identity points entirely inside the verified payload root and remains byte-identical across candidates.

**Files**: `packages/payload/src/{node-runtime,dsh-entry,payload-manifest}.ts` and `packages/payload/tests/runtime-entry.test.ts` with owned fixture archives/manifests (new).

**Validation**:

- Tests first fail because runtime/public-bin verification is missing, then pass with the resolver implemented.
- Wrong bytes, platform, architecture, layout, executable mode, and public-bin declarations fail before a launch identity is returned.
- The returned Node and DSH paths resolve beneath the selected payload root; tests prove there is no global or Electron-runtime fallback.
- Electron and Tauri consumers can compare one payload manifest/digest without candidate-specific staging branches.

### Subtask T010: Fail loudly on unknown payloads and evaluate local upstream checkouts read-only

**Purpose**: Turn every unsupported or mixed component into a pre-boot compatibility failure while allowing a named upstream commit to be evaluated from an isolated clean archive with provably zero working-tree mutation.

**Steps**:

1. Start with failing negative tests in `packages/compatibility/tests/payload/verification.test.ts`.
   - Cover unknown DSH versions, mixed DSH-family versions, missing/extra closure members, dependency-edge drift, renderer mismatch, Node mismatch, public-bin mismatch, adapter mismatch, and a valid-semver payload whose bytes differ.
   - Assert verification returns no bootable payload value on any mismatch.
   - Assert every error identifies the exact failed component and supported identity while remaining content- and secret-free.
   - Include a multi-failure fixture and require deterministic error ordering so CI and release reports are reproducible.

2. Add `packages/payload/tests/local-checkout.test.ts` around a temporary Git fixture.
   - Create tracked, modified, staged, and untracked sentinel states; snapshot status and content hashes before the probe.
   - Ask the probe to evaluate an explicit commit and prove it uses `git archive` or an equivalent read-only export into a desktop-owned temporary directory.
   - Prove all dependency installation, build, and compatibility inspection occurs only inside the exported copy.
   - Verify checkout status and every sentinel hash are identical afterward, including on cancellation and failure, and prove a raw working-tree directory cannot become a release payload source.

3. Implement fail-loud payload verification shared by assembly and launch preflight.
   - Validate persisted JSON before trusting fields, recompute all package/file/runtime/renderer/bin digests from staged bytes, compare the exact supported set, and return an opaque verified-payload handle only on complete success.
   - Separate unsupported-version, mixed-family, integrity, incomplete-closure, unsafe-path, dirty-source, and internal-I/O categories with stable codes and recommended next actions.
   - Do not continue in degraded mode, repair the payload silently, fetch a replacement automatically, or defer a known mismatch until Host startup.

4. Implement the local checkout compatibility evaluator.
   - Accept an explicit checkout path and commit/revision solely as a read-only architecture oracle.
   - Resolve the commit without checkout/reset/clean/stash/submodule mutation, export that commit into an identity-fenced temporary directory, and derive a `clean-archive` identity from commit SHA plus archive digest.
   - Run compatibility probes only against the export, clean it up safely, and compare a before/after working-tree fingerprint as defense-in-depth evidence.
   - If the archive lacks required built public artifacts or a supported seam, fail actionably; never borrow dirty build outputs or stage production directly from the checkout unless a separately reviewed clean-archive identity is selected.

5. Create `scripts/verify-payload.ts` to validate a staged payload and `scripts/verify-upstream-compat.ts` to run the read-only archive probe.
   - Both CLIs exit nonzero on unknown/mixed/mutated input and emit deterministic redacted summaries.
   - The upstream CLI records checkout commit, archive digest, compatibility result, and before/after equality without persisting the checkout path.
   - Neither CLI writes outside explicitly supplied desktop-owned output/temp paths.

6. Execute RED and GREEN focused tests, then run the upstream probe against the sibling checkout while capturing `git status --short` before and after. The two status outputs must be identical even if the sibling checkout already contains unrelated work.

**Files**: `packages/compatibility/src/payload/verify.ts`, `packages/compatibility/tests/payload/verification.test.ts`, `packages/payload/src/local-checkout.ts`, `packages/payload/tests/local-checkout.test.ts`, `scripts/verify-payload.ts`, and `scripts/verify-upstream-compat.ts` (new).

**Validation**:

- Every mixed, unknown, missing, extra, and byte-mismatched fixture fails before a bootable handle exists.
- Failure output is deterministic and names expected/observed identities without secrets, user content, unrestricted environment data, or raw checkout paths.
- Local probe tests preserve tracked, staged, modified, and untracked fixture state exactly on success, failure, and cancellation.
- The real sibling-checkout before/after status comparison is byte-identical, and no upstream file appears in this repository's staged payload.

### Subtask T011: Enforce upgrade-diff confinement and document the compatibility workflow

**Purpose**: Make routine DSH upgrades a lock-and-gate operation whose required source adaptation remains inside the declared compatibility layer, with any broader architecture change rejected rather than silently spread through shell code.

**Steps**:

1. Add failing policy tests in `packages/compatibility/tests/payload/upgrade-boundary.test.ts`.
   - Accept a version-selection change plus compatibility declaration/tests/evidence, including no code change when every supported seam is preserved.
   - Reject candidate upgrade diffs that change `apps/**`, generic shell lifecycle code, product-specific renderer bridge methods, upstream source, or other paths outside the declared compatibility adaptation surface.
   - Require an explicit architecture-decision classification when an upstream change cannot be contained; the default result remains unsupported/no-release.
   - Prove path normalization cannot bypass the allowlist through absolute paths, `..`, symlinks, case variants, or renamed files.

2. Implement a versioned upgrade comparison under `packages/compatibility/src/payload/upgrade-diff.ts`.
   - Compare current and candidate identities field by field, report added/removed/changed closure members and changed renderer/runtime/bin/seam facts, and classify each as compatible, adapter-change-required, or unsupported.
   - Keep the default code adaptation allowlist in the compatibility declaration rather than scattering version checks through candidates.
   - Treat lock/evidence as reviewed data changes, require production source edits to remain in the declared compatibility layer, and never auto-edit, patch DSH, or downgrade unsupported results to warnings.

3. Extend `scripts/verify-upstream-compat.ts` with a deterministic candidate-upgrade mode.
   - Accept explicit current and candidate identities plus an optional Git diff range supplied by CI.
   - Validate changed paths against the declared compatibility-layer policy and report every out-of-bound path.
   - Exit nonzero for an unknown payload, failed seam probe, unclassified manifest change, missing negative control, or adaptation outside the allowed layer.
   - Emit a stable machine-readable result suitable for later parity/release gates without including source contents or local absolute paths.

4. Add end-to-end tests that simulate three releases.
   - The current exact release passes unchanged.
   - A compatible candidate changes the selection, regenerates identity, and passes without shell business changes.
   - An incompatible candidate fails before Host work and identifies the affected seam; a simulated change under `apps/electron/**` is independently rejected by the upgrade-boundary check.
   - Confirm the test harness operates on copies/archives and never writes to an upstream checkout.

5. Write `docs/compatibility.md` as current-state operational documentation.
   - Explain the atomic DSH/npm closure/renderer/Node/bin/adapter identity, clean staging transaction, exact verification commands, and stable diagnostic categories.
   - Document the read-only local-checkout flow and explicitly prohibit workspace membership, upstream mutation, staging from working-tree bytes, unpublished internal imports, forks, monkey-patches, and `patch-package`.
   - Document the upgrade sequence: change the exact selection, stage cleanly, verify identities and seams, run parity/lifecycle/security gates, inspect the compatibility-layer-only diff, and reject or escalate an architecture seam change.
   - State that successful semver comparison alone is never sufficient and that no-selection/unsupported is a legitimate safe result.

6. Run the upgrade policy test in RED and GREEN states, execute all WP02 focused tests, and run the documented fixture commands from a clean standalone checkout. Verify the documentation and scripts agree on flags, exit behavior, output fields, and no-upstream-write guarantees.

**Files**: `packages/compatibility/src/payload/upgrade-diff.ts`, `packages/compatibility/tests/payload/upgrade-boundary.test.ts`, `scripts/verify-upstream-compat.ts`, and `docs/compatibility.md` (new or expanded).

**Validation**:

- The RED policy test demonstrates that an out-of-layer application change is initially accepted or unclassified; the GREEN test rejects it deterministically.
- Current, compatible-candidate, incompatible-candidate, and out-of-bound-diff fixtures produce the four expected results and exit codes.
- A repository scan finds no DSH source copy, patch-package artifact, shell-specific DSH business version switch, or reference that permits an upstream write.
- The documented staging, verification, local probe, and upgrade commands execute against fixtures and produce only redacted identity evidence.

## Definition of Done

- [ ] T007–T011 each have an observed acceptance-test RED state followed by focused GREEN evidence.
- [ ] `config/payload.lock.json` selects exact DSH and standard Node identities without ranges, mutable tags, secrets, or local working-tree paths.
- [ ] The manifest covers the complete resolved npm runtime closure, every exact DSH-family package, official renderer, public DSH bin, standard Node archive/unpacked runtime, adapter, and canonical staged files.
- [ ] Clean staging is transactional, deterministic, removes stale content, never promotes partial output, and never reads or writes upstream working-tree bytes.
- [ ] Verification rejects unknown, mixed, incomplete, unexpected, semver-identical/content-different, renderer-mismatched, runtime-mismatched, and adapter-mismatched payloads before Host boot.
- [ ] Node and DSH launch paths resolve only inside the verified payload; there is no Electron, global executable, or unpublished-internal fallback.
- [ ] Local checkout evaluation exports an explicit commit into desktop-owned temporary storage and leaves all tracked, staged, modified, and untracked upstream state unchanged.
- [ ] Upgrade analysis accepts preserved seams, confines required code adaptation to the declared compatibility layer, and fails or escalates every broader architecture change.
- [ ] All diagnostic and machine-readable outputs omit credentials, prompts, responses, session content, unrestricted environment values, and raw local checkout paths.
- [ ] `docs/compatibility.md` accurately documents commands, invariants, failure modes, and the read-only/upstream-no-write policy.
- [ ] All edits remain inside the WP02 `owned_files`; root manifests and upstream DSH files are untouched.

## Risks

- Package managers can resolve exact installed versions from ranged manifests while still changing the closure after a metadata refresh. Mitigate this with the checked-in exact selection, frozen root lock, registry integrity checks, complete closure/file digests, and clean repeated-stage tests.
- Registry tarball integrity proves the archive, not the extracted runtime tree. Keep archive integrity and canonical unpacked-content digests as separate required fields.
- A local checkout probe can accidentally mutate state through build tools, Git commands, package-manager caches, submodules, or hooks. Export the named commit first, run every tool only in the export, disable repository-local hooks/config where applicable, and assert before/after fingerprints.
- Overly broad path allowlists can let an upstream upgrade leak business knowledge into shell candidates. Keep version knowledge in the compatibility declaration, test traversal/rename cases, and treat an uncontained seam change as unsupported pending an explicit architecture decision.
- Excessively aggressive file normalization can hide meaningful byte differences. Canonicalize ordering and representation only; preserve file kinds, executable modes, relative paths, lengths, and contents in the digest.

## Reviewer Guidance

Review identity completeness before implementation elegance. Trace one staged byte from its locked source through registry/archive integrity, unpacked file hashing, closure membership, renderer/runtime/bin digests, and final `payloadDigest`; then mutate that byte without changing semver and confirm verification fails before a bootable handle is returned.

Audit every filesystem and process boundary. Staging and local-checkout probes must operate only in identity-fenced desktop-owned directories, cleanup must never use a broad unresolved target, and the sibling upstream status/content fingerprint must remain unchanged on success, failure, and cancellation.

Finally, inspect the upgrade gate adversarially. A candidate that needs application or business-bridge changes must not pass merely because its version is newer, and a compatible candidate must not require edits outside the declared compatibility layer. Confirm error and evidence outputs are useful while containing no secret, user content, unrestricted environment value, or absolute checkout path.

## Activity Log

- 2026-08-14T23:47:24Z – codex – shell_pid=6716 – Assigned agent via action command
