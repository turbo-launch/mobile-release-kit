# Installing Mobile Release Kit for OpenCode

## Prerequisites
- [OpenCode.ai](https://opencode.ai) installed

## Installation
Add the kit to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["mobile-release-kit@git+https://github.com/turbo-launch/mobile-release-kit.git"]
}
```

Restart OpenCode. It registers the skills via OpenCode's plugin manager.
Verify by asking: "Frame these store screenshots."

OpenCode uses its own plugin install — if you also use Claude Code, Codex, or
another harness, install the kit separately for each one.
