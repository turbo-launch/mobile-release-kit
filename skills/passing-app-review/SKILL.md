---
name: passing-app-review
description: >-
  Use when preparing an app for App Store / Play review, or after a rejection — the compliance surface that gets apps rejected or removed: account deletion, purchase-surface rules, privacy manifests, tracking permission, export compliance, and demo credentials that actually work. Trigger on "app review", "rejected", "Guideline 2.1 / 2.3.1 / 3.1.1 / 5.1.1", "app got removed", "review notes", "privacy manifest", "data safety", "account deletion", "will this pass review", "compliance check". Trigger before any first submission. Keywords: App Review, rejection, Guideline, account deletion, 5.1.1(v), 2.3.1, 3.1.1, 4.8, PrivacyInfo.xcprivacy, App Tracking Transparency, NSUserTrackingUsageDescription, export compliance, ITSAppUsesNonExemptEncryption, Data safety, demo account, closed testing.
---

# Passing app review

Most rejections are not about the app. They are about a checkbox, a missing screen, or a
demo login that does not work — cheap to fix beforehand, expensive as a round trip that
costs 24–48h each time.

Run this **before the first submission**, and again whenever auth, purchases, or data
collection changes.

## The pre-submission checklist

```
- [ ] In-app account deletion, if the app can create an account
- [ ] Sign in with Apple offered, if any other social login is
- [ ] Demo credentials VERIFIED working, today, on a clean install
- [ ] Purchase surface visible at review — never behind an off flag
- [ ] Privacy manifest + third-party SDK manifests present
- [ ] ATT prompt, if anything is tracked across apps
- [ ] Export compliance answered in the plist, not per-submission
- [ ] Play: Data safety form matches what the app actually sends
- [ ] Play: closed-testing window planned, if this is a first release
```

## Account deletion — the one people forget

**If the app can create an account, it must offer account deletion inside the app**
(Guideline 5.1.1(v)). Not an email address, not a web form, not "contact support" — an
in-app path that initiates full deletion.

This is a hard rejection, and it is easy to ship without noticing because nothing else in
the app depends on it. It is also worth auditing on apps *already live*: the requirement
arrived after many were published.

```bash
grep -rniE "deleteAccount|delete[_-]account|account[_-]deletion" src/ | head
```

Empty output on an app with sign-in means it will be rejected. If deletion is asynchronous
(a grace period, a backend job), say so in the UI and the review notes.

## Purchases

- **2.3.1 — hidden features.** A purchase surface disabled at review and enabled afterwards
  risks **account termination**, not just rejection. If the paywall depends on keys, absent
  keys should mean it does not render; never a runtime toggle you flip after approval.
- **3.1.1 — external purchase.** Digital goods consumed in the app must use IAP. Linking out
  to a web checkout for them is a rejection. (Physical goods and real-world services are the
  exception, not a loophole for digital content.)
- If an entitlement is granted **server-side** with no purchase in the binary, say so in the
  review notes or it reads as an undeclared IAP.
- **2.1(b) — submit the IAP *with* the version.** An in-app purchase that merely exists in
  the App Store Connect record, unattached to a submission, is rejected as *"references to
  purchases but the associated In-App Purchase products have not been submitted for review"* —
  and it fires on the **record**, not the binary, so a build carrying no purchase surface at
  all is rejected too. Your first IAP must go with a new app version.

**Build the submission in the draft, and submit once from there.** Pressing *Add for Review*
on the version page while a draft is open does not add the version to that draft — it forks a
**second submission containing only the app** and sends it, leaving your IAP behind. Nothing
in the UI shows this; the version reads *Waiting for Review* either way. The submission list
is the tell, in the column nobody reads:

> **1 Item, on an app that sells anything, is the bug.**

Adding the subscription **group** is not adding the subscription — add the auto-renewable
subscription from inside the group. Then verify from the API rather than the console, because
both states look identical there:

```bash
# after submitting, the subscription must NOT still say READY_TO_SUBMIT
GET /v1/subscriptionGroups/{id}/subscriptions   ->  state: WAITING_FOR_REVIEW
```

Recovery is expensive, so get it right the first time: removing a version from review sets it
`DEVELOPER_REJECTED`, which **greys out Add for Review**, leaving `POST
/v1/reviewSubmissionItems` as the only way to attach it — and you go to the back of a queue
that can be two weeks long.

See `selling-subscriptions` for the disclosure the paywall itself must carry.

## Sign-in

**4.8** — offering any third-party social login obliges you to offer Sign in with Apple as
an equivalent option. Equivalent means it collects no more than name and email and does not
track without consent.

If the app is usable **without** an account, say so in the review notes and explain what
sign-in unlocks — reviewers otherwise assume a hard gate and fail 2.1 when the demo login
does not work.

## Demo credentials

**Verify them the day you submit, on a clean install.** A stale password is the most common
2.1 rejection, and it costs a full review cycle. Walk the exact path a reviewer will:
install, sign in with the demo account, reach the gated feature.

If a flow needs something unusual — a sandbox purchase, a second device, a code — spell it
out step by step. Reviewers do not explore.

## Privacy and tracking

- **Privacy manifest** (`PrivacyInfo.xcprivacy`) — required, and third-party SDKs must carry
  their own. Expo generates one from your config; confirm it is in the built app rather than
  assuming.
- **ATT** — tracking users across other companies' apps requires the App Tracking
  Transparency prompt and `NSUserTrackingUsageDescription`. Attribution SDKs frequently pull
  this in without you deciding to track.
- Declared data collection must match reality on **both** stores — App Privacy on ASC, the
  **Data safety** form on Play. Analytics and crash reporting count as collection.
- Ask for permissions **at the moment of use**, with a usage string that says why. A
  launch-time wall of prompts is both a rejection risk and the reason people decline
  forever.

## Export compliance

Set it in the app config so it is answered once rather than on every submission:

```json
{ "ios": { "infoPlist": { "ITSAppUsesNonExemptEncryption": false } } }
```

`false` is correct for the common case: HTTPS only, no custom cryptography. If you ship
custom crypto, that is not this checkbox.

```bash
unzip -p build.ipa 'Payload/*.app/Info.plist' | plutil -p - | grep -i nonexempt
```

## Play specifics

- **First release cannot always go straight to Production.** A new app — especially on a
  personal account — may need a **closed-testing track with ~12 testers for ~14 days** plus
  identity verification before Production unlocks. If "Production" is greyed out, that is
  why. Plan the window in rather than discovering it on launch day.
- Data safety form, target API level, and a 1024×500 feature graphic are all blocking.

## After a rejection

Read the guideline number, not just the prose — it says exactly which rule was applied. Fix
the cause and reply in Resolution Center describing what changed; a reply without a change
restarts the same review. A rejection does **not** need a new build unless the binary itself
was the problem — metadata and review-note fixes resubmit against the same build.

## Related

- `writing-store-listings` — the review notes and demo-credential fields
- `selling-subscriptions` — paywall disclosure, sandbox testing
- `wiring-social-sign-in` — 4.8 equivalence
