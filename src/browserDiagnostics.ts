type JsonObject = Record<string, unknown>;

export interface CompactBrowserDiagnostics {
  recordingId: string | null;
  attestation: string | null;
  attestationNote: string | null;
  available: boolean;
  policy: unknown;
  environment: unknown;
  pageMetadata: unknown;
  detectedTools: unknown;
  totalEvents: number;
  returnedEvents: number;
  droppedEvents: number;
  events: JsonObject[];
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isFailureEvidence(event: JsonObject): boolean {
  if (event.kind === "error" || event.kind === "unhandled_rejection") return true;
  if (event.kind === "console") return event.level === "warn" || event.level === "error";
  if (event.kind === "stream") {
    const code = typeof event.code === "number" ? event.code : null;
    return event.action === "error" || (event.action === "close" && code !== null && ![1000, 1001, 1005].includes(code));
  }
  return event.kind === "network" && event.outcome !== "success";
}

/** Headers are the bulkiest, least often decisive part of a failed request;
 *  the compact view keeps the bodies and leaves headers to a filtered call. */
function withoutHeaders(event: JsonObject): JsonObject {
  if (event.kind !== "network" || (!event.request_headers && !event.response_headers)) return event;
  const copy = { ...event };
  delete copy.request_headers;
  delete copy.response_headers;
  return copy;
}

export function compactBrowserDiagnostics(
  payload: unknown,
  maxEvents = 100,
): CompactBrowserDiagnostics {
  const root = isJsonObject(payload) ? payload : {};
  const diagnostics = isJsonObject(root.diagnostics) ? root.diagnostics : null;
  const events = diagnostics && Array.isArray(diagnostics.events)
    ? diagnostics.events.filter(isJsonObject)
    : [];
  const limit = Math.max(1, Math.min(500, Math.trunc(maxEvents)));
  const failures = events.filter(isFailureEvidence);
  // Page changes and clicks frame the failures: what the user did right
  // before the request failed is usually the repro step.
  const navigation = events.filter((event) => event.kind === "navigation" || event.kind === "action");
  const selected = [...failures, ...navigation]
    .filter((event, index, candidates) => candidates.indexOf(event) === index);
  const bounded = selected
    .sort((left, right) => numberField(left.time_ms) - numberField(right.time_ms))
    .slice(-limit)
    .map(withoutHeaders);

  return {
    recordingId: stringField(root.recordingId),
    attestation: stringField(root.attestation),
    attestationNote: stringField(root.attestationNote),
    available: diagnostics !== null,
    policy: diagnostics?.policy ?? null,
    environment: diagnostics?.environment ?? null,
    pageMetadata: diagnostics?.page_metadata ?? null,
    detectedTools: diagnostics?.detected_tools ?? null,
    totalEvents: events.length,
    returnedEvents: bounded.length,
    droppedEvents: numberField(diagnostics?.dropped_events),
    events: bounded,
  };
}
