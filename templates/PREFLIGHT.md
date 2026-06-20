# [APP NAME] v[VERSION] — Pre-flight Checklist

Gates [PUBLISH.md](PUBLISH.md). Every box must be checked before `eas build`.

## Code
- [ ] `version` set to `[VERSION]` in `app.config.ts` / `app.json`.
- [ ] `typecheck` passes.
- [ ] Lint + format pass.
- [ ] Tests pass.
- [ ] Building from the intended commit on the release branch (`git log --oneline -1`).

## Config
- [ ] `eas.json` `submit.production` filled for ios + android (no `REPLACE_WITH_*` left).
- [ ] `appVersionSource: "remote"` + `autoIncrement: true` on the production profile (EAS owns build numbers).
- [ ] EAS env secrets set for production (`eas env:create --environment production`): API URL, OAuth client IDs, any other runtime secrets.
- [ ] `extra.eas.projectId` is real (not a placeholder); `owner` pinned if the account has multiple orgs.

## Identity / Auth
- [ ] OAuth providers configured for production (redirect URIs, client IDs registered).
- [ ] If any third-party social login is offered, **Sign in with Apple is enabled** (Apple Guideline 4.8) — `ios.usesAppleSignIn: true` + `expo-apple-authentication`.
- [ ] Permission usage strings present and specific (camera, photos, etc.) — set in `app.config`, not hand-edited in Info.plist.
- [ ] Pre-permission buttons read "Continue"/"Next", never "Grant Access".

## Legal (live URLs — Apple + Google both require a working support URL)
- [ ] Privacy policy URL live and current.
- [ ] Terms URL live.
- [ ] Support URL live.

## Review access
- [ ] Demo / review account(s) provisioned in production.
- [ ] Creds **verified working** (signed in successfully just now) and pasted into the listing files.
- [ ] Review notes explain how to exercise any gated flow (PIN/code/role).

## Assets
- [ ] Screenshots present for every required device size: iPhone 6.9" (+ iPad 13" if `supportsTablet`), Android phone (+ tablet if shipped).
- [ ] Screenshots present for every shipped locale.
- [ ] Feature graphic (1024×500) ready for Play.
- [ ] Build artifacts gitignored (`build-*.aab`, `build-*.ipa`, `*.apk`).
