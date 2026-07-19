# Contributing

Issues and PRs welcome.

- Build: `npm install && npm run build`
- The server talks to the Clipy API (`https://clipy.online`) with a personal
  API key (`CLIPY_API_KEY`, create one at clipy.online/settings/api-keys).
- Respect the auth boundary: read tools work with any key; the write tools
  (`record`, the session tools, `replace_transcript`) must require the key's
  `ingest` scope, which the server enforces — a read-only key can never create,
  modify, or delete recordings.
- One tool = one clear job; descriptions are written for the agent reading
  them, not for humans.
