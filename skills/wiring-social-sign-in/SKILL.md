---
name: wiring-social-sign-in
description: >-
  Use when adding or debugging Sign in with Apple / Google Sign-In in an Expo/RN app and the server that verifies the token — especially when sign-in works on web but fails on device, or fails only in a release build. Trigger on "Apple login is failing", "sign in with Apple", "Google sign-in", "Bad Request on /auth/apple", "invalid audience", "works on web not on mobile", "social login", "OAuth on mobile". Keywords: expo-apple-authentication, google-signin, id_token, aud, iss, kid, Services ID, bundle identifier, audience, nonce, SHA-1, type-1 client, google-services.json, reversed client id, InvalidAudienceError, account deletion.
---

# Wiring social sign-in

Native social sign-in fails differently from web, and the failure is nearly always an
**audience or client-identity mismatch** rather than broken code. The endpoint says
`Bad Request`, which covers three unrelated causes, and elimination takes hours.

Fix that first: **make the server say what it got and what it expected.**

## The one change that turns hours into one attempt

On any token-verification failure, log the token's *unverified* claims beside the audiences
you accept:

```python
logger.warning(
    "Apple identity_token rejected (%s): expected aud one of %s — kid=%r alg=%r aud=%r iss=%r",
    type(exc).__name__, settings.APPLE_CLIENT_IDS, kid, alg, aud, iss,
)
```

Read the unverified claims **purely for the message, never for a decision**, and **never log
the token itself** — it is a bearer credential. Also warn loudly when the allowed-audience
list is *empty*: that configuration rejects every login while looking like a code bug.

## Apple: the audience depends on the flow

| Flow | `aud` in the token |
|---|---|
| Native (`expo-apple-authentication`) | the **bundle identifier** |
| Web / Services-ID flow | the **Services ID** |

Both belong in the server's allowed-audience list. This is the single most common cause of
"works on web, fails on mobile" — the server was configured for the web flow only.

**When it disagrees, fix the configuration, not the identifier.** The bundle ID is permanent
once a build is uploaded; changing it means a new listing with zero ratings and zero install
history. A real incident here was an allowed-audience list containing a plausible-looking
identifier that *did not exist* — a plausible `com.acme.app.ios` while the app actually
shipped as `com.acme.app`. It had been invented rather than read off the build, and it
looked right in every code review.

Other Apple specifics:

- Apple returns the **name and email only on the very first authorization**. Persist them
  then; a re-auth returns nulls, and testing repeatedly makes it look like the API broke.
  Reset by revoking the app under Settings → Apple ID → Sign-In and Security.
- Verify `iss` is `https://appleid.apple.com`, validate `exp`, and check the **nonce** you
  sent — without the nonce check a stolen token from another app replays against yours.
- If you offer **any** third-party social login, Apple requires Sign in with Apple as an
  equivalent option (Guideline 4.8) — and requires in-app **account deletion**
  (see `passing-app-review`).

## Google: the client the native SDK resolves is not the web one

Google Sign-In on Android resolves its client by **package name + SHA-1 signing
certificate**, never by an id you pass. So:

- `google-services.json` must contain a **type-1 (Android)** OAuth client, not only type-3
  (web). A file carrying only the web client looks complete and silently breaks native
  sign-in.
- Its `certificate_hash` must equal the **SHA-1 of the keystore that signed the build you
  are running** — debug and upload keystores differ, so a build that works locally fails as
  a release, and Play App Signing introduces a *third* certificate. Register all of them.
- The file ships **inside the binary**, so it must be in place before the build. It is
  client config, not a secret; commit it.
- On the server, verify the token's `aud` against the **web client id**, even for native
  sign-ins — that is the audience Google issues for backend verification.

Use the same GCP project that owns messaging, so sign-in and push share one identity
(`setting-up-push-notifications` covers the rest of that file).

## Verify on a real release build

Every part of this is invisible in development:

- Expo Go **cannot** load these native modules at all — always `expo run:*` or a dev client
  (`driving-simulators-and-devices`).
- The signing certificate differs between debug and release, so Google sign-in can work all
  the way through testing and fail in the store build.
- iOS Simulator can do Sign in with Apple, but only with an Apple ID signed in.

After wiring, confirm on device: sign in, kill the app, relaunch (session persists), sign
out, sign in again (the second Apple authorization returns no name — your persisted copy
must survive), then delete and reinstall.

## Related

- `passing-app-review` — 4.8 equivalence and the account-deletion requirement
- `setting-up-push-notifications` — the same `google-services.json`, the other half
- `configuring-expo-env` — client ids are build-time config and must actually inline
