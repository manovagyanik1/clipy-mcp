# @clipy/mcp

Give your AI agent access to your [Clipy](https://clipy.online) screen recordings.

This is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. It lets
Claude, Cursor, Windsurf, and other MCP-capable agents **search your recordings and read
their transcripts, AI summaries, and key moments** — including the video frames of
exactly what the speaker pointed at, delivered as inline images your agent can see. So
you can do things like _"read this bug-report recording and ship the fix"_ without
leaving your agent.

> **Zero-setup alternative:** every public Clipy share link is also agent-readable
> without this server — append `.md` (e.g. `clipy.online/video/<id>.md`) and any agent
> that can fetch a URL gets the summary, key moments with frames, and timestamped
> transcript. The MCP server adds private-library search, inline frame images, and
> one-call context bundles. More at [clipy.online/for-agents](https://clipy.online/for-agents).

It is **read-only**: it can never create, edit, or delete your recordings.

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

All tools accept a recording's **public id** (the slug in its share URL) or the full
`https://clipy.online/video/<id>` URL.

## Config

| Env var | Required | Default | Notes |
| --- | --- | --- | --- |
| `CLIPY_API_KEY` | yes | — | Your personal key from `/settings/api-keys`. |
| `CLIPY_API_URL` | no | `https://clipy.online` | Override for self-hosted/staging. |

## Privacy

Your key only ever reads **your own** recordings. Revoke it any time at
`/settings/api-keys`. The server runs locally on your machine; your key is never sent
anywhere except to the Clipy API over HTTPS.
