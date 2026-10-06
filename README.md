# @clipy/mcp

Agent-native video handoffs with [Clipy](https://clipy.online): search memory, read context,
and capture or update recordings with scoped permissions.

> Developed in the Clipy monorepo. A public mirror for browsing the source and filing
> issues lives at **[github.com/manovagyanik1/clipy-mcp](https://github.com/manovagyanik1/clipy-mcp)**
> (MIT), kept in sync with each npm release.

This [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server runs locally
over stdio and connects Claude Code, Codex, Cursor, Windsurf, and other MCP-capable
agents to Clipy. Use it to turn a bug-report recording into a fix or ticket, then
record the result for another agent or a human to review.

- **Find and read context:** `search_memory` searches recordings and imported-video
  context documents. Read timestamped transcripts, AI summaries, key moments, and
  `get_agent_context` bundles, plus available browser diagnostics and interaction
  timelines. Evidence depends on what was captured and processed; browser diagnostics
  are page-reported, and interaction coverage is reported by the tools.
- **Capture a handoff:** `record` captures a web app headlessly; recording-session
  tools let you add markers and chapters while you work, then upload or discard the
  session. Capture requires Playwright and Chromium in the server's environment.
- **Update a recording:** `replace_transcript` writes an agent-authored transcript
  with revision checks; `edit_recording` applies transcript-based video cuts and
  restorations with its separate editing permission.

Context-document ingestion (YouTube or local video imports via `clipy context import`)
and real desktop/screen capture are **CLI operations**. This MCP package reads imported
context documents and captures headless Chromium pages; it does not expose a
context-import tool or capture the actual desktop.

The canonical cross-surface operating contract is
**[clipy.online/agents.md](https://clipy.online/agents.md)**. For the exact
connected MCP version and schemas, use the standard `tools/list` request.
This package's local stdio tools should not be assumed to match the hosted MCP endpoint.

### Scope boundaries

| Capability | Required API-key scope |
| --- | --- |
| Search and read recording/context libraries, context bundles, diagnostics and interactions | `recordings:read` (default) |
| `record`, `start_recording`, `add_marker`, `add_chapter`, `stop_recording`, `abort_recording`, `replace_transcript` | Additionally `ingest` ("Record & upload") |
| `get_edit_transcript`, `edit_recording` | `recordings:write` (video editing; the edit transcript includes removed words) |

The API enforces resource access and scope permissions. A `recordings:read`-only key
cannot create or modify recordings. `ingest` does not grant video-editing permission;
`recordings:write` does not substitute for `ingest`. Aborting a session discards its
local capture; it is not a library-recording deletion tool. Transcript replacement
regenerates the summary and marks the text as agent-edited.

## Setup

Log in once with the Clipy CLI:

```bash
npx @clipy/cli@latest login
```

It opens your browser; click **Approve** once. The key is saved to
`~/.config/clipy/config.json`, **and this server reads that file** — so there is no key to
copy anywhere, and no secret ends up in your shell history or your MCP config.

Then add the server to your MCP client.

### Claude Code

The `--scope user` flag installs Clipy **globally** for every project. Without it,
`claude mcp add` defaults to `local` scope (the current folder only):

```bash
claude mcp add --scope user clipy -- npx -y @clipy/mcp
```

### Codex

This writes the server to your global `~/.codex/config.toml`, so it's available in every
Codex session:

```bash
codex mcp add clipy -- npx -y @clipy/mcp
```

Or add it to `~/.codex/config.toml` by hand:

```toml
[mcp_servers.clipy]
command = "npx"
args = ["-y", "@clipy/mcp"]
```

### Claude Desktop / Cursor / Windsurf

Edit the matching **user-level** config (`claude_desktop_config.json`, `~/.cursor/mcp.json`,
or the Windsurf MCP config) directly:

```json
{
  "mcpServers": {
    "clipy": {
      "command": "npx",
      "args": ["-y", "@clipy/mcp"]
    }
  }
}
```

Add an `"env": { "CLIPY_API_KEY": "clipy_sk_live_xxx" }` block only if you are not using
`clipy login` on this machine.

### Setting the key explicitly

Use `CLIPY_API_KEY` when there is no `clipy login` to read from — CI, a container — or
when you deliberately want a different key than the logged-in one. An explicit env var
always wins over the config file. Mint keys at
**https://clipy.online/settings/api-keys** (shown only once).

> **Never inline your key into the server's launch command** — e.g.
> `"command": "sh", "args": ["-c", "CLIPY_API_KEY=… npx -y @clipy/mcp"]`. Command-line
> arguments are visible to **every local process** via the process table (`ps`, `/proc`),
> so a key placed there is effectively world-readable on the machine. Put it in the `env`
> block instead. (`claude mcp add --env …` / `codex mcp add --env …` write that `env` block
> for you — they expose the key only in the argv of that single setup command, never in the
> long-running server's.)

## Tools

| Tool | What it does |
| --- | --- |
| `search_memory` | **Search the whole Clipy memory at once** — every screen recording the user made *and* every video they imported — returning the matching moments with timestamps and a URL that opens at that point. Matching is semantic as well as literal, so "login flow" finds a moment where someone said "the authentication screen". Reach for this first when the user refers to something they showed, recorded, or watched; the per-library tools below each see only half the picture. Each hit carries `kind` (`recording` or `context`) to tell you which tool to read next, a `resolution` saying whether its timestamp is an exact moment or a ~50s span, and a `semantic.status` to check before treating an empty result as "nothing recorded". |
| `search_recordings` | Search your recordings by keyword (title + description). |
| `list_recordings` | List your most recent recordings. |
| `get_recording` | Metadata for one recording (status, duration, transcript/summary status). |
| `get_transcript` | The full timestamped transcript + plaintext. |
| `get_edit_transcript` | Read indexed words, removed words, cuts, and the edit revision on the original timeline. Requires `recordings:write`, even though it reads data. |
| `edit_recording` | Apply transcript-based video cuts/restorations and optional click-based auto-zoom. Requires `recordings:write`; use `dryRun` to preview changes and `expectedRevision` to guard concurrent edits. Rendering and artifact regeneration are asynchronous. |
| `get_summary` | The AI summary: TL;DR, key points, action items. |
| `get_browser_diagnostics` | Privacy-redacted visited routes, console warnings/errors, page exceptions, and failed fetch/XHR metadata. The evidence is explicitly labelled page-reported; headers, bodies, cookies, tokens, typed values, and raw query values are never captured. |
| `get_interactions` | Bounded pages of prepared routes, pointer samples, semantic clicks, derived drags, scroll bursts, pointer dwells, coarse typing (never values or exact key counts), and highlights. Filter by `fromMs`/`toMs`/`types`, set `limit` (1–250, default 100), and follow `pagination.nextCursor` with unchanged filters. Reports source coverage and preparation state; dwell is not proof of attention and coordinates belong to the capture viewport, not transformed playback frames. |
| `wait_for_artifacts` | Poll until a recording's transcript/summary finish processing. |
| `download_recording` | Download the MP4 locally so you can clip it or extract frames yourself (e.g. with ffmpeg). |
| `get_key_moments` | Key moments: timestamps, captions, and click coordinates. |
| `get_agent_context` | The full agent-context bundle (summary + interaction timeline + key moments + transcript + available browser diagnostics) as markdown. |
| `record` | **Record a web app headlessly** and upload it as a Clipy recording; returns its share + agent-context URLs. Accepts a `type` (recording kind), `viewports` (sweep several screen sizes into one video), `storageState` / `userDataDir`+`profileDirectory` / `initScript` (record behind a login), and timestamped `notes` that become the (silent) recording's transcript. Needs Playwright in this server's environment and an `ingest`-scoped key (see below). |
| `start_recording` | **Start a recording session** that keeps recording while you work (drive the page with your own browser tools, run commands, …). Accepts `type`, `storageState` / `userDataDir`+`profileDirectory` / `initScript`, and `exposeCdp` (get a CDP endpoint + in-page `window.__clipyMark`/`window.__clipyChapter` bridge to drive the recorded page). Auto-stops + uploads at `maxSeconds` (default 600) so it can never run away. |
| `add_marker` | Drop a narration marker into the active session (live clock, or backdate with `atSeconds`) — markers become the recording's transcript chapters. Can carry evidence in one of two provenances: **clipy-verified** (`assertSelector` / `assertText` / `assertUrl`) where Clipy checks the page itself, or **driver-attested** (`observed` + `verdict`) where you report what your own tooling saw. Clipy-verified outcomes render with a verdict glyph (✓ pass, ✗ failure that can abort via `failMode`, ⚠ unverified — never a silent pass); driver-attested ones render with a weaker-looking **hedge glyph** (`≈`) so the two are never mistaken at a glance, and they are tallied in separate segments. Navigations + console errors are added automatically as `[auto]` marks. |
| `add_chapter` | Drop a `=== CHAPTER: <label> ===` boundary into the active session — split a recording into named sections (ideal for before/after demos). |
| `stop_recording` | Finish the session: close the browser, upload, return the share + agent-context URLs. |
| `abort_recording` | Discard the active session; nothing is uploaded. |
| `list_context_documents` | List the user's **context documents** — YouTube videos and local video files they imported with `clipy context import`, so agents can read them. A separate library from their own screen recordings. |
| `get_context_document` | One context document's metadata: source, duration, tags, the server's classification (video type, whether visual evidence is needed, planned moments), and which transcript/frames exist. Not the transcript itself. |
| `read_context_document` | Read a context document as compiled markdown — header, metadata, then the timestamped transcript with frame captions interleaved. Takes `startMs`/`endMs` so you can walk a two-hour video section by section instead of flooding your context. |
| `replace_transcript` | **Replace a recording's transcript** with text you author (needs the `ingest` scope). Call `get_transcript` first and pass its `revision`; stale replacements are rejected instead of overwriting a concurrent edit. The summary regenerates automatically. Marked as agent-edited, never passed off as speech-to-text. |

Read tools accept a recording's **public id** (the slug in its share URL) or the full
`https://clipy.online/video/<id>` URL.

> **Capturing the real screen is CLI-only.** These tools record a headless Chromium page.
> To record the actual Mac screen or a window's initial screen area (ScreenCaptureKit — the real
> logged-in browser), use the Clipy CLI: `clipy record --source mac-screen --window "<app>"`.

### Using `record`

`record` opens a URL in a headless Chromium (works in CI / cloud sandboxes, no display),
records for a few seconds, and streams it into Clipy — then returns the id so you can call
`wait_for_artifacts` and `get_agent_context` to read it back. It needs:

1. **Playwright** in the environment running this MCP server:
   ```bash
   npm install -g playwright && npx playwright install chromium
   ```
2. An API key with the **"Record & upload" (ingest)** permission — choose it when you mint
   the key at [clipy.online/settings/api-keys](https://clipy.online/settings/api-keys).

Parameters: `url` (required, http/https), `durationSeconds` (default 15, max 300, applied
per viewport pass), `name`, `description`, `type` (recording kind — `bug_report`,
`feature_request`, `product_demo`, `walkthrough_tutorial`, `feedback_review`,
`discussion_talk`, `other`, plus aliases), `viewports` (e.g. `mobile,desktop` or
`390x844,1440x900` — recorded sequentially into one video, frame sized to the largest,
each pass slow-scrolled and auto-chaptered), `storageState` / `initScript` (paths, never
logged), `notes`, and `width`/`height` (default 1280×720, ignored when `viewports` is set).

**Recording behind a login.** `storageState` seeds exactly what its JSON contains (cookies +
localStorage) but can't reproduce a whole browser identity (IndexedDB, service workers, some
cross-origin auth). For a full identity, pass `userDataDir` — Chrome's **user-data root**
(macOS: `~/Library/Application Support/Google/Chrome`) — in one of two modes:

- **Copy a named profile (recommended).** Add `profileDirectory` (`"Profile 1"`, `"Default"`, …
  — the exact folder from `chrome://version` → *Profile Path*). Clipy **copies** that profile
  into a temporary root and records the copy, so your real profile is never opened or modified
  and the copy is deleted after upload. The tool result discloses the copy (profile name, bytes,
  and a warning if Chrome was running while it was copied).

  > ⚠️ **macOS: cookie logins may not survive the copy.** Chrome encrypts cookies with the
  > *Chrome Safe Storage* Keychain key; the recorder's bundled Chromium looks for *Chromium Safe
  > Storage*. So on macOS a copied profile can produce a browser that **looks like your identity
  > but is silently logged out** wherever the session is cookie-based — `localStorage`/
  > `Preferences`-based sessions still work. This is a pre-existing Playwright-vs-Chrome
  > constraint, not something the copy introduces, and the copy disclosure repeats it. **If the
  > recording lands logged out, that's why.** Record the real browser with the CLI's
  > `clipy record --source mac-screen`, or drive your own browser and attach evidence via
  > `add_marker`'s `observed`/`verdict`.
- **Open the `Default` profile directly.** Omit `profileDirectory`. Clipy opens the root's
  `Default` profile **and writes to it**, so it's refused while a live Chrome holds it locked —
  quit Chrome first. When the dir looks like a real Chrome root, the result carries a
  `userDataDirWarning` saying so and pointing you at `profileDirectory` (ephemeral copy) or the
  CLI's `--source mac-screen` instead. Prefer those unless you specifically want in-place use.

> Playwright **strips** Chromium's `--profile-directory` (it always loads `Default` from whatever
> dir it's given), so copying is the only way to record a named profile. Pointing `userDataDir`
> at a profile subdir (`.../Chrome/Default`) is **refused** — launching from there would silently
> record a blank, logged-out profile.

`storageState` and `userDataDir` are mutually exclusive; `profileDirectory` requires `userDataDir`.

### Check the camera before you work

`record` and `start_recording` both return a `source` object describing **what is actually
being recorded**, resolved fresh at start time — the post-redirect `url`, the page `title`,
and the recording `viewport`:

```json
"source": {
  "kind": "headless_browser",
  "title": "Orders — Admin",
  "url": "https://app.example.com/orders",
  "viewport": { "width": 1280, "height": 720 }
}
```

Compare it against the surface your driver is acting on **before** doing minutes of work.
This exists because driver-attested evidence proves what the *driver* observed and nothing
ties it to what the *camera* saw — it's entirely possible to produce truthful marks over
footage of the wrong thing. **Clipy will never focus or foreground a window or tab for you**;
pointing the driver and the camera at the same surface is the caller's job.

`kind` is always `headless_browser` here: these tools record a headless page Clipy owns.
Capturing a real application's initial screen area or a display is CLI-only
(`clipy record --source mac-screen --window "<app>"`), so no window id or window title is
reported — an empty or invented one would be exactly the kind of false confidence this
field exists to prevent.

### Evidence on a marker: two provenances

`add_marker` can carry evidence in exactly one of two provenances — they are tallied and rendered
separately, never pooled:

| Provenance | How | What it means |
| --- | --- | --- |
| **clipy-verified** | `assertSelector` / `assertText` / `assertUrl` | Clipy checked the recorded page itself. Strongest evidence. Renders `[assert ✓ verified-by-clipy; …]`, or `[ASSERT ✗ verified-by-clipy; …]`, or `[ASSERT ⚠ clipy could not evaluate — …]` when it couldn't check. |
| **driver-attested** | `observed` + `verdict` (both required) | *You* report what your own tooling saw. Clipy vouches only that you **said** it — not that it verified it — which is falsifiable against the recorded frames. Renders with a **hedge glyph** rather than a verdict glyph: `[≈ ASSERT driver-attested; observed=…]`, or `[≈ FAILED driver-attested; observed=…]`. |

Use **driver-attested** when your agent drives its own browser/tooling while Clipy records (e.g.
`--source mac-screen` on the CLI) or when there's no Clipy-owned page to assert against. It's
weaker than clipy-verified but far stronger than plain prose. The transcript's leading
`[verification]` note segments the two, e.g.
`[verification] 3 clipy-verified: 2 passed, 1 failed · 2 driver-attested: 2 passed, 0 failed`.

### Driving the recorded page over CDP (`start_recording` + `exposeCdp: true`)

Pass `exposeCdp: true` to `start_recording` and the recording browser opens a Chrome
DevTools Protocol endpoint; the result returns `cdpHttpUrl` + `cdpUrl`. Connect your own
Playwright and drive the page while Clipy records it:

```js
const { chromium } = require("playwright");
const browser = await chromium.connectOverCDP(cdpHttpUrl);
const page = browser.contexts()[0].pages()[0]; // the page being recorded
await page.goto("http://localhost:3000/settings");
await browser.close();                          // detaches; the recording keeps going
```

It's **off by default** — while it's open, any local process can attach to that browser.
`CLIPY_DISABLE_CDP=1` is a hard kill switch that forces it off. Gotchas: the recorded page
is `contexts()[0].pages()[0]` (a new context you open won't be captured); `page.viewportSize()`
reads `null` over a CDP attach; and to change the viewport use `newCDPSession` +
`Emulation.setDeviceMetricsOverride`, not `setViewportSize`.

**In-page bridge (zero extra tool calls).** When `exposeCdp` is on, the recorded page also
exposes `window.__clipyMark(text, opts?)` and `window.__clipyChapter(label)`, so your CDP
driver can drop asserted marks/chapters from inside the page:

```js
await page.evaluate(() =>
  window.__clipyMark("saved the form", { assertSelector: ".toast", assertText: "Saved" }),
);
await page.evaluate(() => window.__clipyChapter("AFTER — fix applied"));
```

`opts` mirrors `add_marker` (`assertSelector` / `assertText` / `assertUrl` / `failMode`);
`assertText` requires `assertSelector` (the call rejects otherwise), and a failed assert with
`failMode: "abort"` discards the session — same annotations and tally as the tools.

## Config

| Env var | Required | Default | Notes |
| --- | --- | --- | --- |
| `CLIPY_API_KEY` | no | `apiKey` from `~/.config/clipy/config.json` | Your personal key from `/settings/api-keys`. Set it only when `clipy login` has not run on this machine; when set it overrides the config file. |
| `CLIPY_API_URL` | no | `https://clipy.online` | Override for self-hosted/staging. |

## Privacy

Your key only ever reads **your own** recordings. Revoke it any time at
`/settings/api-keys`. The server runs locally on your machine; your key is never sent
anywhere except to the Clipy API over HTTPS.
