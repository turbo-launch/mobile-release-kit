---
description: List every registered mobile app with its local version and what is live in the App Store
---

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/mobile-projects.mjs $ARGUMENTS
```

**Print the script's output verbatim.** It is already a formatted table — redrawing it as
markdown costs tokens and adds nothing. No preamble, no summary of what you are about to do.

Add at most one line afterwards, and only if something in the output actually warrants it:

- a row where **LOCAL ≠ APP STORE** — usually a version bumped and committed but never
  submitted, or a build still in review. Worth asking about.
- **`not in <CC>`** — absent from *that storefront only*. An app in review, one approved but
  unreleased, and one limited to another region are indistinguishable from here. Suggest
  `--country <CC>` once; do not repeat it every run. To make a storefront stick, the project
  can be re-registered with `register --country <CC>`.
- **PLAY is always `?`** by design — reading it needs the Play service account, which this
  tool deliberately never touches. Never present that as an error or a missing feature.

If nothing stands out, say nothing.

If the registry is empty, register the current project (`register`) or ask which paths to
add — do not scan the filesystem looking for apps.
