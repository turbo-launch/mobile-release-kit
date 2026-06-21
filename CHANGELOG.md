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

### Fixed
- Android phone default `1080×2400` → `1080×1920` (1080×2400 exceeds Google Play's 1:2–2:1 aspect cap and is rejected at upload).
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
