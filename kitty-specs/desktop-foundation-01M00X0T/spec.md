# Feature Specification: Desktop Foundation and Shell Decision

**Mission ID**: `01M00X0TZEQ7B6C8RYN00R22BJ`  
**Mission type**: Software development  
**Status**: Approved for planning  

## Intent Summary

Create the first independently releasable foundation for a DeepSeek Harness desktop application, starting with macOS. The application must preserve the complete official DSH browser experience and plugin surface while adding dependable desktop startup, shutdown, recovery, private local communication, and packaging boundaries. Two viable desktop-shell candidates will carry the same DSH payload and be judged by capability parity first, then whole-application memory, long-session and streaming responsiveness, and startup time. This mission ends with a runnable vertical slice and an evidence-backed production-shell decision; it does not end with a framework chosen by preference.

## Actors

- **DSH user**: Runs agent sessions, tools, terminals, approvals, settings, attachments, models, and plugins from a desktop application.
- **Existing DSH user**: Already has a DSH home, profiles, settings, credentials, plugins, and sessions that must remain usable.
- **Plugin author**: Publishes a client contribution that works in the official browser application and expects the desktop application to load it without a desktop-specific rewrite.
- **Release operator**: Selects an upstream DSH version, builds a coherent desktop payload, runs compatibility and performance gates, and publishes evidence.
- **Desktop contributor**: Changes the shell, supervisor, compatibility adapter, or tests without forking upstream DSH behavior.

## Domain Language

| Term | Meaning |
|---|---|
| Official DSH payload | An exact, unmodified upstream DSH release containing its Host runtime, browser application, first-party contributions, and declared assets. |
| Desktop shell | The native application layer responsible for windows, lifecycle, private communication, system integration, and release packaging. It does not redefine DSH product behavior. |
| Host | The standard DSH runtime process that owns sessions, plugins, tools, subprocesses, settings, credentials, and other server-side capabilities. |
| Renderer | The official DSH browser application and its dynamically loaded client contributions, presented inside the desktop window. |
| Compatibility adapter | The smallest desktop-owned surface that connects a supported official DSH payload to desktop lifecycle and transport facilities. |
| Capability parity | Every capability exposed by the supported official browser application is available in the desktop application with equivalent observable behavior. |
| Parity inventory | A versioned list derived from the supported official application manifest and representative user flows, used to prove capability parity. |
| Reference scenario | A deterministic user flow and fixture run against the official browser baseline and each desktop candidate. |
| Whole-application memory | Physical memory attributable to the complete desktop process tree, including shell, renderer processes, Host, and helpers. |
| Prompt-ready | The window is visible, responsive, and accepts input; Host readiness may complete asynchronously if the interface clearly reports it. |
| Production shell | The candidate selected only after all hard parity and security gates pass and the weighted performance decision is recorded. |

## User Scenarios & Testing

### User Story 1 — Run the complete official experience on macOS (Priority: P1)

A DSH user installs or launches the desktop development build, opens an existing or new workspace, creates or resumes a session, streams a response, uses tools and terminal output, answers approvals and questions, and changes supported settings without leaving the application.

**Independent test**: Run the parity inventory against the official browser baseline and each candidate using the same pinned payload and deterministic fixture. Compare observable state, transcript, interactions, settings, and loaded contributions.

**Acceptance scenarios**:

1. **Given** a clean user data directory and a supported payload, **when** the user launches the application, **then** a responsive shell appears, Host readiness is visible, and the user can create a real session without installing Node.js or DSH separately.
2. **Given** a session that streams assistant text, tool calls, terminal output, a diff, a plan, an approval, and an ask-user prompt, **when** the fixture is replayed, **then** the desktop result and interaction outcomes match the browser baseline.
3. **Given** a supported existing DSH home, **when** the application starts, **then** profiles, settings, credentials references, plugins, workspaces, and resumable sessions remain available without migration loss.
4. **Given** an unavailable Host, **when** the shell becomes visible, **then** it remains responsive and reports actionable startup progress or failure instead of presenting a blank or frozen window.

### User Story 2 — Load browser-compatible plugins unchanged (Priority: P1)

A plugin author installs a normal DSH plugin whose Host and browser contributions work in the supported official application. The desktop application loads those contributions without a desktop fork or a separate UI implementation.

**Independent test**: Install an out-of-tree fixture plugin that contributes Host behavior, a dynamic browser module, and a visible interaction; verify register, use, unload, reload, and upgrade behavior through public user surfaces.

**Acceptance scenarios**:

1. **Given** a compatible third-party plugin, **when** DSH boots inside the desktop application, **then** its Host capability and browser contribution are discovered and usable without modifying the plugin.
2. **Given** the plugin is disabled or removed, **when** the profile reloads, **then** its contribution disappears cleanly and other capabilities remain available.
3. **Given** a plugin uses a native Node add-on supported by the pinned runtime, **when** Host loads it, **then** it uses the standard runtime compatibility expected by upstream rather than a shell-specific runtime ABI.

### User Story 3 — Stay responsive during long sessions and heavy streams (Priority: P1)

A user keeps a session open for hours while output streams, tools emit large blocks, and the user continues typing, scrolling, approving actions, cancelling work, and switching sessions.

**Independent test**: Replay the declared long-history and sustained-stream fixtures while measuring input-to-paint latency, event ordering, final transcript equality, memory growth, cancellation latency, and recovery after switching sessions.

**Acceptance scenarios**:

1. **Given** a history fixture containing 100,000 ordered events, **when** it is loaded and the user navigates the active conversation, **then** the application remains interactive and produces the same final conversation state as the browser baseline.
2. **Given** sustained output at the declared low, normal, and flood rates, **when** the user types, scrolls, cancels, or approves, **then** control interactions are not starved by transcript traffic and all accepted stream data remains ordered.
3. **Given** a completed long session, **when** the user switches to another session and the retention window is released, **then** releasable client memory is reclaimed and retained state does not continue growing from the inactive session.
4. **Given** a renderer reload during an active session, **when** it reconnects, **then** it resynchronizes from authoritative Host state without duplicated actions or transcript loss.

### User Story 4 — Recover safely from process failure (Priority: P2)

A user encounters a renderer or Host crash. The desktop application explains what happened, preserves durable user data, restarts only the failed owned process when safe, and offers a clear recovery path when automatic recovery is not safe.

**Independent test**: Inject renderer termination, Host termination, malformed frames, a failed profile boot, and application shutdown at defined lifecycle points; verify process ownership, state preservation, bounded restart behavior, and cleanup.

**Acceptance scenarios**:

1. **Given** the renderer exits unexpectedly, **when** the shell recreates it, **then** the Host is not duplicated and the active session can resynchronize.
2. **Given** the Host exits unexpectedly, **when** restart policy permits recovery, **then** only the owned Host process tree is restarted with bounded backoff and the user sees status throughout.
3. **Given** repeated Host startup failure, **when** the retry limit is reached, **then** automatic restarts stop and diagnostics identify the failing phase without exposing secrets or session content.
4. **Given** normal application exit or operating-system termination, **when** teardown runs, **then** owned child processes and private communication resources close and unrelated DSH or Node processes remain untouched.

### User Story 5 — Upgrade upstream with small, explicit adaptation (Priority: P2)

A release operator evaluates a new DSH release. A compatibility run identifies whether the exact payload works unchanged, needs a change confined to the adapter, or is unsupported. The application never silently runs an unknown combination.

**Independent test**: Run the compatibility suite for the current pin, an intentionally unsupported version, and a compatible candidate version; inspect the resulting matrix and build decision.

**Acceptance scenarios**:

1. **Given** the currently supported exact version, **when** the payload is assembled, **then** all compatibility checks pass without modifying upstream files.
2. **Given** a candidate upstream release that preserves the supported seams, **when** the version pin changes, **then** the same parity suite can approve it without shell-specific business changes.
3. **Given** an unknown or incompatible release, **when** assembly or launch is attempted, **then** it fails before user work begins with the supported versions and failed checks clearly reported.
4. **Given** an adaptation is required, **when** it is reviewed, **then** the change is confined to the compatibility surface or accompanied by an explicit architecture decision explaining why that boundary changed.

### User Story 6 — Select the production shell from reproducible evidence (Priority: P2)

A maintainer compares two desktop candidates built from the same payload and fixture corpus. Capability and security are hard gates; among passing candidates, memory has the highest weight, followed by long-session responsiveness and startup.

**Independent test**: Build both candidates from one revision, run the declared benchmark protocol on the same reference machine for the required sample count, and reproduce the decision from committed raw results and rules.

**Acceptance scenarios**:

1. **Given** either candidate misses a parity or security requirement, **when** results are evaluated, **then** that candidate cannot be selected regardless of performance.
2. **Given** both candidates pass hard gates, **when** whole-application results are compared, **then** the lower-memory candidate is selected only according to the predeclared threshold and regression rules.
3. **Given** the lower-memory candidate does not clear the material-improvement threshold, **when** the decision is made, **then** the compatibility baseline is selected to avoid an unjustified long-term maintenance tax.
4. **Given** the benchmark is rerun, **when** environment and payload identifiers match, **then** the decision inputs and aggregation are reproducible from committed artifacts.

## Requirements

### Functional Requirements

| ID | Status | Requirement | Acceptance evidence |
|---|---|---|---|
| FR-001 | Must | The project shall produce a standalone macOS application that includes every runtime component required for a supported DSH session. | A clean reference Mac can run the primary reference scenario without a separately installed DSH or Node runtime. |
| FR-002 | Must | The application shall present the exact supported official renderer and discover its first-party and dynamic client contributions. | The parity inventory and out-of-tree plugin scenario pass without a desktop-specific plugin build. |
| FR-003 | Must | The application shall run the official Host with the user's selected profile, workspace, settings, credentials references, plugins, and durable session store. | Clean and existing-home reference scenarios pass with identical observable Host behavior. |
| FR-004 | Must | The desktop-owned connection shall carry all official API, RPC, streaming, reconnect, and cancellation traffic through a generic versioned interface rather than one desktop method per product capability. | Adding or replaying an inventory capability requires no new shell-specific business channel, and order/cancellation tests pass. |
| FR-005 | Must | Production data traffic shall remain private to processes owned by the application and shall not create an unauthenticated local network service. | Socket audit records no application-created TCP listener throughout all reference scenarios. |
| FR-006 | Must | The shell shall supervise exactly one Host instance per application instance, expose startup state, and enforce bounded restart and teardown rules. | Lifecycle fault-injection scenarios pass without duplicate or orphaned owned processes. |
| FR-007 | Must | The renderer shall be able to reload and resynchronize from authoritative Host state without replaying completed user actions. | Active-stream reload produces the same final state and action counts as the uninterrupted baseline. |
| FR-008 | Must | The application shall preserve supported existing DSH homes and shall not rewrite, delete, or silently migrate durable data during this mission. | A before/after inventory and content hash of durable fixtures shows no unintended change. |
| FR-009 | Must | The payload assembler shall select one exact supported upstream DSH release and one exact supported runtime as an atomic compatibility set. | Build metadata identifies the set and rejects mixed or unknown versions. |
| FR-010 | Must | The project shall maintain a generated parity inventory covering every first-party browser contribution plus representative cross-cutting user flows. | Inventory generation is reproducible from the pinned payload and every item maps to an automated or recorded acceptance check. |
| FR-011 | Must | The project shall provide a fixture third-party plugin that proves unchanged Host and dynamic client contribution behavior. | Install, use, unload, reload, and upgrade scenarios pass in the official baseline and both candidates. |
| FR-012 | Must | Both shell candidates shall consume the same assembled payload, compatibility adapter, lifecycle scenarios, parity inventory, and benchmark fixtures. | Build manifests and test reports contain matching payload and fixture digests. |
| FR-013 | Must | Benchmark tooling shall capture whole-application process membership, memory, responsiveness, startup phases, event integrity, and environment identity for each sample. | Raw per-sample records can be aggregated without manually reconstructing process membership or environment data. |
| FR-014 | Must | A deterministic decision report shall select or reject each candidate using the approved hard gates and threshold rules. | Re-running the evaluator over committed raw inputs produces the committed decision. |
| FR-015 | Must | Unsupported payloads and failed compatibility checks shall stop before user work begins and provide actionable diagnostics. | Negative fixtures fail at assembly or startup with the exact unsupported component and supported range identified. |
| FR-016 | Must | Diagnostics shall identify lifecycle phases, component versions, exits, restart decisions, and transport state without recording credentials, prompts, responses, session content, or unrestricted environment data. | Redaction tests and fault scenarios demonstrate useful reports with prohibited values absent. |
| FR-017 | Should | The foundation shall expose a development mode that evaluates a local upstream checkout without altering that checkout. | A local-checkout compatibility run completes while upstream remains byte-for-byte unchanged. |
| FR-018 | Should | The shell shall show a responsive window before Host readiness and allow retry, reveal-log-location, and safe-exit actions after boot failure. | Delayed and failed boot scenarios remain interactive and offer all three actions. |

### Non-Functional Requirements

| ID | Status | Requirement | Measurement |
|---|---|---|---|
| NFR-001 | Must | Capability parity shall be 100% for the pinned first-party parity inventory, with the fixture third-party contribution unchanged. | Zero missing, degraded, skipped, or desktop-reimplemented inventory items at the release gate. |
| NFR-002 | Must | During sustained reference streams, input-to-next-paint latency shall be at most 50 ms at p95 and below 100 ms at p99. | At least 30 measured runs per declared stream class on the reference Mac. |
| NFR-003 | Must | No renderer or shell main-loop stall shall last 250 ms or longer during long-history, stream-flood, large-tool-output, cancellation, or approval scenarios. | Instrumented stall count equals zero across the benchmark corpus. |
| NFR-004 | Must | Warm prompt-ready launch shall complete within 1.5 seconds at p95 and cold prompt-ready launch within 3 seconds at p95 on the reference Mac. | At least 30 warm and 30 cold launches with boot phases reported separately. |
| NFR-005 | Must | Stream events shall remain ordered and complete, and cancellation or approval control traffic shall reach Host within 100 ms at p95 under the highest declared output load. | Sequence, final-state hash, and control-latency assertions pass for every flood sample. |
| NFR-006 | Must | Retained client state shall remain bounded by the declared active-history policy, show no superlinear growth across the 100,000-event fixture, and release inactive-session state after switching. | Retained object/event counts and whole-application memory slopes remain within predeclared ceilings, with reclamation demonstrated after quiescence. |
| NFR-007 | Must | A candidate may become the production shell only after all parity, privacy, lifecycle, integrity, and responsiveness gates pass. | The decision evaluator treats any hard-gate failure as disqualifying. |
| NFR-008 | Must | The lower-memory candidate shall replace the compatibility baseline only if its whole-application p95 memory is at least 25% lower across the representative idle, long-history, sustained-stream, and post-switch scenarios, with no material response or launch regression. | Candidate comparison report applies the 25% threshold to complete process-tree measurements for every required scenario. |
| NFR-009 | Must | Automatic recovery shall use bounded exponential backoff, stop after the declared retry budget, and never create concurrent Host instances. | Fault-injection tests observe the configured retry count, timing bounds, and maximum Host count of one. |
| NFR-010 | Must | A compatible upstream candidate shall be evaluable by changing the version selection and rerunning automated gates; required code edits shall remain confined to the compatibility adapter unless an approved architecture decision expands the boundary. | Candidate-upgrade diff and test report meet the boundary rule. |
| NFR-011 | Must | No secret or user conversation content shall appear in standard logs, crash diagnostics, benchmark records, or build metadata. | Seeded canary values are absent from all collected artifacts. |
| NFR-012 | Must | The vertical slices and core test corpus shall run on macOS arm64; platform-neutral packages shall also pass in Linux and Windows CI environments before this mission is accepted. | Required CI jobs and packaged macOS smoke evidence are green. |

### Constraints

| ID | Status | Constraint |
|---|---|---|
| C-001 | Fixed | The desktop product lives in its own repository and release lifecycle; the upstream DSH repository is read-only to this mission. |
| C-002 | Fixed | macOS arm64 is the first runnable and measured platform. Windows and Linux product packaging are subsequent missions, while shared code remains cross-platform. |
| C-003 | Fixed | Upstream DSH is consumed as an exact versioned dependency or read-only local checkout. Forks, vendored source edits, runtime monkey-patches, and patch-package changes are prohibited. |
| C-004 | Fixed | The official renderer is the only full product UI. Reimplementing its business UI in a native widget toolkit is outside this mission because it would break plugin and upgrade parity. |
| C-005 | Fixed | Host executes in a standard supported runtime process so upstream and third-party native add-ons retain their expected ABI. |
| C-006 | Fixed | The two shell candidates must be compared with identical payload bytes, fixtures, settings, reference machine, sample counts, and disabled developer tooling. |
| C-007 | Fixed | Security and capability parity are hard gates; performance cannot compensate for a failure in either. |
| C-008 | Fixed | Memory has the highest performance decision priority, followed by long-session and streaming responsiveness, followed by startup. |
| C-009 | Fixed | The first public production release is not part of this foundation mission; signing, notarization, automatic updates, and full distribution hardening are governed by the following productization mission. |

## Rules and Invariants

1. Exactly one selected payload version and runtime version form a desktop release unit.
2. The shell owns lifecycle and transport; DSH owns sessions, capabilities, interaction semantics, profiles, and plugin composition.
3. No desktop bridge API names an individual DSH business capability when the generic official transport can carry it.
4. A renderer is disposable; Host and durable state are authoritative.
5. Restart counters and process identity belong to one application instance and cannot target unrelated processes.
6. Capability inventory items may be marked passing or failing, never silently omitted.
7. Benchmark results are invalid if payload, fixture, environment, sample count, developer-tool state, or process membership differs between candidates.
8. Logs and diagnostics default to metadata, lifecycle state, and opaque identifiers; user content is excluded.
9. Unsupported upstream versions fail loudly before normal user interaction begins.
10. The production-shell decision is derived from committed rules and raw evidence, not edited by hand.

## Key Entities

| Entity | Required information |
|---|---|
| Payload manifest | DSH version, runtime version, renderer asset digest, Host package digest, platform, architecture, adapter version, build identifier. |
| Compatibility declaration | Supported exact versions or ranges, required upstream seams, adapter protocol version, known exclusions, validation result. |
| Parity inventory item | Stable identifier, official contribution or user flow, baseline evidence, candidate evidence, status, reason for failure if any. |
| Process identity | Application instance, component role, operating-system identity, parent identity, start time, generation, expected exit policy. |
| Lifecycle state | Current phase, transition timestamp, retry count, failure category, user-visible recovery actions. |
| Transport frame | Protocol version, stream or call identity, ordering information, message kind, cancellation or close state, opaque payload. |
| Benchmark run | Candidate, payload and fixture digests, environment, process membership, scenario, timestamps, raw measurements, integrity checks. |
| Decision report | Hard-gate results, normalized metrics, threshold comparison, selected candidate or no-selection outcome, supporting run identifiers. |

## Edge Cases

- The user launches two independent desktop instances against the same DSH home.
- A workspace path contains spaces, CJK characters, emoji, symlinks, or resides on a removable volume.
- Host becomes ready before the window, or the window becomes ready long before Host.
- Renderer reloads while an approval, question, cancellation, or streamed tool result is in flight.
- Host exits while a native subprocess or terminal is active.
- Output contains very large chunks, invalid encoding, binary-looking data, terminal control sequences, or a producer that ignores cancellation.
- A dynamic plugin is removed between payload assembly and profile boot.
- The selected port-like identifier or IPC resource collides with stale state from a previous crash.
- The machine is offline on first launch or while a compatibility check would normally query metadata.
- A supported version is present but its payload digest does not match the declared build.
- The user's durable store is newer than the pinned DSH release.
- The application is quit during Host startup, restart backoff, renderer recovery, or payload verification.
- Performance measurement is affected by thermal throttling, developer tools, background load, or mismatched candidate settings.

## Assumptions

- The upstream project continues to publish or otherwise expose a buildable official Web application and standard Host runtime.
- An exact upstream version may be pinned for a desktop release; automatic adoption of every untested upstream commit is not required.
- Browser-compatible third-party UI contributions are the plugin compatibility target. A plugin written exclusively for a future platform-specific desktop contribution point is outside this mission.
- Existing user data remains owned by DSH. The desktop shell does not introduce a second session or settings store.
- The initial reference Mac is an Apple-silicon machine with its model, memory, operating-system build, display configuration, and power state recorded in benchmark output.
- Release signing credentials are unavailable during foundation development; unsigned local packages are acceptable only for this mission's local smoke tests.
- The user has authorized autonomous clarification using the stated priority order and has approved a separate repository with later GitHub publication.

## Dependencies

- A known-good exact upstream DSH revision or published release and its declared runtime engine range.
- A deterministic browser baseline capable of running the same reference scenarios.
- Platform tooling required to build both macOS shell candidates.
- A fixture model/Host mode that can replay streaming, interaction, tool, error, and reconnect scenarios without user credentials.
- CI environments for platform-neutral Windows and Linux checks.

## Out of Scope

- Rewriting the official DSH product interface in native controls.
- Adding new DSH business capabilities that do not exist upstream.
- Modifying or publishing changes to the upstream DSH repository.
- macOS signing, notarization, automatic update rollout, crash-report upload, and public release hosting.
- Production Windows and Linux installers or platform-specific polish.
- Mobile clients, remote-access relays, plugin marketplace operations, and account synchronization.
- A terminal UI; it may share future compatibility concepts but is a separate product surface.

## Success Criteria

| ID | Outcome |
|---|---|
| SC-001 | A clean reference Mac completes the full reference task from launch through streamed response, tool use, interaction, persistence, quit, and resume without a separately installed DSH or runtime. |
| SC-002 | Every item in the pinned first-party parity inventory and the unchanged third-party fixture plugin passes against both candidates or the failing candidate is disqualified. |
| SC-003 | Socket and process audits show no unauthenticated listener, no duplicate Host, no orphaned owned child after exit, and no unrelated process termination. |
| SC-004 | The 100,000-event and sustained-stream scenarios preserve final-state equality and meet the p95/p99 interaction, control-latency, stall, and reclamation thresholds. |
| SC-005 | Thirty warm and thirty cold launches per candidate produce phase-separated results and meet the prompt-ready targets for any candidate eligible for selection. |
| SC-006 | The committed evaluator reproduces one of three legitimate outcomes from raw measurements: select candidate A, select candidate B, or select neither pending remediation. |
| SC-007 | A compatible upstream candidate can be evaluated by changing the version selection and rerunning gates, while an incompatible candidate fails before user work with an actionable report. |
| SC-008 | A new contributor can clone the standalone repository, run the deterministic foundation checks, and launch the selected development vertical slice using documented commands without editing upstream source. |

## Requirement Coverage Summary

- P1 complete-experience and plugin scenarios cover FR-001 through FR-005 and FR-008 through FR-012.
- P1 long-session scenarios cover FR-004, FR-007, FR-013 and NFR-002 through NFR-006.
- P2 recovery scenarios cover FR-006, FR-007, FR-016 and NFR-009 through NFR-011.
- P2 upgrade scenarios cover FR-009, FR-010, FR-015, FR-017 and NFR-010.
- P2 decision scenarios cover FR-012 through FR-014 and NFR-007, NFR-008, NFR-012.
