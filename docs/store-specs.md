# Store specs reference

**The single source of truth** for screenshot sizes, asset specs, and listing limits used across this kit. **As of 2026 — verify against current Apple / Google docs before a submission; these change.**

## App Store screenshots

| Device slot | Pixels (portrait) | Required? |
|-------------|-------------------|-----------|
| iPhone 6.9" | 1320×2868 | **Yes** — and uploading it covers all smaller iPhone sizes |
| iPad 13" | 2064×2752 | Only if `supportsTablet: true` |

6.5" / 5.5" iPhone and 12.9" iPad are no longer required for new listings (don't bother — the renderer no longer offers them). 2–10 screenshots per localized set.

## Play Store screenshots & graphics

| Asset | Size | Notes |
|-------|------|-------|
| Phone screenshots | **1080×1920** (16:9) | 2–8 images. **Aspect must stay within 1:2–2:1.** |
| 7" tablet | 1200×1920 | |
| 10" tablet | 1600×2560 | |
| Feature graphic | 1024×500 | **Required.** JPEG or 24-bit PNG, **no alpha**. (`feature-graphic` device in the renderer.) |
| App icon | 512×512 | 32-bit PNG **with alpha** |

> **Play aspect-ratio cap (catches people out):** the long edge can't be more than **2× the short edge**. So **1080×2400 (20:9) is REJECTED at upload** (2400 > 2×1080). Use **1080×1920**. Min dimension 320px, max 3840px.

## App icon — the no-alpha trap (iOS)

The two stores disagree, and getting it wrong is a common first-submission rejection:

- **Apple**: 1024×1024, **no alpha / no transparency**, **square** (Apple applies the rounded corners — don't pre-round), no layers. An icon with an alpha channel is auto-rejected.
- **Google Play**: 512×512, 32-bit PNG **with alpha**.

Keep two icon exports, or generate the iOS one by flattening onto an opaque background.

## Appearance (light/dark)

Each store shows **one** screenshot set regardless of the viewer's system theme. Capture the whole set in a single appearance (usually the app's default) — never mix light and dark frames in one set.

## Listing character limits

| App Store | Limit |  | Google Play | Limit |
|-----------|-------|--|-------------|-------|
| Name | 30 |  | App name | 30 |
| Subtitle | 30 |  | Short description | 80 |
| Promotional text | 170 |  | Full description | 4000 |
| Keywords (total) | 100 |  | Release notes (per language) | 500 |
| Description | 4000 |  | | |

Apple keywords are comma-separated with **no spaces** after commas (spaces count toward the 100), and shouldn't repeat the app Name (already indexed). Play's "What's new" release notes are capped at **500 chars per language**.
