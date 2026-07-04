# Contributing

Issues and PRs welcome.

- Build: `npm install && npm run build`
- The server talks to the Clipy API (`https://clipy.online`) with a personal
  API key (`CLIPY_API_KEY`, create one at clipy.online/settings/api-keys).
- Keep it read-only: this server must never gain tools that create, modify,
  or delete recordings.
- One tool = one clear job; descriptions are written for the agent reading
  them, not for humans.
