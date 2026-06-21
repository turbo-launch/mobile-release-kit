# Release checklist — [APP NAME] v[VERSION]

Living state for this release. The agent ticks boxes as steps complete and reads
this back each session to know where you are; you can edit it directly between
sessions. Lives at `docs/ops/mobile-releases/v[VERSION]/RELEASE-CHECKLIST.md`.

**Status:** not started
**Last updated:** [date]
**Builds:** iOS `—`  ·  Android `—`   (EAS build IDs, filled at step 2)

> ⛔ Steps marked **[CONFIRM]** are billed / outward-facing / irreversible. The
> agent stops and waits for your explicit go before running them.

## 0 · Pre-flight  (gate — all must pass before building)
- [ ] Version set to `[VERSION]` in `app.config.ts` / `app.json`
- [ ] `typecheck` / lint / tests green
- [ ] `eas.json` `submit.production` filled (no `REPLACE_WITH_*`); `appVersionSource: remote`
- [ ] EAS production env secrets set (`eas env:create --environment production`)
- [ ] Legal URLs live: privacy · terms · support
- [ ] Demo / review account(s) created in prod and **creds verified working**
- [ ] Screenshots captured + framed for every required size & locale, one appearance
- [ ] Feature graphic 1024×500 (no alpha); icons (Apple 1024 no-alpha, Play 512 alpha)
- [ ] Listing copy + release notes written per locale
- [ ] Build artifacts gitignored

## 1 · Build  **[CONFIRM]**
- [ ] `eas build --platform all --profile production`
- [ ] Record build IDs above (iOS .ipa, Android .aab)

## 2 · App Store
- [ ] **[CONFIRM]** `eas submit --platform ios --id <ipa-build-id>`
- [ ] ASC: paste listing copy + release notes (per locale)
- [ ] ASC: upload screenshots (iphone-6.9, + ipad-13 if supportsTablet)
- [ ] ASC: App Privacy answers
- [ ] ASC: review notes with working demo creds + how to reach gated flows
- [ ] TestFlight smoke-test (internal; external needs Beta App Review)
- [ ] **[CONFIRM]** Submit for Review

## 3 · Google Play
- [ ] **[CONFIRM]** `eas submit --platform android --id <aab-build-id>`  → Internal track
- [ ] Console: listing copy + release notes (per language) + feature graphic
- [ ] Console: Data safety form (mirror App Privacy)
- [ ] Check first-release eligibility (new apps may need closed testing ~14d before Production)
- [ ] **[CONFIRM]** Promote Internal → Production, roll out 20% → 100% over 48h

## 4 · Post
- [ ] `git tag v[VERSION] && git push origin v[VERSION]`
- [ ] Smoke-test the production build on a real device (both platforms)
- [ ] Watch crashes / analytics 24h
- [ ] Bump `version`, create the next release folder, add a CHANGELOG entry

## Notes / blockers
- [anything that came up — rejections, waiting-on, decisions]
