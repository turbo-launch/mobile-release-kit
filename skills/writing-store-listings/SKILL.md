---
name: writing-store-listings
description: >-
  Use when writing or refreshing App Store / Play Store listing metadata — app name, subtitle, promotional text, description, keywords, and the App Review notes. Trigger on "store listing", "app description", "App Store metadata", "Play Store description", "keywords", "promotional text", "review notes", "demo account for review". Keywords: subtitle, promo text, character limit, ASO keywords, Guideline 2.1, Data safety, localized listing.
---

# Writing store listings

Listing copy that fits the stores' limits and passes review. Pair with `releasing-with-eas`.

## App Store fields + limits

| Field | Limit | Notes |
|-------|-------|-------|
| Name | 30 chars | brand + 1–2 keywords |
| Subtitle | 30 chars | the benefit in a phrase |
| Promotional text | 170 chars | editable without a new build |
| Keywords | 100 chars total | comma-separated, **no spaces** after commas (they count); don't repeat the Name |
| Description | 4000 chars | benefit-led; lead with the strongest value |

## Play Store fields + limits

| Field | Limit |
|-------|-------|
| App name | 30 chars |
| Short description | 80 chars |
| Full description | 4000 chars |

## Copy principles

- **Benefit-led, not a feature list.** "Build a quiz your class plays in minutes" beats "Quiz builder, leaderboard, flashcards."
- First line earns the tap; the rest can elaborate.
- Keywords: distinct terms a user would search; singular/plural variety; don't waste them repeating the app name (Apple already indexes it).

## Review notes (Apple Guideline 2.1 — required)

App Review **will reject** if demo credentials don't work. Include:

- A demo / review account whose creds are **verified working in production** (phone+OTP, or email+password).
- For any gated content (PIN to join, invite code, paid tier), give the reviewer exactly how to reach it — they won't create their own. Spell out the tap path (`Settings → "Sign in with email" → …`), not just the credentials; a reviewer who can't find the login treats the feature as broken.
- A short note for non-obvious permissions ("Camera prompt appears only after tapping Scan QR, never at launch").
- Name the gated surfaces explicitly, and say that the free-tier fallback is **intended behavior** — otherwise a reviewer who sees "we can't price this car" reads it as an error and rejects.

### Anonymous-first ≠ no credentials needed

The trap: the app genuinely works without login, so the notes say *"No demo account required — everything works anonymously."* Meanwhile the **screenshots** show the paid features, because those are the ones worth marketing. The reviewer taps them, hits the free-tier wall, and rejects for "could not review the functionality shown in your screenshots."

Rule: **whatever the screenshots depict must be reachable with what the review notes provide.** Reconcile the notes against the final screenshot set at the end, after captures are locked — not while drafting. Phrase it as *"not required to browse, but here are credentials for the PRO surfaces"*, and list which screens those are.

On Play the same information belongs in **App content → App access**: answer "all functionality available without special access" = **No** and attach an instruction set with the credentials and steps. Leaving it at "Yes" while shipping gated screenshots is a policy rejection.

If the entitlement was granted server-side (as it must be when the binary carries no purchase surface), say so — "PRO granted server-side on this account; nothing is purchased in or out of the app" — so it doesn't read as an undeclared IAP.

## Release notes ("What's New")

Both stores show a per-update "What's New" string. Benefit-led, scannable, lead with what the user gains. **Play caps release notes at 500 chars per language.** First release: a short "Welcome to [App]" beats a changelog. Fill `templates/release-notes.txt` (one block per locale).

## Localized listings — workflow

Each locale gets its own copy. What's per-locale vs. global:

- **Per-locale** (translate each): Name/App name, Subtitle/Short description, Description/Full description, Keywords, Promotional text, **release notes**, and **screenshots** (both consoles store screenshots per localization — re-upload the set under each language, or they fall back to the default).
- **Global** (set once): category, URLs, age rating, App Privacy / Data safety, demo creds.
- Play requires a **default language**; other locales fall back to it for any field you leave empty.
- Store one file per locale (`shared/`, `ios/`, `android/` under `docs/ops/mobile-releases/v<version>/<lang>/`). Translate as a native speaker would, not word-for-word.

## Starting points

Fill in `templates/app-store-listing.txt`, `templates/play-store-listing.txt`, and `templates/release-notes.txt` (limits inline; placeholders are `[ … ]` and `REPLACE_WITH_*`).
