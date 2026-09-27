---
name: capturing-store-screenshots-web
description: >-
  Use when capturing store screenshots from the Expo WEB bundle in headless Chromium instead of a simulator — fast batches of static screens, no simulator available, or CI. Trigger on "web bundle screenshots", "playwright screenshots", "pointclick screenshots", "capture without a simulator", "batch screenshot matrix", "screenshots in CI", "screenshots came out empty / broken / wrong". Keywords: playwright, pointclick, browser MCP, headless chrome, deviceScaleFactor, seed, dev-login, sql.js, settle, verify, empty state, Hermes, RN-Web.
---

# Capturing store screenshots from the web bundle

Render the Expo **web** build in headless Chromium at exact store pixel sizes, seed demo data, visit each screen by route, screenshot. No simulator. Best for **static screens and fast full-matrix batches** (all devices × locales). For real-time / gameplay hero screens prefer `capturing-store-screenshots-live`. Frame the output with `framing-store-screenshots`.

## Pick the driver

| | Playwright script (below) | pointclick MCP ([recipe](#pointclick-recipe)) |
|---|---|---|
| Use for | the full device × locale matrix, CI, re-runs | a few screens, fixing one that came out wrong, a first trial |
| You maintain | a script | nothing; the agent drives |
| Seed strategy B (local-first) | yes | awkward; every step is a separate call |

Both use the same device table, seed strategy and verify checks. Trial one device and
locale with pointclick, then run the script for the whole matrix.

## Device table

CSS viewport × `deviceScaleFactor` = output pixels. **Size the viewport to the frame, not
the device.** The framer rescales, so only the raw's aspect has to match the store slot,
and a narrower viewport makes the UI text bigger.

| Store slot | css | scale | raw | framed |
|---|---|---|---|---|
| iPhone 6.9" | `440×956` | 3 | 1320×2868 | 1320×2868 |
| iPad 13" | `834×1112` | 2 | 1668×2224 | 2064×2752 |
| Play phone | `360×640` | 3 | 1080×1920 | 1080×1920 |
| Play 10" tablet | `768×1229` | 1600/768 | 1600×2560 | 1600×2560 |

- **Android phone is 9:16, not 20:9.** Play rejects over 2:1, so the frame is `1080×1920`. A `360×800` capture doesn't fit it, and the framer refuses it.
- **Tablets: the narrowest width that still gets the tablet layout**, not the device's full width. Find the app's breakpoint (where the tab bar turns into a rail, say) and capture at or just above it. Full-width `1024` css iPad captures come out unreadable once framed.

## Seed strategy — the key decision

The script must show **populated** screens. How depends on where data lives:

- **(A) Server-backed app.** Call a dev-login endpoint, inject the returned tokens into `sessionStorage`, fetch seed IDs over the API, visit routes by URL. **Reloads are fine** (data is on the server). Capture the login/guest screen **first**, before injecting tokens, if the app redirects authed users away.
- **(B) Local-first app** (on-device SQLite → `sql.js` in-memory on web, wiped on reload). You **cannot** seed-then-reload. Expose a `window.__seed` hook gated to `__DEV__ && Platform.OS === 'web'`, and navigate **client-side** (`router.replace`) so the in-memory rows survive — never `goto`/reload after seeding.

## Script skeleton

```js
import { chromium } from 'playwright';
const WEB = 'http://localhost:8081';
const DEVICES = { 'iphone-6.9': { css:{width:440,height:956}, dsf:3 } };
const SCREENS = [{ name:'today', path:'/' } /* … {id} templated from seed result */];

const ctx = await browser.newContext({ viewport: D.css, deviceScaleFactor: D.dsf, isMobile:true, hasTouch:true });
const page = await ctx.newPage();
await page.addInitScript(() => { console.warn = console.error = () => {}; localStorage.setItem('onboarded','1'); });
await page.goto(WEB);
await page.waitForFunction(() => !!window.__seed);     // strategy B; or inject tokens for A
await page.evaluate(() => window.__seed.seed());
for (const s of SCREENS) {
  await page.evaluate(p => window.__seed.go(p), s.path);   // client-side nav (B); page.goto for (A)
  await settle(page);
  await assertGood(page, s);                                // see Verify — DON'T screenshot a bad state
  await page.screenshot({ path: `raw/${s.name}.png`, fullPage:false });
}
```

`settle(page)`: `waitForLoadState('networkidle')` + a fixed delay + a `page.evaluate` that hides LogBox toasts, RN-Web warning overlays (walk up to the nearest `fixed`/`absolute` ancestor), and any `__DEV__`-only cards.

## Cache gotcha

Always start Metro with `--clear` after editing app code:

```bash
bun start --web --clear     # plain `start` serves a CACHED bundle — you'll chase a ghost
```

## Verify — the #1 weakness

Success here means "a PNG was written," **not** "the PNG is good." A screen that failed to seed renders its empty state ("No matches yet") and ships looking broken.

**Why the deepest screen is the one that breaks:** a detail screen usually reads a *different* query than the feed you seeded, so a seeder that fills the list leaves the detail's child rows empty — and the detail screen is the one you most want to market. A real v1.0.0 shipped "No matches yet" on its hero screenshot that way. Seed the **children**, assert count > 0, and pick the richest entity. So **assert before you capture** — and make the **positive** check (expected content present) the primary gate, with a *narrow* blocklist secondary:

```js
// Primary gate: the screen's own hero/content must be present. Per-screen.
async function assertHero(page, expectText) {
  await page.locator(`text=${expectText}`).first().waitFor({ timeout: 3000 }); // throws if missing
}

// Secondary, NARROW blocklist — only UI-failure phrasing. Do NOT match a bare
// "error" (matches "trial and error", "Error reporting" rows, brand words).
const BAD = /failed to load|something went wrong|please try again|\bundefined\b|\bNaN\b|\$NaN/i;
async function assertNoError(page) {
  const text = await page.evaluate(() => document.body.innerText || '');
  if (BAD.test(text)) throw new Error(`bad-state: "${text.match(BAD)[0]}"`);
}
```

- Per screen in your config, give an `expect` string (a word only the populated screen shows) and call `assertHero` first, then `assertNoError`.
- Add a `--verify` pass that re-opens each screen, runs both, and prints a red/green table. Gate the release on it.
- For any `{id}` detail screen, pick the **richest entity** (most children), not `[0]` — query each candidate's children and take the max, or the detail ships empty.

## pointclick recipe

[pointclick](https://pypi.org/project/pointclick/) is a small browser MCP on Playwright. It
is not bundled with this kit; add it once per machine:

```bash
claude mcp add pointclick -- uvx pointclick
# or from a local clone: claude mcp add pointclick -- uvx --from <path-to-clone> pointclick
```

Needs a build where `navigate` takes `device` and `screenshot` takes `path` (newer than
0.1.0). **If `navigate` takes only a url, the server running is older**: update it and
restart the MCP server.

Per device, then per screen:

```
navigate("http://localhost:8081/", device="440x956@3 mobile")    # "WxH@scale", from the table
evaluate("async () => { /* dev-login fetch, then */ sessionStorage.setItem('<key>', tok) }")   # strategy A
navigate("http://localhost:8081/<route>")                         # same device: context kept
evaluate(CHECK)                                                   # must return "ok"
screenshot(path="/abs/raw/iphone-6.9/en/<screen>.png")            # → "<path> 1320x2868 png"
```

```js
// CHECK: settle, then the positive gate and the narrow blocklist from Verify above.
async () => {
  await new Promise(r => setTimeout(r, 800));
  const t = document.body.innerText || '';
  if (!t.includes('<expect>')) return 'missing: <expect>';
  const m = t.match(/failed to load|something went wrong|please try again|\bundefined\b|\bNaN\b/i);
  return m ? 'bad-state: ' + m[0] : 'ok';
}
```

Then frame the raws as usual.

- **A device change drops sessionStorage.** Scale is fixed per browser context, so a new `device` opens a new context. Cookies, localStorage and IndexedDB carry over; sessionStorage and open tabs don't. Seed tokens *after* switching. Repeating the same device string keeps the context.
- **Read the size in the screenshot reply** against the table before the next screen.
- **`mobile` doesn't change the user agent.** It sets touch and honours `<meta viewport>`. That's enough for RN-Web and Expo web, which lay out by width. A site that picks its mobile layout from the user agent still renders desktop; use the script with a device UA.
- Use absolute `path`s. A relative one resolves against the MCP server's working directory, which need not be the project.

## Appearance (light/dark)

Capture in the app's most flattering appearance and keep the **whole set consistent** — both stores show one screenshot set regardless of the viewer's system theme, so don't mix light and dark frames. If the app defaults to light, drive light (set the `prefers-color-scheme` / the app's theme toggle before capture). See `docs/store-specs.md`.

## Known failure modes

- **Wrong-platform chrome.** RN-Web renders **one** platform's native `Switch`/`DateTimePicker`/action-sheet for **both** device folders — your iOS shots may show Material controls. The viewport flag doesn't change it. Fix with a custom platform-faithful component (best), or accept + document (Apple/Google tolerate minor control-style diffs).
- **Hermes i18n.** `Date.toLocaleDateString('az', …)` works on web (V8) but emits garbage on-device ("M06 9, Tue") — Hermes ships no CLDR for non-en locales. Format dates from i18n name tables in the bundle (weekday/month arrays + a per-locale template, since some locales flip to day-month order), not `Intl`. Pull tab-bar labels and any hardcoded UI strings from i18n too — a custom tab bar is the usual offender. **Invisible in the web shot** (V8 renders it fine), so reason about Hermes rather than trusting the PNG.
