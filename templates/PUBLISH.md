# [APP NAME] v[VERSION] — Publish Runbook

Step-by-step to ship `[APP NAME]` ([BUNDLE_ID] / [PACKAGE]) v[VERSION] to the App Store and Google Play. Copy this per release. Gate it behind [PREFLIGHT.md](PREFLIGHT.md).

> **What ships in v[VERSION].** [One-paragraph summary of the work in this release. Note if anything changes data collection — if so, update App Privacy + Data safety.]

---

## 0. Pre-flight

Work through [PREFLIGHT.md](PREFLIGHT.md) in full — it gates this runbook. Highlights:

- `version: '[VERSION]'` set in `app.config.ts` / `app.json`. EAS owns the build number (`appVersionSource: "remote"`, `autoIncrement: true`) — no manual `buildNumber`/`versionCode`.
- `typecheck` / lint / tests green. Build from the intended commit (`git log --oneline -1`).
- Legal URLs live (privacy / terms / support). EAS env secrets set (`eas env:create --environment production`). Demo/review creds verified working and pasted into the listing files.
- Screenshots captured + framed for every required device size and locale.

---

## 1. Build with EAS

```bash
eas whoami && eas project:info
eas build --platform all --profile production
```

Prints an `.ipa` and an `.aab` URL — keep them for the submit steps. If it fails on a missing env var, set it with `eas env:create` and re-run.

---

## 2. App Store

```bash
eas submit --platform ios --profile production --latest
```

In App Store Connect → [APP NAME] → v[VERSION]:
- Paste metadata from `ios/app-store-listing.txt` (name, subtitle, promo, keywords, description, URLs, category).
- Upload screenshots from `ios/screenshots/iphone-6.9/<lang>/` (+ `ipad-13/<lang>/` if `supportsTablet`).
- Confirm **App Privacy** answers (update if data collection changed this release).
- **Review notes** (Guideline 2.1): paste from the listing file — demo creds that MUST work + how to exercise gated flows. Add a second account if a different role is needed.
- Add for Review → Submit. First response 24-48h.

---

## 3. Google Play

```bash
eas submit --platform android --profile production --latest
```

Uploads the `.aab` to the **Internal** track (prompts for the Google service-account JSON the first time — Play Console → Setup → API access).

In Play Console → [APP NAME] → release:
- Paste metadata from `android/play-store-listing.txt`.
- Main store listing: app icon (512×512), feature graphic (1024×500), phone screenshots from `android/screenshots/phone/<lang>/`.
- Complete the **Data safety** form (mirror App Privacy).
- Promote Internal → Production at **20%**, increase to **100%** over 48h if the crash reporter is clean.

> Gotcha: "service account missing permissions" → Play Console → Users & permissions → invite the `eas-*@*.iam.gserviceaccount.com` email → grant Release permission for the app.

---

## 4. Post-publish

```bash
git tag v[VERSION] && git push origin v[VERSION]
```

- Smoke-test the production build end-to-end on a real device (both platforms).
- Watch crashes/analytics for 24h.
- Bump `version` in `app.config.ts` and create the next release folder; add a CHANGELOG entry.
- Confirm build artifacts (`build-*.aab`, `build-*.ipa`, `*.apk`) are gitignored, not committed.
