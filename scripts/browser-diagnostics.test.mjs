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
