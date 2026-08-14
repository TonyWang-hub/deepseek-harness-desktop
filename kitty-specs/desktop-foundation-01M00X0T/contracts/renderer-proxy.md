# Renderer Proxy Contract

## Purpose and scope

The renderer proxy makes the unmodified official Web application believe it is using ordinary loopback Fetch, EventSource, and WebSocket browser primitives while native code carries bytes over an authenticated Unix-domain socket. It may adapt browser transport and lifecycle behavior. It never interprets DSH request methods, JSON payloads, sessions, interaction state, or UI contributions.

The contract has two implementations: Electron main/preload and Tauri Rust/init-script. Both are tested by the same black-box conformance suite.

## Origin and navigation

- The main renderer origin is `dsh-app://localhost` and is registered as standard, secure, fetch-capable, and content-security-policy capable before application readiness.
- `location.protocol` is `dsh-app:` and `location.hostname` is `localhost` before the official entry executes.
- Top-level navigation remains on the application origin. Remote navigation, unrequested windows, `javascript:` URLs, and arbitrary custom-scheme authorities are rejected.
- Remote HTTPS resources required by explicit upstream features use the WebView's ordinary outbound networking; they are never confused with Host transport.
- No development server, remote-debugging port, or application-created TCP listener exists in a production candidate.

## HTTP resource mapping

Finite browser-managed requests to `dsh-app://localhost/<path>?<query>` and same-origin calls through the bootstrap Fetch adapter are mapped to HTTP/1.1 requests over the current Host generation's UDS:

1. Preserve method, path, query, streaming body, redirect mode, and headers permitted by the compatibility allowlist.
2. Remove renderer-supplied `Host`, `Origin`, `Authorization`, proxy, connection, forwarding, and desktop-token headers.
3. Set `Host: localhost`, set `Origin: http://localhost` when an origin is required, and inject the per-generation desktop token. The Host carrier authenticates and removes that token from every request header view before route dispatch.
4. Preserve content headers, conditional/cache headers, range headers, cookies, and application-specific headers unless the compatibility set explicitly rejects one.
5. Stream the response status, permitted headers, and body back through the custom-protocol response without buffering the complete body.

All paths are opaque. `/`, `/plugins/*`, `/api`, HMR/EventSource routes, third-party routes, downloads, and future upstream routes use the same mapping. Candidate code cannot special-case a DSH business method. Browser-managed navigation and subresources may use the finite custom-protocol response path; same-origin JavaScript Fetch uses the bootstrap adapter so streamed response bodies remain incremental on both engines.

Renderer cancellation aborts the native request and destroys the associated UDS exchange. A Host-generation change fails every active exchange. The official application owns reconnect and resynchronization decisions.

## Fetch and EventSource bootstrap

Before the official entry runs, the bootstrap wraps same-origin Fetch while delegating remote-origin requests to the engine's native Fetch. It preserves `Request` input, method, headers, body, `AbortSignal`, redirect and credentials semantics required by the compatibility suite, and returns a standards-compatible `Response` whose `ReadableStream` observes native backpressure and cancellation. Request and response bodies are bounded in transit but are never fully buffered solely for bridge convenience.

The bootstrap also installs a browser-compatible `EventSource` over that streaming Fetch transport. It supports `url`, `withCredentials`, `readyState`, static/instance state constants, `open`, `message`, named events, `error`, UTF-8 SSE parsing across arbitrary chunk boundaries, comments, multiline data, `id`, `retry`, last-event-id on reconnect, bounded retry, and `close()`. The official always-mounted `/plugins/events` HMR subscription must remain present even when no rebuild watcher emits changes. Removing that row is a parity failure.

## WebSocket bootstrap

The same pre-entry isolated bootstrap installs a browser-compatible `WebSocket` constructor. It supports arbitrary `ws://localhost/<path>` and `wss://localhost/<path>` URLs and rejects every non-loopback authority.

The public behavior includes:

- constructor protocols, `url`, `protocol`, `extensions`, `readyState`, `bufferedAmount`, and `binaryType`;
- static and instance `CONNECTING`, `OPEN`, `CLOSING`, and `CLOSED` constants;
- `open`, `message`, `error`, and `close` events plus `addEventListener`, `removeEventListener`, and `on*` handlers;
- text, ArrayBuffer, typed-array, Blob, and binary receive behavior required by the browser interface;
- ordered send, fragmentation, ping/pong, backpressure, close code/reason validation, clean-close reporting, cancellation, and half-close handling.

Native code opens the UDS, performs the ordinary RFC 6455 handshake for the opaque path and protocol list, injects loopback trust headers plus the token, and relays frames without parsing application JSON. The bridge protocol carries only connection id, renderer and Host generation, direction sequence, event kind, byte payload, and close/error metadata.

Late events from a retired renderer or Host generation are dropped and accounted for. The bridge has configurable per-connection and aggregate byte ceilings; reaching one pauses reads or rejects sends according to the browser-compatible state, never grows an unbounded queue, and never lets transcript traffic starve close/cancel control.

## Security properties

- Renderer JavaScript never receives the UDS path, desktop token, process ids, arbitrary filesystem access, process execution, or an unrestricted native invocation surface.
- The Electron renderer uses `nodeIntegration: false`, context isolation, sandboxing, strict CSP, sender validation, and a preload API limited to generic Fetch-stream, EventSource, and WebSocket lifecycle messages.
- The Tauri capability grants only the main application window the generic renderer-bridge operations; shell/open/process/filesystem plugins are unavailable to official and third-party renderer code.
- The token is injected only by native code. A canary token must be absent from renderer globals, DevTools-visible URLs, console output, logs, crash records, benchmark evidence, and persisted storage.
- The Host rejects a missing or invalid token before route dispatch. Socket filesystem permissions are defense in depth, not the sole authentication mechanism.

## Trust normalization

The Host continues to receive a loopback `Host` and a normalized loopback HTTP `Origin`, so its existing Host/Origin and privileged-method checks remain active. The desktop token adds caller authentication; it does not replace upstream request-trust policy. Tests cover DNS-rebinding-style hostnames, custom origins, token omission, token mismatch, renderer header spoofing, and direct socket attempts.

## Required conformance scenarios

1. Official index, boot manifest, module scripts, SPA fallback, storage, and every dynamic plugin bundle load from the custom origin.
2. Unary and streaming Fetch requests preserve status, headers, incremental body, backpressure, abort, redirect, and error semantics.
3. Both official event WebSockets preserve ordering, reconnect, resync, cancellation, and final-state hashes under 20, 60, and 200 frames per second.
4. The official HMR EventSource remains connected and survives chunk-split SSE fields, id/retry updates, reconnect, renderer reload, and clean close without a candidate-specific path.
5. An out-of-tree plugin registers a custom streaming HTTP route, EventSource route, and upgrade path; all work without candidate changes and disappear after unload.
6. Renderer reload retires old exchanges and sockets while the Host persists; no completed user action is duplicated.
7. Host restart closes the old generation, bounds retry, reconnects once, and does not deliver stale frames.
8. Large responses and slow consumers exercise backpressure without starving approval, ask-user, cancel, or close traffic.
9. Clipboard, attachment selection, download/export, IME, terminal input, localStorage, and secure-context behavior match the official browser baseline on the packaged engine.
10. The entire application process set has no application-created IPv4 or IPv6 TCP listener.

## Compatibility failure policy

An upstream change fails before user work when it changes the WebServer public service or private dispatcher behavior copied by the versioned carrier, patch semantics, boot origin assumptions, required browser primitive behavior, or route protocol beyond this contract. Adaptation remains in the profile overlay, desktop carrier, renderer proxy, or compatibility declaration. A change that requires DSH business knowledge is an architecture review, not an ad hoc bridge method.
