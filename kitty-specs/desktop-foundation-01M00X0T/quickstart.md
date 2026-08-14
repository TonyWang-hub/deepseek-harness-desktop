# Quickstart: Desktop Foundation Development

This document defines the command surface the mission must deliver. It uses deterministic fixtures and requires no model credential. The sibling `deepseek-harness` checkout is an optional read-only compatibility oracle and is never part of this workspace.

## Prerequisites

- macOS 13.5 or newer on Apple silicon
- Xcode Command Line Tools
- Node.js 24.17.x and Corepack
- pnpm version pinned by this repository
- Rust 1.93.0 with the Apple-silicon macOS target

Verify the toolchain:

```sh
node --version
corepack pnpm --version
rustc --version
cargo --version
xcode-select --print-path
```

## Install and verify the workspace

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run verify
```

`verify` runs formatting, lint, strict type checking, unit/contract tests, Rust checks, payload-manifest validation, and the desktop-spec contract validators. It does not download a floating DSH version.

## Stage the exact development payload

```sh
corepack pnpm run payload:stage
corepack pnpm run payload:verify
```

Staging uses the checked-in payload lock. The result contains the official DSH package closure, official renderer, and standard Node runtime. Verification prints only versions and digests. A range, mixed family, dirty checkout, unexpected package, or digest mismatch fails before either application launches.

## Run the shared architecture-viability gate

```sh
corepack pnpm run test:architecture
```

The gate boots the official binary and a real Web profile through the ephemeral desktop overlay. It proves official index and boot-manifest loading, a first-party dynamic bundle, an ordinarily installed out-of-tree plugin, ordered stream output, terminal/diff rendering, approval, ask-user, cancellation, renderer recreation/resynchronization, Host crash recovery, process cleanup, payload and graph digests, and the absence of an application-created TCP listener. Only the model response is replayed; the Host, session store, transport, and interactions are real.

## Launch each macOS candidate

Use an isolated test home for fixture work:

```sh
export DSH_DESKTOP_TEST_HOME="$(mktemp -d)"
corepack pnpm run fixture:home -- --output "$DSH_DESKTOP_TEST_HOME"
corepack pnpm run dev:electron -- --dsh-home "$DSH_DESKTOP_TEST_HOME" --profile web
```

In another run, launch the Tauri candidate against a fresh equivalent fixture home:

```sh
export DSH_DESKTOP_TAURI_HOME="$(mktemp -d)"
corepack pnpm run fixture:home -- --output "$DSH_DESKTOP_TAURI_HOME"
corepack pnpm run dev:tauri -- --dsh-home "$DSH_DESKTOP_TAURI_HOME" --profile web
```

Developer tools are disabled in benchmark and parity modes. Development mode may expose them only through an explicit flag and can never satisfy release evidence gates.

## Run capability and lifecycle gates

```sh
corepack pnpm run test:parity
corepack pnpm run test:lifecycle
corepack pnpm run test:security
```

Parity derives its expected contribution set from the exact package closure and official profile, then compares the live boot graph. The suite includes a negative control that corrupts one copied fixture bundle and must observe a failure. Security audits every attributable application process for IPv4 and IPv6 listeners at boot, idle, stream, recovery, and shutdown.

## Collect matched performance evidence

```sh
corepack pnpm run benchmark:desktop -- --candidate-order-seed 20260815
corepack pnpm run benchmark:validate
corepack pnpm run benchmark:evaluate
```

The controller randomizes Electron and Tauri runs while keeping payload, profile, fixtures, display, power state, and developer-tool state fixed. It records de-duplicated macOS physical footprint across attributed processes, diagnostic RSS, operational startup phases, per-interaction input-to-paint latency, request/ack control RTT, stalls, and stream integrity. Invalid or incomplete runs cannot enter the evaluator.

The evaluator produces exactly one of `electron`, `tauri`, or `none`. It cannot select a candidate that fails payload, parity, no-TCP, lifecycle, integrity, responsiveness, startup, or evidence-validity gates.

## Check that upstream stayed untouched

When a local upstream oracle was configured, record its status before and after compatibility checks:

```sh
git -C ../deepseek-harness status --short
corepack pnpm run upstream:probe -- --checkout ../deepseek-harness
git -C ../deepseek-harness status --short
```

The two status outputs must be identical. The probe may read and build only from a clean exported archive; it never stages payload bytes from the working tree.

## Local cleanup

Quit each candidate through its normal application action. The lifecycle test then verifies that its Host process group, WebView helpers attributed to the run, runtime directory, socket, non-secret overlay, and one-use capsule are gone. Fixture homes are retained until the test report is complete so state hashes and expected filesystem changes can be compared with the official browser baseline.
