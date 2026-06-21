# Publishing & launch checklist (maintainer)

Before announcing the kit anywhere, verify each advertised install path **in a
fresh session** — a broken first command is the fastest way to lose a new user.
Don't advertise a path you haven't run yourself.

## 0 · Repo state
- [ ] Repo is **public**.
- [ ] CI is **green** on `main` (Actions tab / the README badge).
- [ ] Repo has a **description** and **topics** set (see commands below).
- [ ] `package.json`, `README`, manifests all say `turbo-launch/mobile-release-kit` (no stray placeholders).

## 1 · Install paths — test each in a clean session, then keep only the ones that work

> The README lists these. Each must actually resolve. If a marketplace path
> doesn't (some ecosystems expect a *separate* `-marketplace` repo), either fix
> the setup or replace that row with the "clone the repo" fallback.

- [ ] **Claude Code:** `/plugin marketplace add turbo-launch/mobile-release-kit` then `/plugin install mobile-release-kit@turbo-launch` → the skills + `/mobile-release-kit:*` commands appear. (If marketplace resolution fails, a separate `turbo-launch/mobile-release-kit-marketplace` repo may be needed — that's how some plugins do it.)
- [ ] **Gemini CLI:** `gemini extensions install https://github.com/turbo-launch/mobile-release-kit` → the extension loads and `GEMINI.md` is read.
- [ ] **Codex / Cursor / Kimi:** confirm the marketplace listing path, or document the "clone the repo, it reads `AGENTS.md`" fallback.
- [ ] **AGENTS.md-only agents** (Copilot/Windsurf/Amp/Cline/Zed): clone into a project, confirm the agent picks up `AGENTS.md` and can run a script.
- [ ] **Standalone:** `git clone …; npm install; npx playwright install chromium; node scripts/frame-screenshots.js …` produces a framed PNG.
- [ ] **MCP:** add `.mcp.json` to one agent, confirm `frame_screenshots` shows up as a tool.

## 2 · First-run sanity
- [ ] Clone fresh, `npm install`, `npm run validate` and `npm run test:mcp` both pass.
- [ ] Render the feature graphic + one device frame from the template config; eyeball them.
- [ ] README renders on GitHub: hero image shows, CI badge green, all anchors work.

## 3 · GitHub setup (run once — replace OWNER/REPO if forked)
```bash
gh repo edit turbo-launch/mobile-release-kit \
  --description "Ship Expo/RN apps to the App Store & Play Store: store-screenshot capture, device-frame rendering, and an EAS release runbook. Claude Code / Codex / Cursor / Gemini plugin + standalone scripts." \
  --add-topic expo --add-topic react-native --add-topic eas --add-topic app-store \
  --add-topic google-play --add-topic app-store-screenshots --add-topic aso \
  --add-topic claude-code --add-topic mcp --add-topic ai-agents
# optional: tag a release once the install paths are verified
# git tag v0.1.0 && git push origin v0.1.0 && gh release create v0.1.0 --generate-notes
```

## 4 · Then announce
See [`docs/announce.md`](docs/announce.md) for ready-to-paste launch copy and the
channel list. Lead with the demo GIF, link the repo, be honest about scope.
