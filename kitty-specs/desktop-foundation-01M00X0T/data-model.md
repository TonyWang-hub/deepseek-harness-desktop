# Data Model: Desktop Foundation and Shell Decision

The foundation persists evidence and compatibility metadata, not DSH product state. DSH remains the sole owner of sessions, settings, credentials, profiles, plugins, workspaces, and migration rules. Values marked ephemeral must never be serialized to logs, benchmark records, crash metadata, or build artifacts.

## Entity relationships

```text
PayloadIdentity ───┐
                    ├──> BootPlan ──> ApplicationInstance ──> HostGeneration
ProfileSnapshot ───┘             │                    ├──> ProxyExchange
                                      │                    └──> ProxySocket
                                      └──> ParityRun

PayloadIdentity + FixtureIdentity + CandidateIdentity + EnvironmentIdentity
                                      └──> BenchmarkCampaign ──> BenchmarkRun ──> BenchmarkSample

ParityRun + BenchmarkCampaign + hard-gate evidence ──> DecisionReport
```

## PayloadIdentity

Identifies every byte that can affect Host or renderer behavior.

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | Exact desktop payload-manifest schema version. |
| `dshVersion` | string | Exact published version; no range. |
| `dshSource` | tagged union | `registry` with registry URL and integrity, or `clean-archive` with commit SHA and archive digest. Never a working-tree path. |
| `packageClosure` | array | Sorted package name, exact version, resolved source, integrity, and unpacked-content digest for every DSH family package. |
| `rendererDigest` | SHA-256 | Digest of the staged official frontend distribution. |
| `node` | object | Exact version, platform, architecture, distribution URL, archive integrity, and unpacked-runtime digest. |
| `adapterVersion` | string | Exact desktop compatibility-adapter version. |
| `payloadDigest` | SHA-256 | Canonical digest of this entity plus staged file manifest. |

Validation fails before Host boot when a package range remains unresolved, a DSH-family member is outside the approved set, a content digest differs, a source is a dirty checkout, or the Node engine is unsupported.

## ProfileSnapshot

A read-only launch-time view of the user-selected Web-capable profile.

| Field | Type | Rule |
|---|---|---|
| `profileName` | string | Opaque display-safe name; path is not persisted in evidence. |
| `manifestDigest` | SHA-256 | Digest of the profile manifest before launch. |
| `userPatchDigest` | SHA-256 or null | Digest only; patch contents are not copied into diagnostics. |
| `homePatchDigest` | SHA-256 or null | Digest only. |
| `bundleSet` | array | Ordered exact bundle identities resolved by the official profile loader. |
| `requiredRows` | array | Compatibility-set row ids that prove the profile is Web-capable. |
| `pluginClosureDigest` | SHA-256 | Installed out-of-tree dependency closure without paths or credentials. |
| `durableSchemaFacts` | object | Known session/settings schema versions required for fail-loud compatibility. |
| `snapshotDigest` | SHA-256 | Canonical digest used by parity and benchmark records. |

The snapshot is invalid if required Web rows are absent, a bundle cannot be resolved, a durable schema is newer than supported, or the official baseline and candidate resolve different closures.

## DesktopOverlay

An ephemeral, non-secret patch passed to the official binary.

| Field | Type | Rule |
|---|---|---|
| `disabledRow` | literal `webserver` | Original TCP provider is disabled; its `name` is never patched. |
| `insertedCarrier` | object | Stable id `desktop-webserver`, absolute file URL, and fixed startup descriptor number. |
| `webRuntimeConfig` | object | Browser URL printing and browser-only surface context disabled; trusted-host set preserved as declared by the compatibility set. |
| `insertedSurface` | object | Stable id `desktop-surface` and absolute file URL. |
| `digest` | SHA-256 | Recorded in BootPlan; file contains no token or socket path. |

The file is created mode 0600 inside the application runtime directory and removed during teardown. Its absence after a crash is handled by runtime-directory cleanup on the next identity-fenced launch.

## BootCapsule

One-use data sent over an inherited descriptor and consumed before the desktop carrier accepts traffic.

| Field | Type | Persistence |
|---|---|---|
| `protocolVersion` | integer | May appear in diagnostics. |
| `applicationInstanceId` | branded UUID | May appear in redacted diagnostics. |
| `generation` | positive integer | May appear in diagnostics. |
| `socketPath` | absolute path | Ephemeral; never exposed to renderer or persisted. |
| `authToken` | 32-byte random value | Secret and ephemeral; never persisted. |
| `payloadDigest` | SHA-256 | Persistable. |
| `profileDigest` | SHA-256 | Persistable. |
| `limits` | object | Bounded header, body, stream-buffer, connection, and startup-capsule limits. |

The capsule is length-bounded, written once, closed by the parent, read exactly once by the provider, and cleared from mutable state after initialization. EOF before a complete capsule is a fatal boot error.

## BootPlan

The validated, secret-free input to a platform supervisor.

| Field | Type | Rule |
|---|---|---|
| `payload` | PayloadIdentity reference | Exact match required. |
| `profile` | ProfileSnapshot reference | Exact match required. |
| `overlayPath` | absolute path | Must reside in owned runtime directory. |
| `nodeExecutable` | absolute path | Must resolve inside staged payload. |
| `dshBin` | absolute path | Must resolve inside exact DSH package. |
| `argv` | string array | Contains profile and overlay only; no secret. |
| `environmentAllowlist` | map | Minimal explicitly inherited environment; excludes token. |
| `capsuleDescriptor` | integer | Fixed by protocol and inherited only by the Host child. |

## ApplicationInstance and HostGeneration

`ApplicationInstance` owns one `(DSH home identity, profile name)` lease and at most one live Host generation.

```text
idle -> starting -> probing -> ready -> stopping -> stopped
                    |          |
                    v          v
                 recovering <- failed
                    |
                    +-> starting  (within retry budget)
                    +-> failed    (budget exhausted)
```

`HostGeneration` fields are application instance id, monotonically increasing generation, PID, process start time, process-group identity, spawn time, ready time, exit observation, expected-exit policy, retry ordinal, and failure category. Signals require a match on instance id, generation, PID, and start time. No operation may target a process by executable name alone.

The state machine rejects concurrent live generations. An explicit user quit never transitions to recovering. A second launch for the same lease requests focus from the owning instance and exits without starting another Host.

## ProxyExchange

One custom-protocol HTTP exchange mapped to the UDS carrier.

| Field | Type | Rule |
|---|---|---|
| `exchangeId` | branded 128-bit id | Unique within application instance. |
| `generation` | integer | Must match the current ready Host. |
| `request` | object | Method, relative URL, allowed headers, streaming body metadata. Product paths remain opaque. |
| `response` | object or null | Status, allowed headers, streaming body metadata. |
| `state` | enum | `created`, `requesting`, `responding`, `completed`, `aborted`, `failed`. |
| `bufferedBytes` | integer | Never exceeds BootCapsule limit. |

Terminal states are immutable. Renderer cancellation aborts the native request and UDS stream. A Host-generation change fails every nonterminal exchange; official client reconnect logic decides whether to retry.

## ProxySocket

One browser-compatible WebSocket relay over an upstream upgrade route.

| Field | Type | Rule |
|---|---|---|
| `socketId` | branded 128-bit id | Unique within renderer generation. |
| `rendererGeneration` | integer | Prevents late events reaching a replacement renderer. |
| `hostGeneration` | integer | Prevents cross-restart frame delivery. |
| `url` | URL | Loopback authority only; path and query remain opaque. |
| `protocols` | string array | Forwarded through the ordinary handshake. |
| `state` | enum | `connecting`, `open`, `closing`, `closed`, `failed`. |
| `sendSequence` / `receiveSequence` | nonnegative integer | Strictly monotonic per direction. |
| `bufferedBytes` | integer | Bounded; drives browser-compatible `bufferedAmount`. |
| `close` | object or null | Code, reason, clean flag, and initiator. |

Text and binary frames, ping/pong, fragmentation, close handshake, backpressure, cancellation, and half-close behavior follow RFC 6455. The relay never parses DSH JSON.

## ParityInventoryItem and ParityRun

`ParityInventoryItem` contains stable id, source package and bundle row, contribution kind, expected digest, required activation check, required user-flow scenarios, official-baseline evidence id, candidate evidence ids, and status (`pass` or `fail`). Missing, degraded, skipped, or desktop-reimplemented items are failures.

`ParityRun` records payload/profile/fixture/candidate digests, the independently generated expected set, the live boot graph, scenario results, third-party plugin lifecycle evidence, transcript/state hashes, and a required negative-control result. A run is invalid unless the deliberately removed or corrupted bundle makes the oracle fail.

## BenchmarkCampaign, BenchmarkRun, and BenchmarkSample

`BenchmarkCampaign` fixes the candidate order seed, matched payload/profile/fixture identities, environment identity, scenarios, sample counts, confidence method, checkpoint schedule, hard budgets, aggregate memory weights, and relative guardrails before measurement.

`BenchmarkRun` represents one randomized candidate/scenario execution. It records externally observed process start, window visible, renderer settled, Host connected, composer operational, first session ready, scenario start/end, and clean teardown. A visible empty composer is not prompt-ready.

`BenchmarkSample` records the attributable PID census with role and start time, de-duplicated macOS physical footprint for the census, diagnostic per-process RSS, latency distributions, >=250 ms stalls, request/ack control RTT, sequence integrity, environment observations, and invalidation reasons. WKWebView XPC helpers are attributed through creation-time and teardown correlation even when they are not ordinary descendants.

## DecisionReport

The report is derived, never hand-edited.

| Field | Rule |
|---|---|
| `inputDigests` | Exact raw evidence and evaluator digests. |
| `hardGates` | Payload, parity, no-TCP, lifecycle, integrity, responsiveness, startup, and evidence-validity result per candidate. |
| `memoryComparison` | Predeclared aggregate p95 footprint, confidence interval, and each scenario guardrail. |
| `responseComparison` | Absolute budgets and <=10% relative guardrail. |
| `startupComparison` | Absolute budgets and <=10% relative guardrail. |
| `outcome` | `electron`, `tauri`, or `none`. |
| `remediationInputs` | Required when outcome is `none`; empty otherwise. |

Decision order is fixed: reject invalid evidence, apply hard gates, select the only passing candidate if exactly one passes, otherwise select Tauri only if every Tauri replacement threshold passes, else select Electron. If no candidate passes, outcome is `none`.
