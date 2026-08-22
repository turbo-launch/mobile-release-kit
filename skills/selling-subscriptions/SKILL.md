---
name: selling-subscriptions
description: >-
  Use when adding, testing, or debugging in-app purchases and subscriptions in an Expo/RN app — RevenueCat or StoreKit/Play Billing wiring, the paywall, entitlements, the purchase webhook, and the store-side product setup that has to exist before any of it works. Trigger on "add in-app purchases", "IAP", "subscriptions", "paywall", "RevenueCat", "the paywall is empty", "no offerings", "purchase succeeded but nothing unlocked", "restore purchases", "sandbox testing", "sell PRO in the app". Keywords: react-native-purchases, offerings, entitlement, StoreKit, Play Billing, Paid Apps Agreement, merchant account, sandbox tester, license tester, webhook secret, restore, Guideline 2.3.1, 3.1.1, auto-renew, introductory offer, reconciliation.
---

# Selling subscriptions

Money is the one path where a silent failure costs revenue rather than a bug report, and
most of the work is **dashboard paperwork no code can do**. Two steps have multi-day lead
times, so start them before the build is ready, not after.

```
Apple Paid Apps Agreement ─┐
                           ├─▶ create products ─▶ RevenueCat wiring ─▶ build ─▶ submit
Play merchant setup ───────┘
```

You cannot create a subscription product before the paid-apps/merchant paperwork is active,
and **Apple reviews a subscription attached to the first binary that uses it** — it cannot
be approved ahead of the build. Plan the sequencing into the release, not around it.

## The three rules that carry real penalties

1. **Never hide the purchase surface behind a flag that is off at review.** A paywall
   switched off during review and on afterwards is **Guideline 2.3.1**, where the penalty is
   *account termination*, not rejection. If the SDK keys are absent the paywall should simply
   not render — that is a build-time absence, which is fine. A runtime toggle is not.
2. **Never accept sandbox purchases in production.** A webhook that honours sandbox events
   lets any TestFlight or internal-testing tester grant themselves the paid tier for free —
   and after launch, anyone who can sideload. Gate it:
   `ACCEPT_SANDBOX=false` in production, `true` only on beta/staging.
3. **A blank webhook secret must reject, not accept.** Comparing an unset secret against an
   absent header succeeds, which turns the endpoint into "grant me the paid tier". Fail
   closed:

   ```python
   if not expected or not hmac.compare_digest(provided, expected):
       raise ValidationError(...)          # blank secret ⇒ every delivery 401s
   ```

## Store-side setup

**App Store Connect**

- A subscription **group**, then the subscription: duration, product id, price per
  storefront, localizations (display name + description **per locale you ship**).
- An **introductory offer** if you have one on web — mismatched pricing across rails is a
  support burden, not a rejection.
- A **review screenshot of the paywall** — required per subscription, and a common
  "waiting for review" stall when missing.
- An **In-App Purchase Key** (Keys → In-App Purchase). StoreKit 2 needs it.

**Play Console**

- Subscription with a base plan (e.g. `P1M`), auto-renewing, price at parity.
- **Activate the base plan.** An inactive plan returns *no offering* and the paywall renders
  empty with no error.
- The app must be **live on at least one track** before billing works at all.

**RevenueCat** (or your equivalent)

- One app per platform; upload the IAP key (iOS) and service-account credentials (Android).
- The **entitlement id must equal** what the backend checks. A mismatch here is invisible:
  purchases succeed, the store charges, and nothing unlocks.
- The offering must be marked **current** — an app reading `offerings.current` sees nothing
  from a non-current offering, which again looks like an empty paywall rather than an error.
- Webhook URL + an `Authorization` value you generate.

## Keys: which is which

| Key | Where it lives | Shape |
|---|---|---|
| Public SDK key | the app, as `EXPO_PUBLIC_*` | `appl_…` / `goog_…` |
| **Secret** API key | the backend only | `sk_…` |
| Webhook secret | the backend only | whatever you generated |

Putting the secret key in an `EXPO_PUBLIC_*` var ships it inside the binary, where anyone
can read it. There is no client-side hiding place — see `configuring-expo-env`.

`react-native-purchases` is a **native module**, so an existing build has not linked it:
`bunx expo prebuild --clean` and rebuild. Then let the artifact gate confirm the public keys
actually inlined (the artifact gate in `releasing-with-eas`) — an empty key means no
paywall at all.

## Entitlement is the source of truth, not the receipt

Resolve "is this user paid?" from the entitlement, and treat *lifetime* (no expiry) and
*expired* as distinct from *absent*:

```python
def is_entitled(payload, entitlement_id, now):
    ent = (payload or {}).get("subscriber", {}).get("entitlements", {}).get(entitlement_id)
    if not ent:                      return False
    if ent.get("expires_date") is None: return True        # lifetime
    expires = parse_datetime(ent["expires_date"])
    return bool(expires and expires > now)
```

**Cancellation is not revocation.** A user who cancels auto-renew keeps access until the
period ends. Revoking at the `CANCELLATION` event bills them for time you then take away —
which is a refund request and a one-star review. Only expiry ends access.

**Webhooks get missed** — network blips, your own downtime. Add a daily reconciliation
sweep that re-fetches each subscriber and re-derives state, so a silently-expired or
silently-renewed entitlement converges within a day. Make it tolerant: one subscriber's
parse failure must not abort the sweep.

## The paywall must carry all of it

Reviewers reject subscriptions for **missing disclosure** more than for anything else. On
the paywall screen itself, not a link away:

- subscription name, **duration**, and **localized price** from the offering (never
  hardcoded — the store owns the price per storefront)
- what auto-renewal means
- **Terms** and **Privacy** links
- **Restore Purchases** — a required button, not a nicety

## Test before you submit

- **iOS:** a Sandbox tester (ASC → Users and Access), buying on a *real device*. Sandbox
  renewals are compressed — a month passes in minutes, which is how you test expiry at all.
- **Android:** license testers on a published track.
- Point the app at a backend with sandbox **accepted**, or the purchase will succeed in the
  store and correctly *not* grant the entitlement — which reads as a broken integration.
- Confirm the event was recorded server-side and the entitlement applied.
- **Cancel auto-renew and confirm access stays** until period end.
- **Delete, reinstall, sign in, Restore Purchases** — confirm access returns. This is the
  path reviewers actually walk.

## Review notes

State the demo account, that the purchase must be made with a **Sandbox account**, and —
if true — that the app is usable without an account and sign-in is required only to buy, so
the subscription survives a reinstall. See `writing-store-listings`.

## Related

- `configuring-expo-env` — the public keys must inline, and the secret must not be there
- `passing-app-review` — 2.3.1, 3.1.1 and the rest of the rejection surface
- `releasing-with-eas` — prebuild + the artifact gate before uploading
