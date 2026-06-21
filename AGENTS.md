# AGENTS.md — Mobile Release Kit

Instructions for any AI coding agent working in, or using, this repo. This is the canonical agent-instructions file; `CLAUDE.md` and `GEMINI.md` point here.

## What this is

A toolkit for shipping **Expo / React Native** apps to the **App Store** and **Google Play**: capture store screenshots, frame them into marketing images, and run the EAS build/submit release. It's both a **Claude Code / Codex / Cursor / Kimi plugin** (skills + commands + an agent) and a set of **standalone Node/Bash scripts** that any agent can run via its shell tool.

The skills under `skills/` are the source of truth for *how* to do each task. When a task matches one, read and follow that skill rather than improvising.

## Capabilities → which skill

- **Frame raw screenshots into store marketing images** → `skills/framing-store-screenshots/SKILL.md`
- **Capture native screenshots from iOS Simulators (live / hero screens)** → `skills/capturing-store-screenshots-live/SKILL.md`
- **Capture screenshots from the Expo web bundle (fast static batches)** → `skills/capturing-store-screenshots-web/SKILL.md`
- **Build + submit with EAS** → `skills/releasing-with-eas/SKILL.md`
- **Run the release as a guided, resumable, checklist-tracked flow** → `skills/driving-a-release/SKILL.md`
- **Write listing copy + review notes** → `skills/writing-store-listings/SKILL.md`

## Scripts (run via your shell tool)

All live in `scripts/`. They need Node + Playwright with a Chromium:

```bash
npm i -D playwright && npx playwright install chromium
# in a monorepo that already has Playwright: prefix with NODE_PATH=<repo>/node_modules
```

- **Frame screenshots** — render raw `<screen>.png`s into store images at exact pixel sizes:
  ```bash
  node scripts/frame-screenshots.js <config.json> <rawDir> <outDir> <device>
  # device: iphone-6.9 | ipad-13 | android-phone | android-tablet
  ```
  Copy `templates/frames.config.json` and edit palette / per-screen `eyebrow`+`head` copy / `order` (frame 1 = the most exciting screen).

- **Contact sheet** — tile a set to review it at once:
  ```bash
  node scripts/contact-sheet.js <dir> <out.png> [cols]
  ```

- **Simulator capture** (macOS only — uses `xcrun simctl`):
  ```bash
  ./scripts/sim-capture.sh <UDID> raw/<screen>.png [phone|pad]   # clean 9:41 status bar + native res
  ```

- **MCP server** — the framing + contact-sheet tools, exposed over stdio MCP for agents that prefer a typed tool surface to bash:
  ```bash
  node scripts/mcp-server.js
  ```

## Tasks

- **"Frame these screenshots"** → follow `framing-store-screenshots`: ensure a frames config exists (copy the template), run `frame-screenshots.js` per device size, then a contact sheet; verify the output isn't empty/broken and read it back.
- **"Capture store screenshots"** → pick live-simulator (real/hero screens, macOS) or web-bundle (static batches, CI) per the two capture skills.
- **"Ship / release / submit the app"** → follow `releasing-with-eas`: walk `templates/PREFLIGHT.md`, then build, then submit. **Never run `eas build` / `eas submit` without explicit human confirmation** — they are billed and outward-facing.

## Hard rules

- Never run `eas build` / `eas submit`, push, publish, or any billed/irreversible/outward-facing action without explicit human confirmation. Show the exact command first.
- Never fabricate Apple or Google identifiers (Apple ID, ASC app id, team id, service-account paths, reversed client IDs). Leave `REPLACE_WITH_*` markers and ask.
- **Never commit secrets** — the Google Play service-account JSON, `.p8` keys, `.env` files. And never commit build artifacts (`build-*.aab`, `build-*.ipa`, `*.apk` — they're large and gitignored).
- Store screenshots must show real, populated screens — assert no empty/error state before treating a capture as done.
- Listing review notes need demo credentials that actually work (Apple rejects under Guideline 2.1 otherwise).

## Conventions

- Plain Node (no build step) + Bash. Scripts are config/argument-driven; no per-app code edits.
- Release artifacts for a target app are organized under `docs/ops/mobile-releases/v<version>/` — see `docs/release-tree.md`.
- Store pixel sizes and listing character limits are in `docs/store-specs.md` (verify against current Apple/Google docs before submitting).
