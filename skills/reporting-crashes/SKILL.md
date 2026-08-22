---
name: reporting-crashes
description: >-
  Use when wiring crash and error reporting into an Expo/RN app, or when production crash reports are unreadable — minified stack traces, missing sourcemaps, crashes that never arrive. Trigger on "set up Sentry", "crash reporting", "the stack trace is minified", "crashes aren't showing up", "sourcemaps", "symbolicate", "what's crashing in production", "error monitoring". Keywords: Sentry, @sentry/react-native, sourcemap, symbolication, Hermes, dSYM, ProGuard, sentry.properties, release, dist, native crash, JS error, sampling, PII.
---

# Reporting crashes

A release build's stack traces are useless by default: Hermes bytecode and minified JS
produce frames like `at t (index.android.bundle:1:284591)`. Sourcemaps are what turn that
back into your code, and they have to be uploaded **for the exact build** — which is the
step that gets skipped, so the first real production crash is unreadable.

## Wire it as a config plugin, not by hand

```json
{ "plugins": ["@sentry/react-native"] }
```

`ios/` and `android/` are `expo prebuild` output and get regenerated, so any hand-edit to
the native projects disappears at the next prebuild. The plugin also installs the build-phase
step that uploads sourcemaps and native symbols during a release build — which is the part
you actually want automated.

Initialize early, before the app renders, so a crash during startup is still captured:

```ts
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,   // literal member expression — see configuring-expo-env
  enabled: !__DEV__,                          // dev crashes are noise you already saw
  tracesSampleRate: 0.2,                      // 1.0 in dev/beta, sample in production
  sendDefaultPii: false,
});
```

The upload credentials (`sentry.properties`, auth token) are **build-time only** and belong
in the native project / EAS secrets — never behind an `EXPO_PUBLIC_*` prefix, which would
ship the token inside the binary. The DSN is public by design and is fine there.

## Release and dist must match the build

Symbolication joins on `release` + `dist`. If those do not equal what was uploaded, the
sourcemap exists and is simply never applied — reports stay minified while the dashboard
shows the artifact present, which is the most confusing version of this failure.

Use the app version as `release` and the **build number** as `dist`, and remember EAS owns
the build number under `appVersionSource: remote`, so it is not knowable before the build.
Let the plugin derive both rather than hardcoding.

**Verify on the first release build, not later:** trigger a deliberate crash in a TestFlight
or internal-track build and confirm the report arrives *with your function names in it*. A
crash reporter that was never proven on a store build is an assumption.

## The two crash surfaces still do not overlap

A JS error reaches Sentry through the JS layer. A **native** crash — a bad TurboModule, a
nil in a native SDK — kills the process, and only the native handler sees it. Both matter,
and they need different symbols:

| | Symbols needed | Uploaded by |
|---|---|---|
| JS / Hermes | sourcemap + Hermes bytecode map | the build-phase step |
| iOS native | dSYM | the build-phase step, or manually from ASC |
| Android native | ProGuard/R8 mapping + `.so` symbols | the build-phase step |

If native crashes arrive as raw addresses, the dSYMs did not upload — ASC also holds them,
and they can be re-uploaded after the fact.

For reading crashes locally during development (`.ips` files, `adb logcat`), see
`driving-simulators-and-devices`.

## Watch the release

`releasing-with-eas` says to watch crashes for 24h after a rollout. What that means
concretely:

- crash-free **session** rate, compared against the previous release — an absolute number
  means nothing without the baseline
- new issues first seen on this release, sorted by user count rather than event count, so
  one user in a crash loop does not outrank a hundred users hitting something once
- for a staged Play rollout, watch before advancing the percentage — that is the entire
  point of staging it

A JS-only fix can ship straight back out over the air (`shipping-ota-updates`); a native
crash needs a rebuild.

## Privacy

Crash reporting is **data collection** and must be declared in App Privacy and Play's Data
safety form (`passing-app-review`). Keep `sendDefaultPii: false`, and scrub anything
identifying out of breadcrumbs and extra context — request bodies and auth headers are the
usual leaks.

## Related

- `driving-simulators-and-devices` — reading crashes locally, before they reach production
- `shipping-ota-updates` — getting the fix out without a store round trip
- `configuring-expo-env` — the DSN must inline; the auth token must not ship
