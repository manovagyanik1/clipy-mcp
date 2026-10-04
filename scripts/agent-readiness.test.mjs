import assert from "node:assert/strict";
import { waitForAgentMetadata } from "../dist/agentReadiness.js";

const metadata = [
  { recording: { agentReadiness: "preparing" } },
  { recording: { agentReadiness: "usable" } },
];
let calls = 0;
const result = await waitForAgentMetadata(
  async () => {
    calls += 1;
    return metadata.shift();
  },
  { timeoutMs: 5_000, pollIntervalMs: 1, now: () => 0, sleep: async () => undefined },
);

assert.equal(result.timedOut, false);
assert.equal(result.metadata.recording.agentReadiness, "usable");
assert.equal(calls, 2);

let clock = 0;
let timeoutCalls = 0;
const timeoutResult = await waitForAgentMetadata(
  async () => {
    timeoutCalls += 1;
    return { recording: { agentReadiness: "preparing" } };
  },
  {
    timeoutMs: 2_500,
    pollIntervalMs: 3_000,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  },
);
assert.equal(timeoutResult.timedOut, true);
assert.equal(timeoutCalls, 1);

let slowCalls = 0;
const slowStartedAt = Date.now();
const slowResult = await waitForAgentMetadata(
  async (signal) => {
    slowCalls += 1;
    if (slowCalls === 1) {
      return { recording: { agentReadiness: "preparing" } };
    }
    await new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  },
  { timeoutMs: 30, pollIntervalMs: 0, now: Date.now, sleep: async () => undefined },
);
assert.equal(slowResult.timedOut, true);
assert.equal(slowCalls, 2);
assert.equal(slowResult.metadata.recording.agentReadiness, "preparing");
assert.ok(Date.now() - slowStartedAt < 250);
console.log("MCP agent readiness wait tests passed");
