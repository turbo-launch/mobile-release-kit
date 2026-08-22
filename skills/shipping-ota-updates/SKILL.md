---
name: shipping-ota-updates
description: >-
  Use when shipping a JS-only fix over the air with EAS Update instead of a store release, setting OTA up for the first time, or working out why an update never reached devices. Trigger on "OTA", "eas update", "push a hotfix without a release", "ship a fix instantly", "the update didn't arrive", "expo-updates", "runtime version", "channel", "can I OTA this". Keywords: eas update, expo-updates, runtimeVersion, appVersion policy, channel, branch, rollback, hotfix, JS-only, native change, eas channel, eas update:list.
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

Devices pick it up within a launch or two, depending on your `checkAutomatically` /
`fallbackToCacheTimeout` settings. Write a real message — it is what you read when deciding
what to roll back to.

**Roll back by republishing**, not by deleting: `eas update:republish` the last good update
onto the branch. Removing an update does not recall it from devices that already have it.

**Test on a real install before publishing to production.** A preview branch plus a build on
that channel costs one extra step and is the only way to see the update apply as a user
sees it — including the launch-cycle delay, which is where "it works on my machine" hides.

## Do not OTA past review

Updating in a way that materially changes what was reviewed — adding a purchase surface,
changing the app's purpose, enabling a feature that was hidden at review — is the same
violation as hiding it in the binary. See `passing-app-review` (2.3.1). Bug fixes and copy
changes are what this is for.

## Related

- `releasing-with-eas` — when a binary release is required instead
- `configuring-expo-env` — env values are baked at *build* time, so an update cannot change them
- `passing-app-review` — what an update must not change
