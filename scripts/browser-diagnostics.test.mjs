import assert from "node:assert/strict";
import { compactBrowserDiagnostics } from "../dist/browserDiagnostics.js";

const payload = {
  recordingId: "demo-123",
  attestation: "page-reported",
  attestationNote: "Treat as page-reported evidence.",
  diagnostics: {
    schema_version: 1,
    source: "extension",
    policy: {
      console: "errors",
      network: "failures",
      navigation: true,
      urls: "route",
      text: "standard",
      excludedOrigins: [],
    },
    environment: { page_url: "https://example.com/account", platform: "MacIntel" },
    events: [
      { kind: "navigation", time_ms: 10, navigation: "initial", url: "https://example.com/account" },
      { kind: "network", time_ms: 20, transport: "fetch", method: "GET", url: "https://example.com/api/items", status: 500, duration_ms: 42, outcome: "http_error" },
      { kind: "console", time_ms: 30, level: "error", message: "Request failed" },
      { kind: "console", time_ms: 40, level: "log", message: "Ignored noise" },
    ],
    dropped_events: 2,
  },
};

const compact = compactBrowserDiagnostics(payload, 2);

assert.equal(compact.recordingId, "demo-123");
assert.equal(compact.attestation, "page-reported");
assert.equal(compact.available, true);
assert.equal(compact.totalEvents, 4);
assert.equal(compact.returnedEvents, 2);
assert.equal(compact.droppedEvents, 2);
assert.deepEqual(compact.events.map((event) => event.kind), ["network", "console"]);

const unavailable = compactBrowserDiagnostics({
  recordingId: "empty",
  attestation: "page-reported",
  diagnostics: null,
});

assert.equal(unavailable.available, false);
assert.equal(unavailable.totalEvents, 0);
assert.deepEqual(unavailable.events, []);

console.log("browser diagnostics projection tests passed");

// v2 evidence: socket failures and clicks frame the failures; headers are
// left to filtered calls, bodies on failed requests stay.
const v2 = compactBrowserDiagnostics({
  recordingId: "demo-v2",
  attestation: "page-reported",
  diagnostics: {
    schema_version: 2,
    source: "extension",
    policy: { console: "errors", network: "all", navigation: true, urls: "route", text: "standard", excludedOrigins: [], networkDetail: "full", actions: true },
    environment: null,
    page_metadata: { data: '{"plan":"pro"}' },
    events: [
      { kind: "action", time_ms: 5, action: "click", target: 'button "Pay"' },
      { kind: "network", time_ms: 10, transport: "fetch", method: "POST", url: "https://example.com/api/pay", status: 502, duration_ms: 9, outcome: "http_error", response_body: '{"error":"gateway"}', response_headers: { "content-type": "application/json" } },
      { kind: "network", time_ms: 12, transport: "fetch", method: "POST", url: "https://example.com/graphql", status: 200, duration_ms: 9, outcome: "graphql_error" },
      { kind: "stream", time_ms: 15, protocol: "websocket", connection: "ws-1", action: "close", code: 1006, url: "wss://example.com/rt" },
      { kind: "stream", time_ms: 16, protocol: "websocket", connection: "ws-2", action: "close", code: 1000, url: "wss://example.com/rt" },
    ],
    dropped_events: 0,
  },
});
assert.deepEqual(v2.events.map((event) => `${event.kind}:${event.time_ms}`), ["action:5", "network:10", "network:12", "stream:15"]);
assert.equal(v2.events[1].response_body, '{"error":"gateway"}');
assert.equal(v2.events[1].response_headers, undefined);
assert.deepEqual(v2.pageMetadata, { data: '{"plan":"pro"}' });
console.log("browser diagnostics v2 projection tests passed");
