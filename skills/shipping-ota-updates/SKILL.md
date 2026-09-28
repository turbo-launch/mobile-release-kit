---
name: shipping-ota-updates
description: >-
  Use when shipping a JS-only fix over the air with EAS Update instead of a store release, setting OTA up for the first time, or working out why an update never reached devices. Trigger on "OTA", "eas update", "push a hotfix without a release", "ship a fix instantly", "the update didn't arrive", "the update only shows after a restart", "users still see the old version", "expo-updates", "runtime version", "channel", "can I OTA this". Keywords: eas update, expo-updates, runtimeVersion, appVersion policy, channel, branch, rollback, hotfix, JS-only, native change, eas channel, eas update:list, fallbackToCacheTimeout, launchWaitMs, useUpdates, reloadAsync, second cold start.
---

# Shipping OTA updates

`eas update` ships a JS/asset change to installed apps in seconds, with no rebuild and no
store review. It is the highest-leverage tool in a mobile release — and it silently reaches
nobody when any one of three conditions fails.

## An update only reaches a binary that satisfies all three

1. It was **built by EAS** with `expo-updates` configured for this project. A binary
   produced by a manual Xcode archive does not reliably poll for updates — so if every
   shipped build was archived by hand, "fix OTA" means *ship one successful EAS build and
   get users onto it first*. There is no config-only shortcut.
2. Its **channel** matches what you published to (the build profile's `channel`, which is
   what `eas update --branch` maps onto).
3. Its **`runtimeVersion` matches the update's exactly.**

All three fail *silently*. Nothing errors; the update simply is not delivered. Check what
actually exists rather than assuming:

```bash
eas update:list --branch production
eas channel:view production
```

## The runtimeVersion trap

With the common `runtimeVersion: { policy: "appVersion" }`, OTA is keyed to the **marketing
version**. An update built at `1.0.2` lands only on installs running `1.0.2`.

- **Keep `version` stable** across JS-only fixes → updates flow freely.
- **Bump `version`** → you must ship a *new build* at that version before you can OTA to it.
  A `1.0.2` update never reaches `1.0.3` installs, and vice versa.

So the version bump is not free: it splits your installed base into two runtime cohorts, and
the old one only receives updates you publish at the old version.

## What can and cannot go over the air

| OTA-able | Needs a rebuild + resubmit |
|---|---|
| JS, TS, styles | a new native dependency |
| images and other bundled assets | a config-plugin or `app.config` change |
| copy, i18n strings | permissions, entitlements, capabilities |
| business logic, API calls | anything touching `ios/` or `android/` |
| | a `version` bump (see above) |

Shipping a native change as an update does not fail loudly — it produces a JS bundle that
calls into a module the binary does not have, which crashes on the device that receives it.
When in doubt, rebuild.

## Publishing

```bash
eas update --branch production --message "otp flicker fix"
```

Write a real message — it is what you read when deciding what to roll back to.

**Roll back by republishing**, not by deleting: `eas update:republish` the last good update
onto the branch. Removing an update does not recall it from devices that already have it.

**Test on a real install before publishing to production.** A preview branch plus a build on
that channel costs one extra step and is the only way to see the update apply as a user
sees it — including the launch-cycle delay, which is where "it works on my machine" hides.

## An update lands on the SECOND cold start — unless the app waits for it

With the default `fallbackToCacheTimeout: 0` (native `launchWaitMs: 0`), a launch checks,
downloads the update *behind the running app*, and keeps running the old bundle. The update
takes over only at the **next cold start**. On Android, back, home and reopening from
recents are not cold starts — the process lives on, so a user who never swipes the app away
runs the old bundle for days. The symptom is "the update is published, the server serves
it, and the phone still shows the old app."

**If you ship updates often, hold the splash on a JS gate and reload before first render:**

- **Two budgets, not one.** ~3 s for the check to answer; once it reports an update
  (`isUpdateAvailable`), extend to ~10 s for the download. A full bundle is several MB — a
  measured download took 4.2 s, so a single 3 s budget let the update miss.
- **Reload only after `isStartupProcedureRunning` is false.** The download completes a few
  ms before the startup procedure ends; `reloadAsync()` in that gap can be refused.
- **Never reload a screen in use.** Past the budget, open the app; a late download waits.
  On a resume after a long absence (5+ min), apply a pending update or check-and-fetch
  inside the same budgets. A quick switch away (a link out and back) never reloads.
- **Gate the providers too, not just the splash.** Render nothing until the gate opens —
  a provider that consumes a cold-start notification tap before the reload loses the tap.
- **Fork it for web** (`ota.web.ts` returning `true`): `expo-updates` degrades silently there.

```ts
const { isStartupProcedureRunning, isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
// open when: !Updates.isEnabled || startup ended with nothing pending || budget expired
// budget:    isUpdateAvailable ? DOWNLOAD_BUDGET_MS : CHECK_BUDGET_MS, from launch
// reload:    isUpdatePending && !isStartupProcedureRunning && !open → Updates.reloadAsync()
```

The gate itself reaches users only through the old two-launch path, once. Every update
after it applies on first launch.

**Verify it on a release build, against a throwaway channel** — unit tests cannot see the
native state machine's timing:

```bash
eas channel:create ota-test                    # also creates branch ota-test
# temporary eas.json profile: { "channel": "ota-test", "android": { "buildType": "apk" } }
EAS_NO_VCS=1 eas build -p android --profile ota-test --local --output ota-test.apk
adb install -r ota-test.apk && launch once     # baseline: CheckCompleteUnavailable
eas update --branch ota-test -p android -m "B"   # the gate code; two launches to get onto it
eas update --branch ota-test -p android -m "C"   # now ONE launch must apply C:
adb logcat | grep -E 'Updates state change|Running "main"'
# pass: CheckCompleteAvailable → DownloadComplete → EndStartup → Restart, then "main" twice
eas channel:delete ota-test && eas branch:delete ota-test   # and revert eas.json
```

## When "the update never arrived"

Work outward from the server, not inward from a guess:

```bash
# 1. Does the server hand this binary the update? (a 200 with expo-update-id = yes)
curl -sD - -o /dev/null https://u.expo.dev/<project-id> \
  -H 'expo-platform: android' -H 'expo-runtime-version: <runtime>' \
  -H 'expo-channel-name: production' -H 'expo-protocol-version: 1' \
  -H 'accept: multipart/mixed' | grep -iE '^HTTP|expo-update-id'

# 2. What does the shipped binary actually ask for?
unzip -p build.aab base/resources.pb | strings | grep -A1 expo_runtime_version
unzip -p build.aab base/manifest/AndroidManifest.xml | strings | grep -iE 'channel|u\.expo'
unzip -p build.ipa 'Payload/*/Expo.plist' | plutil -p -     # iOS: EXUpdates* keys

# 3. Watch it apply: the real store artifact on an emulator
bundletool build-apks --bundle=build.aab --output=u.apks --mode=universal \
  --ks=$HOME/.android/debug.keystore --ks-pass=pass:android \
  --ks-key-alias=androiddebugkey --key-pass=pass:android
unzip -o u.apks universal.apk && adb install -r universal.apk
```

A local `ios/`/`android/` directory under CNG is not evidence — it can show updates disabled
while the EAS-built artifact has them on. Inspect the artifact.

## Do not OTA past review

Updating in a way that materially changes what was reviewed — adding a purchase surface,
changing the app's purpose, enabling a feature that was hidden at review — is the same
violation as hiding it in the binary. See `passing-app-review` (2.3.1). Bug fixes and copy
changes are what this is for.

## Related

- `releasing-with-eas` — when a binary release is required instead
- `configuring-expo-env` — env values are baked at *build* time, so an update cannot change them
- `passing-app-review` — what an update must not change
