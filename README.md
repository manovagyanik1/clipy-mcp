# @clipy/mcp

Give your AI agent access to your [Clipy](https://clipy.online) screen recordings.

> This repository is the public mirror of **`@clipy/mcp`** (MIT). The package is developed
> in the Clipy monorepo and synced here with each npm release, so this is the place to
> browse the source and file issues. The published package lives on npm as
> [`@clipy/mcp`](https://www.npmjs.com/package/@clipy/mcp).

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets
Claude, Cursor, Windsurf, and other MCP-capable agents **search your recordings and read
their transcripts and AI summaries** — so you can do things like _"turn this bug-report
recording into a Linear ticket"_ without leaving your agent — and, with the `record`
tool, **record a web app headlessly** and get it back as a Clipy recording (_"build the
feature, then record the outcome"_).

Every tool except `record` is **read-only**. `record` is the only one that creates a
recording, and only when your key carries the `ingest` scope.

## Setup

1. Create a free API key at **https://clipy.online/settings/api-keys** (it looks like
   `clipy_sk_live_…`). Copy it — it's shown only once.
2. Add the server to your MCP client.

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
| `record` | **Record a web app headlessly** and upload it as a Clipy recording; returns its share + agent-context URLs. Accepts timestamped `notes` that become the (silent) recording's transcript. Needs Playwright in this server's environment and an `ingest`-scoped key (see below). |
| `start_recording` | **Start a recording session** that keeps recording while you work (drive the page with your own browser tools, run commands, …). Auto-stops + uploads at `maxSeconds` (default 600) so it can never run away. |
| `add_marker` | Drop a live-timestamped narration marker into the active session — markers become the recording's transcript chapters. Navigations + console errors are added automatically as `[auto]` marks. |
| `stop_recording` | Finish the session: close the browser, upload, return the share + agent-context URLs. |
| `abort_recording` | Discard the active session; nothing is uploaded. |

Read tools accept a recording's **public id** (the slug in its share URL) or the full
`https://clipy.online/video/<id>` URL.

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

Parameters: `url` (required, http/https), `durationSeconds` (default 15, max 300), `name`,
`width`/`height` (default 1280×720).

## Config

| Env var | Required | Default | Notes |
| --- | --- | --- | --- |
| `CLIPY_API_KEY` | yes | — | Your personal key from `/settings/api-keys`. |
| `CLIPY_API_URL` | no | `https://clipy.online` | Override for self-hosted/staging. |

## Privacy

Your key only ever reads **your own** recordings. Revoke it any time at
`/settings/api-keys`. The server runs locally on your machine; your key is never sent
anywhere except to the Clipy API over HTTPS.
