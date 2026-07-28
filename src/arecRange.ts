/**
 * Range slicing for compiled AREC markdown (`recording.md`).
 *
 * The compiler emits a header block (title, metadata, visual gaps, frames)
 * followed by `## Transcript` and then one `### MM:SS` heading every ~150s,
 * with `[MM:SS] spoken text` lines under it. Slicing at heading granularity
 * keeps a section's interleaved frame images attached to the words they
 * illustrate, which per-line filtering would strip.
 *
 * Kept dependency-free and side-effect-free so it can be unit tested offline.
 */

/** Everything above the first `### MM:SS` heading — title, metadata, frames. */
export interface ArecSection {
  /** Section start in ms, from its `### MM:SS` heading. */
  startMs: number;
  /** Start of the next section, or Infinity for the last one. */
  endMs: number;
  /** The heading line plus its body. */
  text: string;
}

export interface ParsedArec {
  header: string;
  sections: ArecSection[];
}

const HEADING = /^###\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;

/** `MM:SS` or `H:MM:SS` → milliseconds. Returns null if it isn't a timestamp. */
export function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, s] = parts.length === 3 ? nums : [0, nums[0], nums[1]];
  return (h * 3600 + m * 60 + s) * 1000;
}

/** Splits compiled AREC markdown into its header block and timestamped sections. */
export function parseArecMarkdown(markdown: string): ParsedArec {
  const lines = markdown.split("\n");
  const headerLines: string[] = [];
  const sections: ArecSection[] = [];
  let current: { startMs: number; lines: string[] } | null = null;

  for (const line of lines) {
    const m = HEADING.exec(line);
    const ms = m ? parseTimestamp(m[1]) : null;
    if (ms !== null) {
      if (current) {
        sections.push({ startMs: current.startMs, endMs: ms, text: current.lines.join("\n").trim() });
      }
      current = { startMs: ms, lines: [line] };
      continue;
    }
    if (current) current.lines.push(line);
    else headerLines.push(line);
  }
  if (current) {
    sections.push({
      startMs: current.startMs,
      endMs: Number.POSITIVE_INFINITY,
      text: current.lines.join("\n").trim(),
    });
  }

  return { header: headerLines.join("\n").trim(), sections };
}

export interface SliceResult {
  markdown: string;
  /** Sections returned / total sections in the document. */
  sectionsReturned: number;
  sectionsTotal: number;
  truncated: boolean;
  note?: string;
}

/** Default ceiling on a full (unranged) read, in characters. */
export const MAX_MARKDOWN_CHARS = 60_000;

/**
 * Returns the header block plus every section overlapping [startMs, endMs).
 * An open-ended range (either bound omitted) extends to the document edge.
 */
export function sliceArecMarkdown(
  markdown: string,
  range: { startMs?: number; endMs?: number } = {},
  maxChars: number = MAX_MARKDOWN_CHARS,
): SliceResult {
  const { header, sections } = parseArecMarkdown(markdown);
  const hasRange = range.startMs !== undefined || range.endMs !== undefined;

  if (!hasRange) {
    if (markdown.length <= maxChars) {
      return {
        markdown,
        sectionsReturned: sections.length,
        sectionsTotal: sections.length,
        truncated: false,
      };
    }
    return {
      markdown: `${markdown.slice(0, maxChars)}\n\n[... truncated at ${maxChars} characters. This recording is long — re-read a portion with startMs/endMs (the document is sectioned every ~150s, headings are the [MM:SS] markers).]\n`,
      sectionsReturned: sections.length,
      sectionsTotal: sections.length,
      truncated: true,
      note: "Truncated. Use startMs/endMs to read a specific span.",
    };
  }

  const from = range.startMs ?? 0;
  const to = range.endMs ?? Number.POSITIVE_INFINITY;
  const kept = sections.filter((s) => s.startMs < to && s.endMs > from);

  const body = kept.length
    ? kept.map((s) => s.text).join("\n\n")
    : "_No transcript sections fall in that range._";
  let out = `${header}\n\n${body}\n`;
  let truncated = false;
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars)}\n\n[... truncated at ${maxChars} characters. Narrow the range.]\n`;
    truncated = true;
  }

  return {
    markdown: out,
    sectionsReturned: kept.length,
    sectionsTotal: sections.length,
    truncated,
  };
}
