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
| `record` | **Record a web app headlessly** and upload it as a Clipy recording; returns its share + agent-context URLs. Accepts a `type` (recording kind), `viewports` (sweep several screen sizes into one video), `storageState`/`initScript` (record behind a login), and timestamped `notes` that become the (silent) recording's transcript. Needs Playwright in this server's environment and an `ingest`-scoped key (see below). |
| `start_recording` | **Start a recording session** that keeps recording while you work (drive the page with your own browser tools, run commands, …). Accepts `type`, `storageState`/`initScript`, and `exposeCdp` (get a CDP endpoint to drive the recorded page). Auto-stops + uploads at `maxSeconds` (default 600) so it can never run away. |
| `add_marker` | Drop a narration marker into the active session (live clock, or backdate with `atSeconds`) — markers become the recording's transcript chapters. Can also **verify** on-screen state (`assertSelector` / `assertText` (requires a selector) / `assertUrl`, `failMode`); a failed assertion is annotated as an explicit failure and can abort the session. Navigations + console errors are added automatically as `[auto]` marks. |
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

## Config

| Env var | Required | Default | Notes |
| --- | --- | --- | --- |
| `CLIPY_API_KEY` | yes | — | Your personal key from `/settings/api-keys`. |
| `CLIPY_API_URL` | no | `https://clipy.online` | Override for self-hosted/staging. |

## Privacy

Your key only ever reads **your own** recordings. Revoke it any time at
`/settings/api-keys`. The server runs locally on your machine; your key is never sent
anywhere except to the Clipy API over HTTPS.
