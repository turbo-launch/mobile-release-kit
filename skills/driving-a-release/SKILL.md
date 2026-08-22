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
- **Reconcile the review notes against the final screenshots**, as a step in its own right, after captures are locked. Listing copy is drafted early and screenshots land late; the draft's claims about login/access go stale. See `writing-store-listings` → "Anonymous-first ≠ no credentials needed".
- **Log app defects found during capture under Notes / blockers** instead of fixing them inline. Driving screens for screenshots surfaces real bugs (a blank status bar, platform-inconsistent formatting). They're findings for the user to triage, not release work — and a speculative fix mid-capture invalidates raws you already took. If you do try one and it doesn't work, revert it rather than leaving a no-op change in the diff.

## Screenshots are the long pole — scope them first

Capture is routinely the largest, least predictable chunk of a release, and the estimate swings by an order of magnitude on facts you can check in two minutes. Before quoting any timeline:

- Is there a web bundle? No `react-native-web` ⇒ every screen is a live-simulator capture. (`capturing-store-screenshots-live`)
- Are the marketed screens gated? ⇒ an entitled account, plus seeded state per account, per platform.
- How much state does each screen need? A saved-search list or a valuation result must be *built through the UI* every time.
- Both platforms? Roughly double, and Android reload cycles are slow.

Say which of these apply up front. Discovering them one at a time mid-run reads as thrashing.

## Resuming later

Next session, the user says "continue the release" → re-read `RELEASE-CHECKLIST.md`, rebuild the live TODO from the unchecked items, and pick up at the first unchecked step. Confirm the resume point with the user before acting.

## Closing the release

Once the build is submitted, the release is not finished until what it taught you is written
down. This is the only moment it is cheap — a week later the detail is gone and only the
vague sense that "something about push was fiddly" survives.

Run **capturing-what-you-learned** (or `/mobile-release-kit:learn`) as the last checklist
item. It applies one test — *would this be true in a different app?* — and routes each
lesson to the plugin or to this project accordingly. Prompt for it explicitly rather than
waiting to be asked; nobody ever asks.
