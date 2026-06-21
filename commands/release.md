---
description: Drive an interactive, resumable App Store / Play Store release with a tracked checklist.
argument-hint: "[ios|android|all]"
---

Drive a release for this Expo app, target platform **$0** (default `all`).

Use the **driving-a-release** skill:

1. Find or create `docs/ops/mobile-releases/v<version>/RELEASE-CHECKLIST.md` (copy `templates/RELEASE-CHECKLIST.md`; read the version from `app.config.ts` / `app.json`). If it already exists, **read it and resume** from the first unchecked step — don't restart.
2. Load the unchecked items into your live TODO list so we walk them in order, and tell me where we are.
3. Walk the steps, following **releasing-with-eas** for the how. Tick each box in the checklist file (and the TODO) as it completes — the file is the source of truth across sessions.

**STOP for my explicit confirmation before any `[CONFIRM]` step** (`eas build`, `eas submit`, Submit for Review, Promote to Production) — show the exact command and what it does, then wait. Never fabricate Apple/Google IDs (leave `REPLACE_WITH_*`). Record any blocker under Notes rather than skipping ahead.
