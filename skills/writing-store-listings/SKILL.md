---
name: writing-store-listings
description: Use when writing or refreshing App Store / Play Store listing metadata — app name, subtitle, promotional text, description, keywords, and the App Review notes. Trigger on "store listing", "app description", "App Store metadata", "Play Store description", "keywords", "promotional text", "review notes", "demo account for review". Keywords: subtitle, promo text, character limit, ASO keywords, Guideline 2.1, Data safety, localized listing.
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
- For any gated content (PIN to join, invite code, paid tier), give the reviewer exactly how to reach it — they won't create their own.
- A short note for non-obvious permissions ("Camera prompt appears only after tapping Scan QR, never at launch").

## Localized listings

Each locale (e.g. EN + a second market language) gets its own copy. Store one file per locale; in App Store Connect / Play Console add the localization and paste the matching file. Translate as a native speaker would, not word-for-word.

## Starting points

Fill in `templates/app-store-listing.txt` and `templates/play-store-listing.txt` (limits are inline; placeholders are `[ … ]` and `REPLACE_WITH_*`).
