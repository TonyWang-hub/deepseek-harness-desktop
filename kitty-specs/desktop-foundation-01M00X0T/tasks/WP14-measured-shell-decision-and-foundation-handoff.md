---
work_package_id: WP14
title: Measured Shell Decision and Foundation Handoff
dependencies:
- WP13
requirement_refs:
- FR-012
- FR-013
- FR-014
- NFR-007
- NFR-008
- C-006
- C-007
- C-008
- C-009
tracker_refs: []
planning_base_branch: codex/desktop-foundation
merge_target_branch: codex/desktop-foundation
branch_strategy: Planning artifacts for this mission were generated on codex/desktop-foundation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into codex/desktop-foundation unless the human explicitly redirects the landing branch.
subtasks:
- T077
- T078
- T079
- T080
- T081
agent: codex
history: []
agent_profile: architect-alphonso
authoritative_surface: config/selected-shell.json
create_intent:
- config/selected-shell.json
- scripts/launch-selected-shell.ts
- docs/decision.md
- docs/quickstart.md
- docs/foundation-handoff.md
execution_mode: code_change
model: ''
owned_files:
- evidence/decision/**
- config/selected-shell.json
- scripts/launch-selected-shell.ts
- docs/decision.md
- docs/quickstart.md
- docs/foundation-handoff.md
role: architect
tags: []
---

# Work Package Prompt: WP14 – Measured Shell Decision and Foundation Handoff

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `architect-alphonso`
- **Role**: `architect`
- **Agent/tool**: `codex`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Turn WP13's complete, validated evidence into the deterministic foundation-shell outcome: Electron, Tauri, or explicitly no candidate. Commit the exact evaluator inputs and derived decision, make one generic launch entry select only that outcome, publish an operator workflow, and hand the accepted foundation to separately scoped productization missions.

Start this implementation lane with:

```sh
spec-kitty agent action implement WP14 --agent codex
```

## Context

WP11 owns capability and plugin parity evidence, WP12 owns lifecycle, privacy, and failure-mode gates, and WP13 owns raw benchmark validation, aggregation, and the deterministic evaluator. WP14 may validate and bind those outputs, but it must not reinterpret metrics, change thresholds, repair samples, waive failures, or choose from preference.

Invalid, incomplete, stale, or tampered evidence is an evaluation error, not a `none` outcome. `none` is legitimate only when complete valid inputs prove that neither candidate passes every hard gate. Electron remains the compatibility baseline when both pass unless every predeclared Tauri replacement threshold passes.

C-009 is absolute in this mission. Do not add or use signing keys, signing or notarization automation, updater code or feeds, crash-report upload, public distribution artifacts, release hosting, or any claim that the foundation is publicly releasable. Unsigned local packaged-smoke evidence may be referenced only as foundation evidence.

### Decision and scope invariants

- The evaluator input manifest is the sole authority for admitted evidence.
- Content digests bind every input, evaluator, report, configuration, and handoff claim.
- Missing or tampered evidence exits nonzero and never produces a selectable outcome.
- `none` requires complete valid evidence and explicit remediation inputs.
- Capability, privacy, lifecycle, integrity, responsiveness, and startup remain hard gates.
- Memory comparison occurs only after both candidates pass every hard gate.
- The selected-shell configuration is derived evidence, not an operator preference.
- The generic launcher delegates only to existing Electron or Tauri entries.
- Existing DSH homes remain upstream-owned and are never migrated by this package.
- Follow-on platform and release missions must rerun every affected gate.
- C-009 exclusions remain outside code, configuration, evidence, and documentation.
- No winner must remain visible as an actionable remediation state, not be rewritten as a preference.
- The launcher must bind only committed decision evidence and never inspect live benchmark results.
- Handoff prose must distinguish a development-ready foundation from a publicly releasable product.

### Subtask T077: Validate the complete decision evidence set

**Purpose**: Admit only complete, untampered, identity-matched WP11–WP13 evidence to the final evaluator.

**Steps**:

1. RED: copy the candidate evidence to a temporary root, remove one required artifact, alter one byte, change one digest, and omit one hard-gate row; require a deterministic nonzero validation result for each case.
2. Define `evidence/decision/evaluator-inputs.json` as a canonical manifest of every exact input path, schema version, content digest, producing revision, payload/profile/fixture identity, environment identity, policy identity, candidate-order seed, and evaluator digest.
3. Require Electron and Tauri to have matched payload bytes, fixtures, settings, reference environment, sample counts, developer-tool state, scenario corpus, and complete attributable-process membership.
4. Require explicit payload, parity, privacy, no-TCP, lifecycle, integrity, responsiveness, startup, evidence-validity, and required negative-control results for each candidate.
5. Reject unknown schemas, duplicate or extra candidate records, missing samples, invalid runs admitted to aggregation, stale derived reports, path escape, digest mismatch, manual outcome fields, and absent provenance.
6. Scan decision inputs for credentials, tokens, socket or home paths, prompts, responses, unrestricted environment values, and C-009 artifacts; reject any match without rewriting evidence.
7. GREEN: validate the committed evidence twice from clean checkouts and require the same canonical input-manifest digest and ordered diagnostics.

**Files**: `evidence/decision/evaluator-inputs.json` and `evidence/decision/decision-manifest.json` (new).

**Validation**: The WP13 validator accepts the untouched manifest twice, while every missing, altered, stale, secret-bearing, or hard-gate-incomplete temporary input fails before evaluation.

### Subtask T078: Reproduce and commit the deterministic shell decision

**Purpose**: Derive exactly Electron, Tauri, or no candidate from the validated inputs without human override.

**Steps**:

1. RED: seed threshold-edge fixtures for one passing candidate, two failing candidates, Tauri below and exactly at each replacement threshold, and a hand-edited outcome; require the evaluator to follow policy or reject the edit.
2. Run the exact WP13 evaluator identified by T077 over only the canonical manifest; do not recalculate metrics in documentation or a WP14-only decision path.
3. Apply hard gates first: select the sole passing candidate, or emit `none` with remediation inputs when neither passes.
4. When both pass, select Tauri only with at least 25% aggregate p95 footprint improvement, no scenario over 5% worse, no response/startup hard-budget miss, and no response/startup regression over 10%; otherwise select Electron.
5. Commit `decision-report.json` with input and evaluator digests, every hard-gate result, normalized comparisons, threshold results, outcome, supporting run ids, and required remediation inputs for `none`.
6. Generate `docs/decision.md` from the report with the measured outcome, evidence links, deterministic rule, limitations, and no public-release claim; prohibit manual outcome edits.
7. GREEN: rerun from the committed input manifest and require byte-identical canonical report content plus the same documentation outcome.

**Files**: `evidence/decision/decision-report.json`, `evidence/decision/decision-manifest.json`, and `docs/decision.md` (new).

**Validation**: Two clean evaluator runs reproduce the committed report digest and outcome; threshold-edge controls produce the declared result, and edited evidence or prose cannot change it.

### Subtask T079: Bind the selected shell to one generic launcher

**Purpose**: Expose the measured outcome through minimal configuration and launch routing without creating a third shell.

**Steps**:

1. RED: test unknown candidates, `none`, missing config, stale report digest, payload mismatch, path injection, and edited decision fields; require loud failure before any candidate starts.
2. Define `config/selected-shell.json` with a schema version, `electron`, `tauri`, or `none`, decision-report digest, evaluator-input digest, payload digest, and generated provenance.
3. Make `scripts/launch-selected-shell.ts` validate that config against committed decision evidence before mapping `electron` to the existing Electron entry or `tauri` to the existing Tauri entry.
4. Forward documented profile, DSH-home, workspace, fixture, and diagnostic arguments without interpreting DSH product behavior or exposing secrets.
5. Keep the launcher a small allowlisted mapping. Do not copy candidate code, add another renderer/proxy/supervisor, synthesize a fallback, or silently prefer Electron when outcome is `none`.
6. For `none`, exit nonzero before payload or Host launch and print the decision evidence location plus redacted remediation identifiers.
7. GREEN: prove the selected candidate receives unchanged arguments and identity, while every invalid or no-selection configuration starts zero candidate and Host processes.

**Files**: `config/selected-shell.json` and `scripts/launch-selected-shell.ts` (new).

**Validation**: Direct launcher smokes start only the evidence-selected existing shell; tamper and `none` controls fail loudly with zero owned process residue.

### Subtask T080: Publish the foundation operator workflow

**Purpose**: Let an operator reproduce the decision, launch safely, inspect diagnostics, and evaluate an upstream upgrade without hidden repository knowledge.

**Steps**:

1. Write `docs/quickstart.md` as an ordered workflow with pinned prerequisites, frozen install, payload verification, hard gates, evidence validation, evaluator reproduction, and generic selected-shell launch.
2. Include separate clean-home and supported existing-home runs; inventory and hash the existing home before and after, compare with the browser-baseline allowance, and forbid silent migration or candidate-only durable files.
3. Document visible startup phases, Retry, Reveal Redacted Log Location, Safe Exit, report locations, stable failure codes, and canary-based diagnostic privacy checks.
4. Document `none` as a blocked launch with remediation evidence, never as permission to choose a shell manually or bypass a hard gate.
5. Provide the upstream compatibility workflow: change one exact payload selection, stage and verify its full closure, run compatibility/parity/lifecycle/benchmark gates, and confirm any local upstream oracle remains byte-for-byte untouched.
6. Keep credentials, signing identities, notarization, update endpoints, crash-upload endpoints, public hosting, and release instructions out of every command and example.
7. Verify every documented command from a clean checkout and record only commands actually run plus redacted outcomes.

**Files**: `docs/quickstart.md` (new).

**Validation**: A clean operator run reproduces the evidence outcome, launches only a selected shell, preserves the existing-home fixture, and locates useful canary-clean diagnostics; `none` and incompatible upgrades stop before user work.

### Subtask T081: Publish the foundation handoff and follow-on missions

**Purpose**: Close the foundation with traceable evidence and explicit future ownership without importing product-release work into this mission.

**Steps**:

1. Summarize the payload, compatibility adapter, candidate, parity, lifecycle, privacy, benchmark, decision, launcher, existing-home, diagnostic, and unsigned local packaged-smoke evidence by stable path and digest.
2. State the accepted selected-shell or `none` outcome, open remediation inputs, supported macOS arm64 foundation limits, compatibility seams, operator obligations, and conditions that invalidate the decision.
3. Define a follow-on macOS signing/notarization mission that owns hardened-runtime policy and external credentials, with no key material added here.
4. Define separate secure-updater and crash-report consent/upload missions, including integrity, rollback, privacy, and operator-control gates, while implementing neither facility here.
5. Define a public-release mission for distribution hardening, hosting, release artifacts, and release claims only after its preceding security gates pass.
6. Define Windows packaged gates for named-pipe/WebView2 carriage, process ownership, installer/upgrade/uninstall behavior, parity, privacy, packaged smoke, signing, and whole-process measurement.
7. Define Linux packaged gates for private carriage, WebKitGTK/package dependencies, process ownership, install/upgrade/uninstall behavior, parity, privacy, packaged smoke, signing, and measurement.
8. Require each follow-on mission to consume the selected foundation by digest and rerun affected hard gates; a `none` outcome blocks productization until a remediation mission produces new valid evidence.

**Files**: `docs/foundation-handoff.md` (new).

**Validation**: The handoff links every accepted claim to committed evidence, names all follow-on missions and gates, and contains no key, updater, crash-upload, public artifact, hosting action, or public-release assertion.

## Definition of Done

- [ ] T077–T081 are complete against one immutable evaluator-input manifest.
- [ ] Missing, stale, altered, incomplete, or secret-bearing evidence stops before evaluation.
- [ ] The committed evaluator reproduces Electron, Tauri, or legitimate `none` byte-for-byte.
- [ ] `config/selected-shell.json` is generated from and bound to the committed decision digests.
- [ ] The generic launcher starts only the selected existing shell and fails loudly for `none` or tampering.
- [ ] Clean-home and existing-home operator workflows preserve DSH authority and durable compatibility.
- [ ] Diagnostics remain useful, redacted, deterministic, and free of seeded prohibited values.
- [ ] The upgrade workflow accepts only an exact verified payload and leaves an upstream oracle untouched.
- [ ] The handoff defines macOS signing/notarization, updater, crash-report, public-release, Windows, and Linux follow-on missions.
- [ ] C-009 remains enforced: this mission contains no signing key, updater, crash upload, public artifact, hosting action, or release claim.

## Reviewer Guidance

Reproduce the input-manifest digest and evaluator report before reading the selected-shell config. Then tamper one input, exercise `none`, trace launcher routing, run the existing-home workflow, and inspect every handoff claim against evidence.

Reject manual outcome edits, invalid evidence converted to `none`, implicit fallback, copied candidate code, third-shell behavior, secret-bearing diagnostics, or any C-009 productization work or public-release claim.
