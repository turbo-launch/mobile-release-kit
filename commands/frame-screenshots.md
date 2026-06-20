---
description: Frame raw app screenshots into App Store / Play Store marketing images.
argument-hint: [rawDir] [outDir] [device]
---

Frame the raw screenshots in `$0` into store marketing images in `$1` for device `$2` (default `iphone-6.9`).

Use the **framing-store-screenshots** skill. Steps:

1. If the project has no frames config, copy `templates/frames.config.json` into it and adapt the palette, `order`, and per-screen `eyebrow`/`head` copy to this app (frame 1 = the most exciting screen).
2. Run `scripts/frame-screenshots.js` with that config, `$0` as rawDir, `$1` as outDir, and `$2` (or `iphone-6.9`) as the device. Re-run for each device size the app targets.
3. Render a contact sheet with `scripts/contact-sheet.js` and read it back to confirm the set looks right.

If `$0` is empty, ask which directory holds the raw screenshots first.
