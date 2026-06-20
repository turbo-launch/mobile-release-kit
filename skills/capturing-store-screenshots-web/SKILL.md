---
name: capturing-store-screenshots-web
description: Use when capturing store screenshots from the Expo WEB bundle in headless Chromium instead of a simulator — fast batches of static screens, no simulator available, or CI. Trigger on "web bundle screenshots", "playwright screenshots", "capture without a simulator", "batch screenshot matrix", "screenshots in CI", "screenshots came out empty / broken / wrong". Keywords: playwright, headless chrome, deviceScaleFactor, seed, dev-login, sql.js, settle, verify, empty state, Hermes, RN-Web.
---

# Capturing store screenshots from the web bundle

Render the Expo **web** build in headless Chromium at exact store pixel sizes, seed demo data, visit each screen by route, screenshot. No simulator. Best for **static screens and fast full-matrix batches** (all devices × locales). For real-time / gameplay hero screens prefer `capturing-store-screenshots-live`. Frame the output with `framing-store-screenshots`.

## Exact pixel size

CSS viewport × `deviceScaleFactor` = output pixels. e.g. iPhone 6.9" = `440×956` css × `3` = **1320×2868** (Apple's required size). Android phone = `360×800` × `3` = `1080×2400`.

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

Success here means "a PNG was written," **not** "the PNG is good." A screen that failed to seed renders its empty state ("No matches yet") and ships looking broken. So **assert before you capture**:

```js
const BAD = /no matches|nothing here|nothing yet|couldn'?t load|something went wrong|\bundefined\b|\bNaN\b|error/i;
async function assertGood(page) {
  const text = await page.evaluate(() => document.body.innerText || '');
  if (BAD.test(text)) throw new Error(`bad-state: "${text.match(BAD)[0]}"`);
  // also assert the EXPECTED hero content is present, not just that no error shows.
}
```

- Add a `--verify` pass that re-opens each screen, runs `assertGood`, and prints a red/green table. Gate the release on it.
- For any `{id}` detail screen, pick the **richest entity** (most children), not `[0]` — query each candidate's children and take the max, or the detail ships empty.

## Known failure modes

- **Wrong-platform chrome.** RN-Web renders **one** platform's native `Switch`/`DateTimePicker`/action-sheet for **both** device folders — your iOS shots may show Material controls. The viewport flag doesn't change it. Fix with a custom platform-faithful component (best), or accept + document (Apple/Google tolerate minor control-style diffs).
- **Hermes i18n.** `Date.toLocaleDateString('az', …)` works on web (V8) but emits garbage on-device (Hermes ships no CLDR for non-en locales). Format dates from i18n name tables, not `Intl`. Invisible in the web shot — reason about Hermes, don't trust the PNG.
