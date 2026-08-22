---
name: setting-up-push-notifications
description: >-
  Use when wiring push notifications into an Expo/RN app, or when a device registers no push token and notifications silently never arrive on one platform. Trigger on "set up push notifications", "push isn't working", "no push token", "notifications work on iOS but not Android", "expo-notifications", "FCM", "APNs", "google-services.json", "device doesn't register", "notifications never arrive". Keywords: expo-notifications, getExpoPushToken, APNs key, FCM V1, service account, google-services.json, googleServicesFile, firebase, legacy API retired, eas credentials, notification permissions, SHA-1, upload keystore.
---

# Setting up push notifications

The part of a mobile app with the most moving pieces, and **the failure is always silent**: a
device whose credential is missing simply registers nothing, so "push is broken" and "no
matching events to send" look identical from the outside.

Work platform by platform and verify each half — never infer one from the other.

## Where each half lives

| Platform | Credential | Lives | Needs a rebuild? |
|---|---|---|---|
| iOS | APNs key (`.p8`) | EAS credentials — **server-side** | **No** |
| Android | FCM **V1** service-account key | EAS credentials — **server-side** | **No** |
| Android | `google-services.json` | **inside the AAB/APK** | **Yes** |

**That last row is the one that bites, every time.** iOS push is entirely server-side, so it
is natural to assume Android is too. It isn't. Without `google-services.json` bundled *in
the binary*, `expo-notifications` cannot obtain an FCM token and the device never registers
at all — no error, no token, no notifications. Uploading credentials to EAS afterwards
changes nothing until you **rebuild**.

## iOS

```bash
eas credentials --platform ios      # → Push Notifications: set up a Push Key
```

EAS creates and stores the APNs key. Nothing ships in the binary beyond the entitlement, so
no rebuild is needed once the key exists — as long as the build already carried the
notification entitlement (it does if `expo-notifications` was installed before the build).

Enable the capability in the Apple Developer portal for the App ID if EAS did not do it.

## Android

1. **Firebase console → Project settings → your Android app → download
   `google-services.json`.** Use the **same GCP project** that owns your OAuth client, so
   sign-in and messaging share one identity.
2. **Confirm it contains a type-1 (Android) OAuth client**, not only type-3 (web). Google
   Sign-In resolves the native client by *package name + SHA-1*, never by an id — a file
   carrying only the web client silently breaks sign-in while looking complete.
3. **Confirm its `certificate_hash` equals your upload keystore's SHA-1** exactly.
   ```bash
   eas credentials --platform android      # shows the keystore SHA-1
   ```
4. **Commit the file.** It is client config, not a secret — the API key in it is
   app-restricted — and committing keeps Android builds reproducible on any machine.
5. **Only then** set it in the app config:
   ```json
   "android": { "googleServicesFile": "./google-services.json" }
   ```
   Setting this before the file exists makes `expo prebuild` fail.
6. **Rebuild.** The file ships inside the artifact, so it must be in place *before* the
   build, not after.

**Upload the FCM V1 service-account key to EAS.** Firebase console → Project settings →
Service accounts → Generate new private key, then:

```bash
eas credentials --platform android      # → FCM V1 service account key
```

> **The *Legacy* push slot in `eas credentials` is dead.** Google retired the FCM legacy HTTP
> API in June 2024. Uploading a legacy server key **appears to succeed** and delivers
> nothing. If push silently stopped working on an app that used to work, check this first.

## Verify end to end — do not infer

```bash
# 1. does the binary carry the config at all?
unzip -l build.aab | grep -i google-services      # expect a hit

# 2. does a real device get a token?
#    log it at startup in a dev build, then send one from https://expo.dev/notifications
```

In app code:

```ts
const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
console.log('expo push token', token);
```

No token logged means registration failed — go back to the table above; it is a credential
or a bundling problem, not a server problem. A token but no delivery is the server half.

**Test on a real device.** iOS Simulators cannot receive push notifications at all; an
Android emulator can only with Play services in the image.

## Asking for permission

**Ask at the moment it is needed, not at launch.** Both stores look for this, and a
launch-time prompt is the single most common reason people decline push permanently — which
is unrecoverable without sending the user into system settings.

```ts
const { status } = await Notifications.getPermissionsAsync();
if (status !== 'granted') await Notifications.requestPermissionsAsync();
```

Android 13+ requires the runtime `POST_NOTIFICATIONS` permission; `expo-notifications`
declares it, but you still have to request it.

## Related

- `configuring-expo-env` — the other thing that is present in dev and absent in the binary
- `releasing-with-eas` — a rebuild is required after step 6; plan it into the release
