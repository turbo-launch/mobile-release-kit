# Contributing

Thanks for helping make shipping mobile apps less painful. This is a small,
focused toolkit — contributions that keep it sharp and correct are very welcome.

## Ground rules

- **Correctness over surface area.** A wrong pixel size or EAS flag is worse than a missing feature. Store specs and limits change — cite the current Apple/Google/Expo docs in your PR when you touch them.
- **One source of truth.** Screenshot sizes and listing limits live in [`docs/store-specs.md`](docs/store-specs.md). Don't restate them elsewhere; link to it.
- **No content duplicated per agent.** Skills live once in `skills/`; the per-agent manifests reuse them. `AGENTS.md` is canonical; `CLAUDE.md`/`GEMINI.md` point at it.
- **Safety first.** The kit must never run `eas build`/`eas submit` or any billed/irreversible action without explicit human confirmation, and never fabricate Apple/Google IDs.

## Develop

```bash
npm install
npm run validate     # structural checks (JSON, frontmatter, references)
npm run test:mcp     # MCP server boots and advertises its tools
```

CI runs `validate`, syntax-checks the scripts, boots the MCP server, and renders
a frame end-to-end on every push/PR. If you have Claude Code, also run
`claude plugin validate . --strict` (the authoritative local gate).

## Authoring skills

Follow the SKILL.md conventions: YAML frontmatter with only `name` + `description`
(third person, "Use when…", ≤1024 chars), body concise. Keep references one level
deep. See any existing skill for the shape.

## Pull requests

- Keep PRs focused; one concern each.
- Update `CHANGELOG.md` under `[Unreleased]`.
- Make sure `npm run validate` and `npm run test:mcp` pass.

By contributing you agree your work is licensed under the repo's [MIT License](LICENSE).
