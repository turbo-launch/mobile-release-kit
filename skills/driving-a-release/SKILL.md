---
name: driving-a-release
description: >-
  Use when running an app store release as a guided, resumable, multi-step process — generating a release checklist and walking it interactively with the user, tracking progress across sessions, and stopping for confirmation before billed or irreversible steps. Trigger on "start a release", "walk me through shipping", "release checklist", "where are we in the release", "resume the release", "continue shipping", "track the release". Keywords: release checklist, RELEASE-CHECKLIST.md, todo, resume, staged release, gate, confirmation, multi-day release.
---

# Driving a release

Turn the EAS release into a guided, resumable flow with two synced layers:

1. **Persistent state** — a `RELEASE-CHECKLIST.md` in the release folder. Survives between sessions, the user can edit it, and it's the source of truth for "where are we."
2. **Live TODO** — load the checklist into the agent's task list each session so the interaction is driven step by step.

The release *content* (what each step means, exact commands, gotchas) lives in the **releasing-with-eas** skill — follow it for the how. This skill is about *driving* the process.

## Start (or resume)

1. **Find or create the checklist** at `docs/ops/mobile-releases/v<version>/RELEASE-CHECKLIST.md`.
   - Missing → copy `templates/RELEASE-CHECKLIST.md`, fill `[APP NAME]` / `[VERSION]` (read `version` from `app.config.ts` / `app.json`), set **Status: in progress**.
   - Exists → **read it first**. The checked boxes and the **Status** line tell you where to resume. Never restart from step 0 if the file shows progress.
2. **Load it into the live TODO** — one todo per unchecked item, in order, so the user sees the plan and you advance through it.
3. State the current step and the next action, then proceed.

## Walk the steps

For each step, in order:

- Do the work (or tell the user exactly what to do for console-only steps), following **releasing-with-eas**.
- **At a `[CONFIRM]` step** (anything billed / outward-facing / irreversible — `eas build`, `eas submit`, Submit for Review, Promote to Production): show the **exact command** and what it will do, then **stop and wait** for the user's explicit go. Never run it as part of "walking the checklist."
- When a step completes, **tick its box in `RELEASE-CHECKLIST.md`** (and update **Last updated** / the **Builds** line when you capture build IDs) AND mark the live TODO done. Keep the two in sync — the file is what survives.
- If something blocks (a rejection, a missing credential, a first-release Play gate), record it under **Notes / blockers** and stop there rather than skipping ahead.

## Rules

- The checklist file is the source of truth. If the user edited it between sessions, respect their edits.
- Don't tick a box you didn't verify — a green check means the step actually happened.
- Gate strictly on Pre-flight (§0): don't build until every §0 box is checked.
- One release folder per version; a new version starts a fresh checklist.

## Resuming later

Next session, the user says "continue the release" → re-read `RELEASE-CHECKLIST.md`, rebuild the live TODO from the unchecked items, and pick up at the first unchecked step. Confirm the resume point with the user before acting.
