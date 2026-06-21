---
name: releasing-with-eas
description: >-
  Use when building and submitting an Expo app to the App Store and Google Play with EAS — the end-to-end build → submit → review runbook. Trigger on "ship the app", "release with EAS", "eas build / eas submit", "submit to App Store / Play", "publish the app", "TestFlight", "staged rollout", "release runbook", "store submission". Keywords: eas build, eas submit, appVersionSource, autoIncrement, service account, demo credentials, App Privacy, Data safety, internal track.
---

# Releasing with EAS

Build and submit an Expo app to both stores. The publish is a **documented human runbook**, not CI — EAS does the build/submit; a person clicks "Submit for review." Capture + frame screenshots first (`capturing-store-screenshots-live` / `-web` → `framing-store-screenshots`) and write listing copy with `writing-store-listings`.

**Never run `eas build` / `eas submit` without explicit human confirmation** — they are billed and outward-facing.

For a guided, resumable run that tracks state across a multi-day release, use the **driving-a-release** skill — it generates a `RELEASE-CHECKLIST.md` and walks it. This skill is the reference for *what* each step does.

## Checklist

```
- [ ] 0. Pre-flight (gate on PREFLIGHT.md): version set, typecheck/lint/tests green,
        eas.json submit.production filled, EAS env secrets set, legal URLs live,
        demo/review creds VERIFIED working
- [ ] 1. Build:   eas build --platform all --profile production   → note the two build IDs
- [ ] 2. iOS:     eas submit --platform ios --id <ipa-build-id>   → ASC metadata
- [ ] 3. Android: eas submit --platform android --id <aab-build-id> → Play metadata
- [ ] 4. Post:    git tag v<version>; watch crashes; bump version
```

## Version / build number

`app.config.ts` (or `app.json`) `version` is the marketing version. **EAS owns the build number** when `eas.json` production has `appVersionSource: "remote"` + `autoIncrement: true` — never hand-edit `buildNumber` / `versionCode`. A rejected build re-submits with an auto-incremented number, no code change.

## 1. Build

```bash
eas whoami && eas project:info          # confirm account/project
eas build --platform all --profile production
```

Prints an `.ipa` and an `.aab` URL — **note both build IDs** (`eas build:list --limit 2` if you lose them). Submit by ID, not `--latest`: `--latest` is per-platform and grabs whatever finished last, which can be a *stale or failed* build if the run errored partway. If a build fails on a missing env var, set it with `eas env:create --environment production` and re-run.

## 2. App Store

```bash
eas submit --platform ios --id <ipa-build-id>     # verify build number/commit is the one you just made
```

Then in App Store Connect: paste listing copy, upload `iphone-6.9` (+ `ipad-13` if `supportsTablet`) screenshots, answer App Privacy, write **review notes** (Guideline 2.1) with **working demo creds** + how to exercise any gated flow, Submit for Review. First response 24–48h.

**TestFlight first (recommended):** the build appears in TestFlight after processing. Internal testers (your team) can install immediately; **external** TestFlight testing needs a (lighter) Beta App Review. Smoke-test on TestFlight before promoting to the App Store submission.

## 3. Google Play

```bash
eas submit --platform android --id <aab-build-id>
```

Uploads the `.aab` to the **Internal** track (prompts for a Google service-account JSON the first time). Paste listing, feature graphic (1024×500), complete the Data safety form, then promote Internal → Production, rolling out **20% → 100%** over 48h while watching the crash reporter.

> **First-ever release gate:** a brand-new app (especially on an individual/personal Play account) often **cannot promote straight to Production** — Google may require a **closed-testing track with ~12 testers for ~14 days** plus identity/account verification before Production unlocks. If "Production" is greyed out, that's why. Check your app's eligibility in Play Console before relying on the 20%→100% path; for a first release, plan the closed-testing window in.

## OTA vs. binary release (EAS Update)

Not every change needs a new build. **JS/asset-only** changes can ship over-the-air with `eas update --channel production` (the production profile's `channel` is what `eas update` targets). **You must rebuild + resubmit** for: native deps, app version bumps, config-plugin or `app.config` changes, or anything touching native code. OTA only reaches builds whose `runtimeVersion` matches the update — mismatch and the update is silently not delivered. Keep a `runtimeVersion` policy (e.g. `appVersion`) so a binary release and its OTA updates stay coupled.

## 4. Post

`git tag v<version> && git push origin v<version>`. Smoke-test the production build on a real device for both platforms. Watch crashes 24h. Bump `version` and create the next release folder.

## Gotchas (these bite every time)

- **Play "service account missing permissions"** on android submit → Play Console → Users & permissions → invite the `eas-*@*.iam.gserviceaccount.com` email → grant **Release** permission for the app.
- **App Store Connect version mismatch** (page says 1.0.1 but the build is 1.0.2) → edit the draft version number, or create a new version.
- **Placeholder `projectId`** → `eas init --force`. Pin `owner` in the config when the account has multiple orgs.
- **External IDs** (Apple ID, ASC app id, team id, Google reversed-iOS-client-id) → keep `REPLACE_WITH_*` markers; never fabricate — an invalid value fails the submit confusingly.
- **Build artifacts** (`.aab` ~74MB, `.ipa` ~18MB) must be **gitignored** (`build-*.aab`, `build-*.ipa`, `*.apk`), never committed.

## Starting points (bundled templates)

Copy into the project and fill in: `templates/eas.json`, `templates/PUBLISH.md`, `templates/PREFLIGHT.md`, `templates/app-store-listing.txt`, `templates/play-store-listing.txt`, `templates/gitignore-snippet.txt`. See `docs/release-tree.md` for where they live per version.
