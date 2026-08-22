---
name: releasing-with-eas
description: >-
  Use when building and submitting an Expo app to the App Store and Google Play with EAS — the end-to-end build → submit → review runbook. Trigger on "ship the app", "release with EAS", "eas build / eas submit", "submit to App Store / Play", "publish the app", "TestFlight", "staged rollout", "release runbook", "store submission". Keywords: eas build, eas submit, appVersionSource, autoIncrement, service account, demo credentials, App Privacy, Data safety, internal track.
---

# Releasing with EAS

Build and submit an Expo app to both stores. The publish is a **documented human runbook**, not CI — EAS does the build/submit; a person clicks "Submit for review." Capture + frame screenshots first (`capturing-store-screenshots-live` / `-web` → `framing-store-screenshots`) and write listing copy with `writing-store-listings`.

**Never run `eas build` / `eas submit` without explicit human confirmation** — they are billed and outward-facing. **And never choose the build route on your own**: ask cloud or local every time (§1), because it changes where the build's configuration comes from and how the binary is uploaded.

**A binary that reads a new server field must ship AFTER that field deploys.** Build first and the app compiles, installs, runs — and the feature is silently gone, because the field comes back `undefined` and a `?? null` fallback reads as "nothing to show". The build is green and nobody notices until the numbers are wrong. Deploy the backend, verify against production, *then* build — as a command in the runbook, not a sentence:

```bash
curl -s "https://<api>/<endpoint>" | grep -q '<new_field>' && echo OK
```

Record the prereq in `CHANGELOG.md` next to the build number, and mark any binary built before that deploy as **superseded — do not submit**. Build artifacts outlive memory, and the bad one looks exactly like the good one.

For a guided, resumable run that tracks state across a multi-day release, use the **driving-a-release** skill — it generates a `RELEASE-CHECKLIST.md` and walks it. This skill is the reference for *what* each step does.

## Checklist

```
- [ ] 0. Pre-flight (gate on PREFLIGHT.md): version set, typecheck/lint/tests green,
        eas.json submit.production filled, EAS env secrets set, legal URLs live,
        demo/review creds VERIFIED working
- [ ] 1. ASK: cloud or local build? (changes config source, artifact and upload)
- [ ] 2. Build the chosen way → note the build IDs / artifact paths
- [ ] 3. Gate every artifact before it is uploaded — no exceptions
- [ ] 4. iOS:     eas submit --id <build-id>   OR   xcrun altool --upload-app
- [ ] 5. Android: eas submit --id <build-id>   OR   upload the .aab in Play Console
- [ ] 6. Post:    git tag v<version>; watch crashes; bump version
```

## Version / build number

`app.config.ts` (or `app.json`) `version` is the marketing version. **EAS owns the build number** when `eas.json` production has `appVersionSource: "remote"` + `autoIncrement: true` — never hand-edit `buildNumber` / `versionCode`. A rejected build re-submits with an auto-incremented number, no code change.

## 1. Choose the build route — ask, every time

**Never pick this silently.** The two routes differ in what they cost, where their
configuration comes from, and how the binary gets uploaded — so the answer changes what you
do for the rest of the release. Ask which one, every build:

| | EAS cloud (`eas build`) | Local (`eas build --local`) |
|---|---|---|
| Cost | **billed** | free (your machine, ~15–40 min) |
| Config source | the profile's `environment` on EAS | **the working directory's dotenv files** |
| `.env.local` | never reaches it (git archive) | **read, and outranks `.env`** |
| Credentials | EAS | EAS (same) — first run per platform is interactive |
| Build number | EAS, with `appVersionSource: remote` | EAS (same) |
| Artifact | downloaded from a URL, kept by EAS | a local path you choose — **overwritable** |
| Upload | `eas submit` | `eas submit --path` (Android) · `xcrun altool` (iOS) |
| Needs macOS for iOS | no | **yes** |

If the project has a recorded default (its `ops/mobile-releases/README.md`, or a `just`
recipe that already passes `--local`), say which it looks like and confirm — do not just
apply it. A release is exactly the moment an unstated assumption gets expensive.

Both routes then share the same **artifact gate** below, and neither may skip it.

## 2a. Build on EAS (cloud)

```bash
eas whoami && eas project:info          # confirm account/project
eas build --platform all --profile production
```

Prints an `.ipa` and an `.aab` URL — **note both build IDs** (`eas build:list --limit 2` if you lose them). Submit by ID, not `--latest`: `--latest` is per-platform and grabs whatever finished last, which can be a *stale or failed* build if the run errored partway. If a build fails on a missing env var, set it with `eas env:set --environment production --name N --value V --visibility plaintext --type string --non-interactive` and re-run (`env:create` is deprecated; there is no `--force` — `env:set` upserts).

## 2b. Build locally

Nothing is billed; EAS is still used for signing credentials and, with
`appVersionSource: remote`, for the build number. Run each platform **interactively the
first time** — EAS has to create the iOS distribution certificate and the Android upload
keystore, and it prompts. **iOS requires macOS.**

```bash
bunx eas-cli build --platform ios --profile production --local --output build.ipa
```

> **A fixed `--output` path silently destroys the previous artifact.** No prompt, and with
> `autoIncrement` the replaced build number is already spent — so the overwritten binary is
> unrecoverable, and if it was uploaded, a stale build sits in TestFlight looking identical
> to the good one. Before building, check whether the file exists and who made it.

> The **Android upload keystore is unrecoverable** once the app is live on Play. Lose it and
> you can never update that listing. Back it up outside the repo before the first upload:
> `eas credentials` → Android → production → Keystore → Download.

**Store the app-specific password in the keychain once**, then never pass it inline again:

```bash
xcrun altool --store-password-in-keychain-item ALTOOL_APP \
    -u you@example.com -p <APP_SPECIFIC_PASSWORD>

xcrun altool --upload-app -f build.ipa -t ios \
    -u you@example.com -p @keychain:ALTOOL_APP
```

The password comes from appleid.apple.com → Sign-In and Security → App-Specific Passwords;
a normal Apple password will not work. `-p @keychain:<item>` keeps the credential out of
shell history, out of scrollback, and out of any transcript — the one-time `--store-password`
command is the only place it is ever typed, so run that one yourself.

**Uploading is not submitting.** The binary lands in ASC processing (~10–30 min) and appears
in TestFlight; review submission is a separate, deliberate act.

`altool` cannot query build status — that needs an ASC API key — but it can confirm the app
record resolves:

```bash
xcrun altool --list-apps -u you@example.com -p @keychain:ALTOOL_APP
```

### Android: `eas submit` takes a local artifact

Building locally does not mean uploading by hand. **`eas submit` is a different service
from `eas build`** — you can skip the cloud build entirely and still submit through it:

```bash
eas submit -p android --profile production --path build-<version>.aab
```

It handles the Play edit → upload → assign-to-track → commit sequence that the raw
`androidpublisher` API makes you write yourself. Configure it once:

```json
"submit": { "production": { "android": {
  "serviceAccountKeyPath": "/absolute/path/to/play-service-account.json",
  "track": "internal"
} } }
```

**Use an absolute path.** A relative one is resolved from the `eas.json` directory, so it
differs with repo depth and silently breaks when the command runs from elsewhere — a
"missing service account" that is really a `../` miscount.

> The **Play Developer API** service account is *not* the **FCM** service account. Same
> Google project, different grant, and swapping them fails with a permissions error that
> reads like a Play Console problem. The publishing one needs to be invited under Play
> Console → Users and permissions with **Release** permission for the app.

`--path` works for iOS too, but `altool` above is fewer moving parts when the binary is
already on your disk.

The listing copy and screenshots travel separately from the binary; see
`publishing-listings-with-fastlane`.

## 3. Gate the artifact — a signed build can be completely inert

**Do this before every upload.** A store build that installs, launches, and reaches
nothing is indistinguishable from a healthy one until a user opens it.

`babel-preset-expo` inlines `EXPO_PUBLIC_*` by **static substitution** of literal
`process.env.EXPO_PUBLIC_FOO` member expressions. Anything computed is invisible to it:

```ts
const get = (k: string) => process.env[k] ?? '';    // ← inlines NOTHING
const { EXPO_PUBLIC_API_BASE_URL } = process.env;    // ← also nothing
baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? ''  // ← the only correct shape
```

The reason it reaches production: **Metro populates `process.env` at runtime**, so a
dynamic read works in dev, on a dev client, and in Expo Go, and fails only in a release
bundle where `process.env` is empty — the one build nobody runs before submitting. A real
release shipped this way; the app had no backend URL at all.

Use the bundled script rather than ad-hoc greps — it checks every var in the env file,
searches both places a value can land (JS bundle *and* the Expo `app.config` asset, since
`extra`-delivered values never appear in the bundle), and separates "could not inspect"
from "pass":

```bash
./scripts/verify-release-artifact.sh <artifact>   # .ipa | .aab | .apk, auto-detected
#   --env-file .env   --prefix EXPO_PUBLIC_   --var NAME   --optional NAME
```

Exit `0` all-pass · `1` a value missing — **do not upload** · `2` could not inspect,
deliberately not a pass. `--optional` downgrades a var that lives in the env file but is
legitimately unused by the native app (a web-only OAuth redirect, say) — explicit, so
every exemption is visible in the command.

Read the pair; the second line is the diagnosis:

| value | var name | verdict |
|---|---|---|
| present | absent | inlined — ship it |
| absent | **present** | computed access — nothing inlined, binary has no backend |
| absent | absent | env absent at build time — check the profile's `environment` + `eas env:list` |

**EAS env vars only reach a build whose profile declares an environment.** A profile with
no `"environment"` key gets none of them, silently:

```json
"production": { "autoIncrement": true, "channel": "production", "environment": "production" }
```

Assert arbitrary strings too — the env check knows nothing about localized copy, and nothing about a LAN address left over from device testing:

```bash
./scripts/verify-release-artifact.sh build.ipa \
    --string 'Sərfəli' --absent '192.168' --absent 'localhost'
```

> **`grep -a` is necessary but not sufficient.** Bare `grep -c` short-circuits on binary input and returns 0 whether the string is there or not — a check that cannot fail, recorded as a pass. And `-a` still misses non-ASCII: **Hermes stores such strings as UTF-16**, so a UTF-8 grep reports absent on a bundle that contains them. Four localized strings once came back "missing" from a perfectly good build that was nearly rebuilt over it. The script searches the UTF-16LE encoding as a fallback; by hand it is:
>
> ```bash
> u16=$(printf '%s' 'Sərfəli' | iconv -f UTF-8 -t UTF-16LE | xxd -p | tr -d '\n')
> xxd -p "$BUNDLE" | tr -d '\n' | grep -c "$u16"     # expect >= 1
> ```

Seconds-long loop instead of a native rebuild, same transform:

```bash
set -a; . ./.env; set +a
bunx expo export --platform ios --output-dir /tmp/envcheck --no-minify
grep -ac '<api host>' /tmp/envcheck/_expo/static/js/ios/*.hbc
```

And assert the plist — a duplicate build number is rejected at upload, and a missing
encryption key means export-compliance paperwork on every single submission:

```bash
unzip -p build-*.ipa 'Payload/*.app/Info.plist' | plutil -p - \
  | grep -E 'CFBundleIdentifier|CFBundleShortVersionString|CFBundleVersion|NonExempt'
```

## 4. App Store

```bash
eas submit --platform ios --id <ipa-build-id>     # verify build number/commit is the one you just made
```

Then in App Store Connect: paste listing copy, upload `iphone-6.9` (+ `ipad-13` if `supportsTablet`) screenshots, answer App Privacy, write **review notes** (Guideline 2.1) with **working demo creds** + how to exercise any gated flow, Submit for Review. First response 24–48h.

**TestFlight first (recommended):** the build appears in TestFlight after processing. Internal testers (your team) can install immediately; **external** TestFlight testing needs a (lighter) Beta App Review. Smoke-test on TestFlight before promoting to the App Store submission.

## 5. Google Play

```bash
eas submit --platform android --id <aab-build-id>
```

Uploads the `.aab` to the **Internal** track (prompts for a Google service-account JSON the first time). Paste listing, feature graphic (1024×500), complete the Data safety form, then promote Internal → Production, rolling out **20% → 100%** over 48h while watching the crash reporter.

> **First-ever release gate:** a brand-new app (especially on an individual/personal Play account) often **cannot promote straight to Production** — Google may require a **closed-testing track with ~12 testers for ~14 days** plus identity/account verification before Production unlocks. If "Production" is greyed out, that's why. Check your app's eligibility in Play Console before relying on the 20%→100% path; for a first release, plan the closed-testing window in.

## OTA vs. binary release (EAS Update)

Not every change needs a new build. **JS/asset-only** changes can ship over-the-air with `eas update --channel production` (the production profile's `channel` is what `eas update` targets). **You must rebuild + resubmit** for: native deps, app version bumps, config-plugin or `app.config` changes, or anything touching native code. OTA only reaches builds whose `runtimeVersion` matches the update — mismatch and the update is silently not delivered. Keep a `runtimeVersion` policy (e.g. `appVersion`) so a binary release and its OTA updates stay coupled.

## 6. Post

`git tag v<version> && git push origin v<version>`. Smoke-test the production build on a real device for both platforms. Watch crashes 24h. Bump `version` and create the next release folder.

## Gotchas (these bite every time)

- **Play "service account missing permissions"** on android submit → Play Console → Users & permissions → invite the `eas-*@*.iam.gserviceaccount.com` email → grant **Release** permission for the app.
- **App Store Connect version mismatch** (page says 1.0.1 but the build is 1.0.2) → edit the draft version number, or create a new version.
- **Placeholder `projectId`** → `eas init --force`. Pin `owner` in the config when the account has multiple orgs.
- **External IDs** (Apple ID, ASC app id, team id, Google reversed-iOS-client-id) → keep `REPLACE_WITH_*` markers; never fabricate — an invalid value fails the submit confusingly.
- **Build artifacts** (`.aab` ~74MB, `.ipa` ~18MB) must be **gitignored** (`build-*.aab`, `build-*.ipa`, `*.apk`), never committed.

## Starting points (bundled templates)

Copy into the project and fill in: `templates/eas.json`, `templates/PUBLISH.md`, `templates/PREFLIGHT.md`, `templates/app-store-listing.txt`, `templates/play-store-listing.txt`, `templates/gitignore-snippet.txt`. See `docs/release-tree.md` for where they live per version.
