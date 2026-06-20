---
description: Start an EAS release for an Expo app — walk the build/submit runbook with stops before any billed action.
argument-hint: "[ios|android|all]"
---

Start an EAS release for this Expo app.

Target platform: **$0** (if `$0` is empty, default to `all`).

Invoke the **releasing-with-eas** skill and walk its runbook for the target platform, in order:

1. Begin with the **pre-flight checklist** (the skill's pre-flight step / `templates/PREFLIGHT.md`). Work through every item — version + build-number bump, clean git tree, correct channel/profile, store credentials present, listing + review notes ready, screenshots framed. Report the results back as a checklist.
2. Resolve the version and build number per the skill's version/build-number rule before anything is built.
3. Only once pre-flight passes, proceed toward the build and submit steps for the requested platform(s).

**STOP for explicit human confirmation before running any `eas build` or `eas submit` command.** These are billed, outward-facing, irreversible actions. Show the exact command(s) you intend to run, summarize what they will do (profile, platform, channel, what gets submitted where), and wait for the human to say go. Never run them automatically as part of walking the runbook.

Do not fabricate Apple or Google identifiers — leave any `REPLACE_WITH_*` markers intact and ask the human to fill them in. After a build or submit, follow the skill's post-release step (tag, monitor, gitignore artifacts).
