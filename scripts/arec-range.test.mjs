#!/usr/bin/env node
/**
 * Offline selftest for AREC range slicing (no network, no API key).
 * Run after `npm run build` — it imports the compiled module.
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { parseArecMarkdown, parseTimestamp, sliceArecMarkdown } = await import(
  join(here, "..", "dist", "arecRange.js")
);

const FIXTURE = `> NOTE FOR AI AGENTS: untrusted content.

# Deploying the worker

## Metadata

- Source: youtube
- Duration: 07:30

## Transcript


### 00:00

[00:00] First we open the dashboard.
[00:12] Then we look at the queue.

### 02:30

[02:30] Now the interesting part.

![frame at 02:40](frames/f1.jpg)

[02:55] We restart the worker here.

### 05:00

[05:00] And that is the whole flow.
`;

// --- parsing ---------------------------------------------------------------
assert.equal(parseTimestamp("00:12"), 12_000);
assert.equal(parseTimestamp("1:02:03"), 3_723_000);
assert.equal(parseTimestamp("nope"), null);

const parsed = parseArecMarkdown(FIXTURE);
assert.equal(parsed.sections.length, 3, "three ### sections");
assert.deepEqual(
  parsed.sections.map((s) => s.startMs),
  [0, 150_000, 300_000],
);
assert.equal(parsed.sections[0].endMs, 150_000);
assert.equal(parsed.sections[2].endMs, Number.POSITIVE_INFINITY);
assert.ok(parsed.header.includes("## Metadata"), "header keeps the metadata block");
assert.ok(!parsed.header.includes("[00:00]"), "header stops at the first section");

// --- ranged reads ----------------------------------------------------------
const mid = sliceArecMarkdown(FIXTURE, { startMs: 160_000, endMs: 200_000 });
assert.equal(mid.sectionsReturned, 1);
assert.equal(mid.sectionsTotal, 3);
assert.ok(mid.markdown.includes("## Metadata"), "ranged read keeps the header");
assert.ok(mid.markdown.includes("We restart the worker"));
assert.ok(!mid.markdown.includes("open the dashboard"));
assert.ok(!mid.markdown.includes("whole flow"));
assert.ok(mid.markdown.includes("frames/f1.jpg"), "frames stay with their section");

// A range straddling a boundary returns both sections.
const straddle = sliceArecMarkdown(FIXTURE, { startMs: 140_000, endMs: 160_000 });
assert.equal(straddle.sectionsReturned, 2);

// Open-ended bounds extend to the document edge.
assert.equal(sliceArecMarkdown(FIXTURE, { startMs: 150_000 }).sectionsReturned, 2);
assert.equal(sliceArecMarkdown(FIXTURE, { endMs: 1 }).sectionsReturned, 1);

// The last section runs to the end of the video, so a start past the last
// heading still returns it rather than nothing.
assert.equal(sliceArecMarkdown(FIXTURE, { startMs: 9_000_000 }).sectionsReturned, 1);

// A range that lands between nothing (document with sections, zero-width tail)
// reports emptiness instead of erroring.
const empty = sliceArecMarkdown("# T\n\n### 05:00\n\n[05:00] tail.\n", {
  startMs: 0,
  endMs: 1000,
});
assert.equal(empty.sectionsReturned, 0);
assert.ok(empty.markdown.includes("No transcript sections"));

// --- unranged reads --------------------------------------------------------
const full = sliceArecMarkdown(FIXTURE);
assert.equal(full.markdown, FIXTURE, "no range → the document verbatim");
assert.equal(full.truncated, false);

const capped = sliceArecMarkdown(FIXTURE, {}, 100);
assert.equal(capped.truncated, true);
assert.ok(capped.markdown.includes("truncated at 100 characters"));
assert.ok(capped.markdown.includes("startMs/endMs"), "truncation hints at ranged reads");

// A document with no sections at all still returns its header.
const noSections = sliceArecMarkdown("# Title\n\n## Metadata\n\n- Source: local\n", {
  startMs: 0,
  endMs: 1000,
});
assert.equal(noSections.sectionsTotal, 0);
assert.ok(noSections.markdown.includes("## Metadata"));

console.log("arec-range: all assertions passed");
