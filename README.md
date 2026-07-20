# @clipy/mcp

Give your AI agent access to your [Clipy](https://clipy.online) screen recordings.

> Developed in the Clipy monorepo. A public mirror for browsing the source and filing
> issues lives at **[github.com/manovagyanik1/clipy-mcp](https://github.com/manovagyanik1/clipy-mcp)**
> (MIT), kept in sync with each npm release.

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets
Claude, Cursor, Windsurf, and other MCP-capable agents **search your recordings and read
their transcripts and AI summaries** — so you can do things like _"turn this bug-report
recording into a Linear ticket"_ without leaving your agent — and, with the `record`
tool, **record a web app headlessly** and get it back as a Clipy recording (_"build the
feature, then record the outcome"_).

The read tools need the `recordings:read` scope, which every key gets by default. The
write tools — `record`, the session tools (`start_recording`, `add_marker`, `add_chapter`,
`stop_recording`, `abort_recording`), and `replace_transcript` — additionally need the
key to carry the `ingest` scope ("Record & upload"), which the server enforces. A
`recordings:read`-only key can read your recordings but cannot create, modify, or
delete anything.

## Setup

This is a headless server process, so it authenticates with a Clipy API key in the
`CLIPY_API_KEY` env var (it looks like `clipy_sk_live_…`). The easiest way to get one is
the Clipy CLI's browser login:

```bash
npx @clipy/cli@latest login
```

It opens your browser; click **Approve** once. The key is saved to
`~/.config/clipy/config.json` — copy its `apiKey` value into `CLIPY_API_KEY` when you add
the server below.

**Prefer to mint one by hand?** Create a key at
**https://clipy.online/settings/api-keys** instead (it's shown only once — copy it
immediately).

Then add the server to your MCP client.

> **Never inline your key into the server's launch command** — e.g.
> `"command": "sh", "args": ["-c", "CLIPY_API_KEY=… npx -y @clipy/mcp"]`. Command-line
> arguments are visible to **every local process** via the process table (`ps`, `/proc`),
> so a key placed there is effectively world-readable on the machine. Always put it in the
> `env` block, exactly as every example below does. (The one-time `claude mcp add --env …` /
> `codex mcp add --env …` helpers below write that `env` block for you — they expose the key
> only in the argv of that single setup command, never in the long-running server's.)

### Claude Code

The `--scope user` flag installs Clipy **globally** for every project. Without it,
`claude mcp add` defaults to `local` scope (the current folder only):

```bash
claude mcp add --scope user clipy --env CLIPY_API_KEY=clipy_sk_live_xxx -- npx -y @clipy/mcp
```

### Codex

This writes the server to your global `~/.codex/config.toml`, so it's available in every
Codex session:

```bash
codex mcp add clipy --env CLIPY_API_KEY=clipy_sk_live_xxx -- npx -y @clipy/mcp
```

Or add it to `~/.codex/config.toml` by hand:

```toml
[mcp_servers.clipy]
command = "npx"
args = ["-y", "@clipy/mcp"]
env = { CLIPY_API_KEY = "clipy_sk_live_xxx" }
```

### Claude Desktop / Cursor / Windsurf

Edit the matching **user-level** config (`claude_desktop_config.json`, `~/.cursor/mcp.json`,
or the Windsurf MCP config) directly:

```json
{
  "mcpServers": {
    "clipy": {
      "command": "npx",
      "args": ["-y", "@clipy/mcp"],
      "env": { "CLIPY_API_KEY": "clipy_sk_live_xxx" }
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `search_recordings` | Search your recordings by keyword (title + description). |
| `list_recordings` | List your most recent recordings. |
| `get_recording` | Metadata for one recording (status, duration, transcript/summary status). |
| `get_transcript` | The full timestamped transcript + plaintext. |
| `get_summary` | The AI summary: TL;DR, key points, action items. |
| `wait_for_artifacts` | Poll until a recording's transcript/summary finish processing. |
| `download_recording` | Download the MP4 locally so you can clip it or extract frames yourself (e.g. with ffmpeg). |
| `get_key_moments` | Key moments: timestamps, captions, and click coordinates. |
| `get_agent_context` | The full agent-context bundle (summary + key moments + transcript) as markdown. |
| `record` | **Record a web app headlessly** and upload it as a Clipy recording; returns its share + agent-context URLs. Accepts a `type` (recording kind), `viewports` (sweep several screen sizes into one video), `storageState` / `userDataDir`+`profileDirectory` / `initScript` (record behind a login), and timestamped `notes` that become the (silent) recording's transcript. Needs Playwright in this server's environment and an `ingest`-scoped key (see below). |
| `start_recording` | **Start a recording session** that keeps recording while you work (drive the page with your own browser tools, run commands, …). Accepts `type`, `storageState` / `userDataDir`+`profileDirectory` / `initScript`, and `exposeCdp` (get a CDP endpoint + in-page `window.__clipyMark`/`window.__clipyChapter` bridge to drive the recorded page). Auto-stops + uploads at `maxSeconds` (default 600) so it can never run away. |
| `add_marker` | Drop a narration marker into the active session (live clock, or backdate with `atSeconds`) — markers become the recording's transcript chapters. Can carry evidence in one of two provenances: **clipy-verified** (`assertSelector` / `assertText` / `assertUrl`) where Clipy checks the page itself, or **driver-attested** (`observed` + `verdict`) where you report what your own tooling saw. Clipy-verified outcomes render with a verdict glyph (✓ pass, ✗ failure that can abort via `failMode`, ⚠ unverified — never a silent pass); driver-attested ones render with a weaker-looking **hedge glyph** (`≈`) so the two are never mistaken at a glance, and they are tallied in separate segments. Navigations + console errors are added automatically as `[auto]` marks. |
| `add_chapter` | Drop a `=== CHAPTER: <label> ===` boundary into the active session — split a recording into named sections (ideal for before/after demos). |
| `stop_recording` | Finish the session: close the browser, upload, return the share + agent-context URLs. |
| `abort_recording` | Discard the active session; nothing is uploaded. |
| `replace_transcript` | **Replace a recording's transcript** with text you author (needs the `ingest` scope). Fix a bad speech-to-text pass, translate, or enrich a silent agent capture; the summary regenerates automatically. Marked as agent-edited, never passed off as speech-to-text. |

Read tools accept a recording's **public id** (the slug in its share URL) or the full
`https://clipy.online/video/<id>` URL.

> **Capturing the real screen is CLI-only.** These tools record a headless Chromium page.
> To record the actual Mac screen or a specific window (ScreenCaptureKit — the real
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
Capturing a real application window or display is CLI-only
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
| `CLIPY_API_KEY` | yes | — | Your personal key from `/settings/api-keys`. |
| `CLIPY_API_URL` | no | `https://clipy.online` | Override for self-hosted/staging. |

## Privacy

Your key only ever reads **your own** recordings. Revoke it any time at
`/settings/api-keys`. The server runs locally on your machine; your key is never sent
anywhere except to the Clipy API over HTTPS.
