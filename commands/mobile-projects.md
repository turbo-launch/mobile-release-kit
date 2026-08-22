---
description: List every registered mobile app with its local version and what is live in the App Store
---

Show the mobile app inventory:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/mobile-projects.mjs $ARGUMENTS
```

The registry holds only paths (at `~/.claude/mobile-release-kit/registry.json`); versions and
identifiers are read from each project on every run, so the output cannot go stale.

If nothing is registered, register the current project (`register`), or ask the user which
paths to add — do not guess by scanning the filesystem.

Reading the output:

- **LOCAL ≠ APP STORE** — the interesting row. Usually a version bumped and committed but
  never submitted, or a build sitting in review. Worth asking about; not automatically wrong.
- **not in `<CC>`** — absent from *that storefront*. An app in review, an app approved but
  not released, and an app limited to another region are indistinguishable from here. Say
  that rather than reporting the app as dead; offer `--country <CC>`.
- **PLAY is always `?`** — reading it needs the Play service account, which this tool
  deliberately does not touch. Don't present the gap as an error.

`--no-live` skips the network entirely when offline or when the user just wants the paths.
