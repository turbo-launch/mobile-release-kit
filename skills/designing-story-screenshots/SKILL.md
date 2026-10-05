---
name: designing-story-screenshots
description: >-
  Use when store screenshots should be creative rather than a config-driven gradient set: a storyboard across the frames, a headline with one accent word, a plain phone cropped by the bottom edge, enlarged "lifted" cards of the real UI, an optional brand character, one layout scaled to every device. Trigger on "creative screenshots", "make the screenshots better", "screenshots look generic / too simple", "storyboard the store screenshots", "wider Play banner", "6.5-inch screenshots", "re-render for every device". Keywords: story frames, design space, lifted card, step badge, accent word, hero banner, landscape screenshot, contact sheet, templates/story-frames.
---

# Designing story screenshots

The `framing-store-screenshots` renderer wraps a raw in a gradient and a chassis. This skill is the other approach: **author each frame as a small HTML layout**, so a frame can carry a story, lift the one piece of UI that sells it, and use a character or a connecting line. It ships as `templates/story-frames/` (`frames.html` + `render.mjs`, no dependencies beyond a local Chrome).

Use it when the set looks "just too simple", or the app is calm and utility-shaped (study, finance, tools) where a hot gradient feels wrong. For a quick set, use the JSON renderer.

## The style

- **Light grid ground, one accent.** Paper colour with a faint 22 px grid, ink text, the brand colour used for *one word per headline*, the step badges and the connecting line, and nothing else. One ground for the whole set.
- **Headline = the outcome, in the user's voice**, 2–4 words per line, 2–3 lines, the key word wrapped in `*asterisks*` for the accent. A one-line `sub` underneath only when the headline alone could mean two things.
- **Storyboard continuity.** Frames 2…n carry a numbered badge (`01`, `02`…) joined by a line that leaves the right edge of one frame and enters the left edge of the next, so swiping reads as one sequence. Frame 1 is the hero: brand, big left-aligned headline, a one-line factual badge, the app on a phone. The line is why this beats a row of unrelated posters.
- **A plain phone, cropped by the bottom edge.** No notch or island, so it reads as no brand; the bottom crop lets the phone be larger and shows more UI. Tilt only the hero phone (≈8°) and lifted cards (−2…−3°); every other phone stays straight, which keeps the "tilt reads dated" rule intact.
- **Lifted cards.** A crop of the real screen redrawn larger and offset past the phone's edge, with a green glow ring on the single element the frame is about. It is the thumbnail-size answer to "what does this screen do?". Crop from the raw, never fake the UI.
- **A character on two frames at most** (hero + one payoff). More turns the set into a children's book.

## Method

1. **Capture raws first** (`capturing-store-screenshots-web` or `-live`), same aspect for every raw, populated state asserted. The frames are only as good as the raws.
2. **Copy `templates/story-frames/` into the project** (e.g. `docs/design/store/`), set the `:root` tokens, `BRAND`, `RAWW` (pixel width of your raws) and rewrite `FRAMES`. Crops are in raw pixels.
3. **Author once, in the design space.** Phones are laid out in a 440-wide space, tablets in 1032. `render.mjs` scales that to each store size with the device scale factor, so Android 2:1 and the iPhone 6.5" slot are one table row each, not a second layout:

   | Device | Design space → pixels |
   |---|---|
   | `iphone-6.9` | 440×956 @3 → 1320×2868 |
   | `iphone-6.5` | 440×952 @(1284/440) → 1284×2778 |
   | `android-phone` | 440×880 @(1080/440) → 1080×2160 (Play rejects a long edge over 2× the short) |
   | `ipad-13` | 1032×1376 @2 → 2064×2752 |
   | `android-tablet` | 720×1280 @2 → 1440×2560 |

   Content below `top: 300` is compressed on shorter canvases (`squeeze`), the header never is. A tablet entry in `FRAMES` (`tablet: { items }`) replaces the phone items; header type is scaled up by `--t`.
4. **Render, then read the contact sheet back** (`node render.mjs`). Check every frame at thumbnail size, in every language, on every device you ship.
5. **Re-render and diff against what is already in the store** before uploading: byte-compare the PNGs of frames you did not mean to change (`cmp`). A layout tweak that silently shifts frame 7 is how a "small fix" reaches the store.

## Copy

- **Read every line as the person the store page is for**, not as the developer. A word with a second meaning in the audience's world loses (a student reads one common verb as the name of the exam, not "skipped"); a proverb sounds like a parent; "Your mistake will come back" sounds like a threat. Say what they get: "Repeat your mistakes".
- **Say the feature in the user's own verb** ("work a test", not "pass/complete a test", where the language splits those).
- **Register**: the audience's `you` form, consistently, across headlines, subs, listing and release notes.
- Casing: pass the locale to every `toUpperCase`/`toLowerCase` and set `<html lang>`; dotted/dotless i breaks silently otherwise (`i18n` skill).
- **No third-party logo.** A fact about the content ("built on real past papers") is fine; an agency or exam-board mark reads as endorsement and fails review (Apple 5.2.1).

## Store specifics that change the layout

- **Play: the first phone screenshot can be landscape (1920×1080).** The listing shows it wide, like a banner, and the rest as narrow portrait cards. Make a hero frame with the headline left and 3–4 phones fanned right (same engine: a second page, `#hero:en` at 960×540 @2). Play allows 8 phone screenshots, so the banner displaces the last portrait frame — pick which one on purpose. Apple takes portrait only.
- **Apple: provide the 6.9" set (required); the 6.5" slot is optional** and shows "Using 6.9" Display" until you fill it. Fill it only if you want it pixel-exact: 1284×2778, same layout via the table above.
- Anything uploaded **after submission** needs the version pulled from review first (`passing-app-review`).

## Common mistakes

- Authoring a separate layout per device instead of one design space.
- A different ground or accent per frame ("templated, untrustworthy").
- A lifted card cropped from a *stale* raw; re-capture and the crop lands on another card. Re-read after every re-capture.
- A headline that wraps onto the phone: the engine shrinks to fit one line and pushes content down, but a 4th line still collides. Cut the copy.
- Rendering before the large background has decoded (headless fires early); the template already `decode()`s every image first. Keep that if you change the engine.
- Uploading a re-render without diffing it against the live set.
