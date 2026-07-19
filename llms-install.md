# Installing the Clipy MCP server (for AI agents)

`@clipy/mcp` is a stdio MCP server distributed on npm. It needs Node.js >= 18 and one
environment variable: `CLIPY_API_KEY`.

## Step 1 — get an API key

Ask the user to create a free API key at https://clipy.online/settings/api-keys
(it looks like `clipy_sk_live_…` and is shown only once). Do not proceed without it.

## Step 2 — add the server to the MCP client config

The generic config shape (works for Cline, Claude Desktop, Cursor, Windsurf, and any
client that accepts `mcpServers` JSON):

```json
{
  "mcpServers": {
    "clipy": {
      "command": "npx",
      "args": ["-y", "@clipy/mcp"],
      "env": {
        "CLIPY_API_KEY": "clipy_sk_live_xxx"
      }
    }
  }
}
```

CLI installs:

```bash
# Claude Code (user scope = all projects)
claude mcp add --scope user clipy --env CLIPY_API_KEY=clipy_sk_live_xxx -- npx -y @clipy/mcp

# Codex
codex mcp add clipy --env CLIPY_API_KEY=clipy_sk_live_xxx -- npx -y @clipy/mcp
```

## Step 3 — verify

Call the `list_recordings` tool. A valid setup returns the user's recent recordings
(or an empty list). An `Invalid API key` error means `CLIPY_API_KEY` is wrong.

## Notes

- Read tools need the default `recordings:read` scope. The `record` and transcript-edit
  tools require a key with the `ingest` scope (enforced server-side), so a
  `recordings:read`-only key can never create, modify, or delete recordings.
- No other configuration is required. `CLIPY_API_URL` may optionally override the API
  base URL (defaults to `https://clipy.online`) — only needed for self-hosted setups.
