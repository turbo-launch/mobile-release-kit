---
name: framing-store-screenshots
description: >-
  Use when raw app screenshots need to become App Store / Play Store marketing images — wrapping bare captures in a device frame with a headline, eyebrow, and branded background. Trigger on "frame the screenshots", "store marketing images", "make the captures look like a real listing", "add device frames", "framed deliverables", "screenshot gallery for the listing". Keywords: device frame, chassis, hero frame, eyebrow, headline, contact sheet, iPhone 6.9, Play Store screenshot size, ASO.
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
- `headScale` — multiplier on headline size (e.g. `0.78`) when copy needs three lines and the default overflows. Cheaper than a bespoke device entry.
- `tone` — background from `tones` (built-ins: `hot`, `forest`, `paper`).
- `pop` — optional energy chip (big number / rank / %) over the device corner.
- `logo` — path (relative to the **config file**) to a PNG wordmark that replaces the text `eyebrow`. Mainly for the feature graphic.
- `fallback` — reuse another raw for this device (e.g. iPad reuses a host screen for a participant-only live frame).

### `popout` — the "card lifted off the screen" shot

Re-renders a region of the raw as an enlarged panel floating over the device edge. The single highest-impact upgrade to a frame-1 hero.

```json
"feed": { "eyebrow": "DEALS", "head": "Spot the deal\nat a glance", "tone": "hot",
          "popout": { "crop": [0.512, 0.480, 0.448, 0.287],
                      "width": 0.52, "left": 0.44, "top": 0.40, "rotate": -2 },
          "popout@android-phone": { "crop": [0.513, 0.462, 0.446, 0.300] } }
```

- `crop: [x, y, w, h]` — region of the **raw**. Values ≤ 1 are fractions of the raw's size, so they survive a different capture resolution; values > 1 are literal pixels. **Prefer fractions.**
- `width` / `left` / `top` — panel size and position as canvas fractions; negative bleeds off-canvas.
- `rotate`, `radius` — optional tilt (degrees) and corner radius (fraction of panel width).
- `popout@<device-key>` — shallow-merges over `popout`. **You will need this**: the same screen laid out on a 1320×2868 iPhone and a 1080×2400 Android puts the target card at different fractions, so one crop cannot serve both. Symptom of a missing override is a panel showing half a card or a slice of the neighbouring one.

Always read the rendered popout back. The crop is blind — nothing validates that it landed on the card you meant.

## Device sizes (the `<device>` arg)

| Key | Pixels | Notes |
|-----|--------|-------|
| `iphone-6.9` | 1320×2868 | Apple's required size; covers all smaller iPhones |
| `ipad-13` | 2064×2752 | only if `supportsTablet: true` |
| `android-phone` | 1080×**1920** | **not 2400** — see below |
| `android-tablet` | 1600×2560 | Play 10-inch tablet |
| `feature-graphic` | 1024×500 | Play banner; needs no raw png |

**Play's 2:1 aspect cap is the one that bites.** The long edge may not exceed 2× the short edge, so `1080×2400` (20:9, the natural Android emulator raw) is **rejected at upload**. Framed Android output is `1080×1920`; the 2400-tall raws are capture *inputs* only. The renderer letterboxes them and prints an aspect-mismatch warning per screen — on Android **that warning is expected**, not a defect. Don't "fix" it by re-capturing at 16:9; you'd crop real UI.

Anything you put in the config's `devices` block **overrides** the built-in, so a stale number there ships silently. Only list a device if you mean to change it.

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
- **Overriding `android-phone` to 1080×2400** in the project config — rejected at upload.
- **Framing a raw captured mid-scroll**, so the frame leads with a sliver of a cut-off card. Scroll the device so a *whole* section starts near the top, then re-capture. This is invisible in the raw and obvious in the frame — check the contact sheet.
- **A `popout` crop pointing at a stale raw.** Re-capture the raw and the crop fractions may now land on a different card. Re-read the frame after any re-capture.
- Text over the popout's drop shadow — it eats contrast; keep headlines in the top third.
