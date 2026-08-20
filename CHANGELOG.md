# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); this project uses [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Cross-agent support: canonical `AGENTS.md` with `CLAUDE.md`/`GEMINI.md` pointers, and per-agent plugin manifests (`.codex-plugin`, `.cursor-plugin`, `.kimi-plugin`, `.opencode`, `.pi`, `gemini-extension.json`) that all reuse the one `skills/` directory.
- `mobile-release-kit` MCP server (`scripts/mcp-server.js`) exposing `frame_screenshots` + `contact_sheet` over stdio, with a committable `.mcp.json`.
- `driving-a-release` skill + `RELEASE-CHECKLIST.md` template: a guided, resumable release that tracks state in a checklist file and a live TODO, stopping at every billed/irreversible step.
- `feature-graphic` render mode (1024×500 Play banner, no device chassis).
- `release-notes.txt` template; localization workflow in `writing-store-listings`.
- CI: GitHub Actions workflow + zero-dependency validators (`validate-kit.js`, `test-mcp-boot.js`).

### Added
- `popout` render mode: a region of the raw re-rendered as an enlarged panel breaking the device edge (the "card lifted off the screen" hero shot), with fraction-based crops and `popout@<device-key>` per-device overrides.
- `logo` (PNG wordmark replacing the text eyebrow) and `headScale` (shrink a long headline without a bespoke device entry) screen options.
- `capturing-store-screenshots-live`: full Android emulator workflow — `adb exec-out screencap`, SystemUI demo mode, pointing a debug APK at a custom Metro via `debug_http_host`, and the Android-specific traps (stale embedded bundle, ANR on dev-bundle reload, edge-to-edge status bar, Hermes locale fallback).
- `capturing-store-screenshots-live`: "pin the target device on every driver command" — an unpinned UI driver can silently drive the *other* booted device while every tap reports success, plus the symptoms that distinguish it from a broken app.
- `capturing-store-screenshots-live`: gated-feature capture — server-side entitlement, stale `/me` after login, and the account switch that empties anonymously-seeded favorites.
- `writing-store-listings`: "anonymous-first ≠ no credentials needed" — reconcile review notes against the final screenshot set, and Play's App content → App access declaration.
- `driving-a-release`: scope screenshots before quoting a timeline; log capture-time app defects as findings rather than fixing them inline.

- `releasing-with-eas`: §1b artifact gate — grep the release bundle for a value that must be in it, before uploading. Covers the `EXPO_PUBLIC_*` static-inlining rule (a computed `process.env[key]` inlines nothing and fails only in release, because Metro populates `process.env` at runtime), the binary-grep trap (`grep -c` on Hermes bytecode returns 0 either way; `-a` is mandatory), the value/name truth table, the `expo export` fast loop, and the plist assertions.
- `releasing-with-eas`: build profiles receive EAS environment variables only when the profile declares `"environment"`; without it a production build silently gets none.
- `docs/prompts/audit-env-inlining.md`: a portable, self-contained prompt to audit any Expo app for the same defect, with the equivalent breakage in Vite / Next.js / CRA.

### Fixed
- Android phone default `1080×2400` → `1080×1920` (1080×2400 exceeds Google Play's 1:2–2:1 aspect cap and is rejected at upload).
- **Same fix carried into `templates/frames.config.json` and `framing-store-screenshots/SKILL.md`**, which still said `1080×2400`. The template mattered most: a project config's `devices` block *overrides* the built-in, so copying the template re-introduced the rejected size silently. Both now note that the aspect-mismatch warning on Android is expected, not a defect.
- Dropped the dead `iphone-6.5` device size (no longer an accepted App Store slot).
- `eas submit` now submits by build ID, not blind `--latest` (which is per-platform and can grab a stale/failed build).
- Renderer now HTML-escapes headline/eyebrow copy, warns on raw aspect/size mismatch, and no longer requires a `rawDir` in feature-graphic mode.
- Tightened the web-capture empty-screen detection (a bare `error` substring matched legitimate content).
- `docs/store-specs.md` is now the single source of truth (added the iOS no-alpha icon rule, Play 2:1 aspect cap, dark-mode consistency, release-notes limit).

## [0.1.0] — initial

- Five skills (framing, live capture, web capture, EAS release, store listings), `/frame-screenshots` + `/release` commands, a `release-orchestrator` agent, a build-artifact guard hook.
- Config-driven device-frame renderer, contact-sheet, and iOS-simulator capture scripts.
- Templates: `eas.json`, store-listing + `PUBLISH`/`PREFLIGHT` runbooks, `frames.config.json`, gitignore snippet.
- Docs: release-tree convention, store specs.
