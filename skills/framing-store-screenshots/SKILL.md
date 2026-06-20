---
name: framing-store-screenshots
description: Use when raw app screenshots need to become App Store / Play Store marketing images — wrapping bare captures in a device frame with a headline, eyebrow, and branded background. Trigger on "frame the screenshots", "store marketing images", "make the captures look like a real listing", "add device frames", "framed deliverables", "screenshot gallery for the listing". Keywords: device frame, chassis, hero frame, eyebrow, headline, contact sheet, iPhone 6.9, Play Store screenshot size, ASO.
---

# Framing store screenshots

Turn raw `<screen>.png` captures into framed marketing images: branded background gradient + benefit headline + device chassis, rendered at exact store pixel sizes. Config-driven — no per-app code edits.

Capture the raws first with `capturing-store-screenshots-live` (real/hero screens) or `capturing-store-screenshots-web` (static batches).

## Render

The renderer ships in the plugin at `scripts/frame-screenshots.js`. It needs Playwright + a Chromium:

```bash
npm i -D playwright && npx playwright install chromium
# in a monorepo that already has Playwright, skip the install and reuse it:
#   NODE_PATH=<repo>/node_modules node scripts/frame-screenshots.js ...
```

```bash
node scripts/frame-screenshots.js <config.json> <rawDir> <outDir> <device>
```

Run it once per device size. Then tile the output to review the whole set:

```bash
node scripts/contact-sheet.js <outDir> contact-sheet.png 5
```

Read the contact sheet back and eyeball it before declaring done.

## Config

Copy `templates/frames.config.json` into the project, then edit `palette`, `tones`, `order`, and `screens`. Each key in `order` needs a raw `<key>.png` in `rawDir` and an entry in `screens`:

```json
"order": ["hero", "compete", "results", "feature-a"],
"screens": {
  "hero":    { "eyebrow": "LIVE", "head": "Your hero\nheadline", "tone": "hot",
               "pop": { "big": "15", "sub": "QUESTIONS" } },
  "compete": { "eyebrow": "LEADERBOARD", "head": "Play to\nwin", "tone": "forest",
               "pop": { "big": "#1", "sub": "YOUR RANK", "color": "#D8A24A" } }
}
```

- `eyebrow` — ALL-CAPS feature label.
- `head` — benefit headline, `\n` for line breaks.
- `tone` — background from `tones` (built-ins: `hot`, `forest`, `paper`).
- `pop` — optional energy chip (big number / rank / %) over the device corner.
- `fallback` — reuse another raw for this device (e.g. iPad reuses a host screen for a participant-only live frame).

## Device sizes (the `<device>` arg)

| Key | Pixels | Notes |
|-----|--------|-------|
| `iphone-6.9` | 1320×2868 | Apple's required size; covers all smaller iPhones |
| `ipad-13` | 2064×2752 | only if `supportsTablet: true` |
| `android-phone` | 1080×2400 | Play recommended (20:9) |
| `android-tablet` | 1600×2560 | Play 10-inch tablet |

## Design rules (encode these — they're what converts)

- **Lead with the peak moment.** Frame 1 = the live / most-exciting screen, never a calm dashboard, splash, or settings page. The first three frames carry most of the install decision.
- **Straight-on device.** Tilt reads dated; it's opt-in (`"tilt": true`).
- **One background system, hottest hero.** Keep a consistent palette across the set, but give the hero frame the most saturated `tone` (`hot`).
- **Benefit headlines, 2–4 words**, plus a `pop` chip on the competitive frames (leaderboard, score).
- Order the set so frames 1–3 are: peak/live moment → competitive payoff → instant feedback / "aha".

## Common mistakes

- Calm dashboard / login / settings as frame 1 (conversion killer).
- 3D-tilted phone (dated).
- Different background per frame (reads templated and untrustworthy).
- Headline longer than ~4 words or low contrast against the tone.
- Forgetting `ipad-13` / `android-tablet` when the app supports tablets.
