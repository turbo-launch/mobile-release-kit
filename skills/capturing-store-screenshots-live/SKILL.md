---
name: capturing-store-screenshots-live
description: >-
  Use when store screenshots need REAL native captures from iOS Simulators — especially the live gameplay / hero screen of a real-time or multiplayer app that needs more than one actor on screen, or when pixel-perfect native chrome matters. Trigger on "live gameplay screenshot", "multiplayer / real-time hero shot", "capture from the simulator", "native screenshots", "the answer-grid / leaderboard / lobby screen", "two-device flow". Keywords: simctl, simulator, status bar, dev launcher, PIN, host, participant, native capture.
---

# Capturing store screenshots from a live simulator

Use this when the strongest screenshot is the **real in-app moment** — live gameplay, a leaderboard mid-round, a session lobby — which often needs two actors (a host and a participant). For static screens with no live state, `capturing-store-screenshots-web` is faster. Frame the output with `framing-store-screenshots`.

**Check first whether the web path is even possible.** Many RN apps deliberately delete `react-native-web` / `react-dom` (Expo `platforms: ["ios","android"]`). Then `capturing-store-screenshots-web` cannot run at all and this skill is the *only* option for every screen, static ones included — budget accordingly, because live capture is an order of magnitude slower than a headless web batch. Grep `package.json` for `react-native-web` before promising a timeline.

## Two-simulator host + participant workflow

A real-time screen needs the other side to exist. Drive two simulators at once.

1. **List + boot.** `xcrun simctl list devices` → pick two UDIDs (e.g. an iPhone 6.9" and any second device). `xcrun simctl boot <UDID>`; `open -a Simulator`.
2. **Install a sim-runnable build from source** on each: `bun expo run:ios --device <UDID>`. A store `.ipa` is device-only and will **not** run on a simulator.
3. **Host side:** drive the host app to launch a session → it shows a PIN / join code.
4. **Participant side:** join by that PIN. Capture the participant's screen for the hero (it's the experience most users see).
5. **Advance phases on the host** (start → question → reveal → leaderboard) and capture the participant at each beat.

Drive the UI with the `mobile-mcp` tools: `mobile_list_elements_on_screen` (coordinates come from here, **not** from the screenshot pixels), `mobile_click_on_screen_at_coordinates`, `mobile_swipe_on_screen`.

## ⚠️ Pin the target device on EVERY driver command

**The single biggest time-sink in a two-platform session.** Maestro (and most UI drivers) auto-select a device when you don't name one — and an attached Android emulator can silently win while you believe you're driving the iOS simulator. Every tap then reports `COMPLETED` and *nothing on screen changes*, because it is changing the other device.

```bash
maestro --device <IOS_UDID>      test flow.yaml    # xcrun simctl list devices booted
maestro --device emulator-5554   test flow.yaml    # adb devices
```

Maestro prints `Running on <device>` as its **first line** — read it before trusting anything downstream. Symptoms that mean you're on the wrong device, not a broken app:

- taps report success but successive screenshots are byte-identical
- a text matcher fails on a label you can plainly see in the screenshot
- `maestro hierarchy` hangs or dumps a tree that doesn't match the screen

Do **not** respond by rebooting the simulator, killing drivers, or reinstalling the app. Check the device flag first. (An easy confirmation: run a flow with a bogus `appId` — the error names the device it tried.)

## Driving the UI — matcher pitfalls

- **Prefer regex over exact text.** `tapOn: '.*Kia K5.*'` survives whitespace, invisible affixes, and non-breaking spaces that break exact matches.
- **Single-quote YAML strings containing backslashes.** `".*LADA \(VAZ\).*"` is a YAML parse error; `'.*LADA.*VAZ.*'` is fine.
- **Some visible text isn't in the accessibility tree** — custom tab bars are the usual offender. Fall back to a point tap (`tapOn: { point: "62%,94%" }`), taking the fractions from the screenshot.
- **A tap that only dismisses the keyboard doesn't press the button underneath.** After `inputText`, the first tap on a submit button often just closes the IME; issue the tap twice, or `hideKeyboard` first (which itself fails on some screens — tolerate that).
- **Fill multi-field forms one field per flow.** Chained `tapOn`/`inputText` pairs in a single flow frequently drop the later fields with no error.
- **Deep links are not a shortcut.** `myapp://listing/123` can raise an "Open in <App>?" system dialog and never navigate. Tap through the UI.

## macOS shell note

`timeout` does not exist on stock macOS. `timeout 120 maestro test …` fails with `command not found` and your command **never runs** — while the surrounding pipeline still reports success. Use the harness's own timeout, or `gtimeout` from coreutils.

## Capture at native resolution

The plugin ships two scripts. Capture re-applies the clean status bar (it resets on every app launch):

```bash
./scripts/sim-capture.sh <UDID> raw/<screen>.png phone   # or: pad
```

`sim-capture.sh` calls `sim-clean-statusbar.sh`, which forces **9:41 + full battery (discharging 100%, NOT "charged" — "charged" draws a lightning bolt) + full signal**, then `xcrun simctl io screenshot`, and prints the pixel size so you can confirm it matches a store slot.

**Pick a simulator that yields the required raw size.** Apple's 6.9" slot is **1320×2868** — capture on an **iPhone 16 Pro Max / 17 Pro Max**. Most other simulators don't match (e.g. iPhone 15 sim = 1179×2556), so framing them produces wrong-size output you'll only catch at upload. The iPad 13" slot (2064×2752) comes from an iPad Pro 13".

## Android emulator captures

No `simctl` equivalent — use `adb` plus SystemUI demo mode.

```bash
adb exec-out screencap -p > raw/<screen>.png          # 1080x2400 on a stock AVD

# clean status bar (once per boot; survives app restarts, unlike the iOS override)
adb shell settings put global sysui_demo_allowed 1
adb shell 'am broadcast -a com.android.systemui.demo -e command enter'
adb shell 'am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941'
adb shell 'am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false'
adb shell 'am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4'
adb shell 'am broadcast -a com.android.systemui.demo -e command network -e mobile hide'
adb shell 'am broadcast -a com.android.systemui.demo -e command notifications -e visible false'
```

- **Quote the whole `am broadcast`.** Unquoted, the shell word-splits `-e` pairs and the flags reach `adb` instead of the device.
- `-e datatype none` still renders "3G"; use `-e mobile hide` to drop the cellular block entirely.
- A persistent notification icon (the ⓘ) can survive `notifications visible false`. Decide early whether you accept it — then keep it **identical across the whole set**.
- **Pick the demo state before the first capture.** Changing it halfway means re-capturing everything for consistency; two shots with different status bars is the kind of thing a reviewer notices and you don't.

**Pointing a debug APK at a custom Metro** (e.g. a prod-env Metro on :8082, so shots show real data):

```bash
adb shell "run-as <pkg> sh -c 'mkdir -p shared_prefs; cat > shared_prefs/<pkg>_preferences.xml' <<'XML'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map><string name=\"debug_http_host\">10.0.2.2:8082</string></map>
XML"
```

`10.0.2.2` is the host loopback as seen from the emulator. Wrap the **entire** `run-as` payload in one outer quote — splitting it loses the inner quoting and silently writes nothing.

**Android-specific traps:**

- **A stale embedded bundle looks like a working app.** If Metro logs no Android request but the app renders, you're seeing the APK's baked-in bundle — old copy, old data. Confirm by watching Metro, not by looking at the screen.
- **ANR dialogs on dev-bundle reload.** "<App> isn't responding" after a cold start is normal for a large debug bundle; tap **Wait** and allow ~60s before touching the UI. Screenshotting through it captures the dialog.
- **Edge-to-edge status bar quirks.** Screens with a native stack header (`headerShown: true`) may render no status bar content at all while tab screens render it fine. Verify per screen; it's an app-level defect, not an emulator one, and it will show up as dead space inside the device frame.
- **Number/date formatting diverges from iOS.** Hermes ships no CLDR data for most non-`en` locales, so Android falls back to en-US grouping (`41,727`) while iOS renders `41.727`. Each platform's set stays internally consistent, so this is invisible unless you compare — flag it, don't silently ship two different-looking sets.

## Gated features need a real entitled account

The screens most worth marketing — the ones with the paid intelligence in them — are usually exactly the ones behind the paywall. At free tier they render an explanatory "we can't show this" card, which is *correct app behavior* and a **terrible** screenshot.

1. Create a real account with the entitlement granted server-side (never a client flag — see the no-purchase-surface rule).
2. Sign **every** device into it before capturing gated screens.
3. Expect a stale `/me` right after login: the plan chip may still read free until an app relaunch forces a refetch. Relaunch and re-verify before capturing.
4. **Signing in swaps server-backed state.** Favorites, saved searches and history belong to the *account*, not the device — anything you seeded anonymously vanishes on login. Re-seed after signing in, then capture. (Classic: favorites captured pre-login, then the account switch empties them and the next capture is the empty state.)
5. Tell `writing-store-listings` the credentials exist. A listing that says "no login required" while the marketed screens need one is a review rejection.

## Gotchas — no dev chrome in shots (hard rules)

- **Expo dev-launcher floating gear.** Open the dev menu, turn **OFF "Tools button"** so the gear stops overlaying every screen.
- **In-app `__DEV__` UI** (quick-login chips, debug panels). Temporarily gate it off in code (`{false && __DEV__ && …}`), capture the clean screen, then **REVERT the edit**. Do not ship the gate.
- **Fresh bundle.** After editing JS, terminate + relaunch the app (or tap the Metro server entry in the dev launcher) so the new bundle loads — a relaunch alone may serve the old one.
- **Onboarding tours.** Dismiss tour overlays / coachmarks before capturing.
- **Empty states.** Skip sparse screens; seed first and pick the richest entity for any detail screen. A list screen with one row is barely better than zero — seed 3+ so the screen reads as *used*.
- **Consistent appearance.** Capture the whole set in one appearance (light or dark) — the stores show one set regardless of the viewer's theme. Don't mix.
- **Scroll position is part of the shot.** A capture taken mid-scroll leads with a sliver of a cut-off card and looks broken once framed. Scroll so a whole section starts near the top.
- **Source changing under you.** If someone lands a copy/label change mid-session, every raw taken before it is now inconsistent with the ones after. Re-capture the whole set from one bundle; don't mix.

## Verify every raw before framing

Non-negotiable, and cheap: **look at each PNG**. The capture pipeline's definition of success is "a file was written", which is satisfied equally by a hero shot, an error state, and a login wall. Check per raw:

- pixel size matches the store slot (`sips -g pixelWidth -g pixelHeight`)
- the screen is *populated*, not an empty/error/skeleton state
- the status bar matches the rest of the set
- the data is real and non-embarrassing (no lorem, no test rows, no stale counts)
- the right account is signed in (gated content actually rendered)

## Output

Save raws as `raw/<screen-key>.png` so the keys line up with your `frames.config.json` `order`, then hand off to `framing-store-screenshots`.
