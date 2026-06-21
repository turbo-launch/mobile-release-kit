---
name: capturing-store-screenshots-live
description: >-
  Use when store screenshots need REAL native captures from iOS Simulators — especially the live gameplay / hero screen of a real-time or multiplayer app that needs more than one actor on screen, or when pixel-perfect native chrome matters. Trigger on "live gameplay screenshot", "multiplayer / real-time hero shot", "capture from the simulator", "native screenshots", "the answer-grid / leaderboard / lobby screen", "two-device flow". Keywords: simctl, simulator, status bar, dev launcher, PIN, host, participant, native capture.
---

# Capturing store screenshots from a live simulator

Use this when the strongest screenshot is the **real in-app moment** — live gameplay, a leaderboard mid-round, a session lobby — which often needs two actors (a host and a participant). For static screens with no live state, `capturing-store-screenshots-web` is faster. Frame the output with `framing-store-screenshots`.

## Two-simulator host + participant workflow

A real-time screen needs the other side to exist. Drive two simulators at once.

1. **List + boot.** `xcrun simctl list devices` → pick two UDIDs (e.g. an iPhone 6.9" and any second device). `xcrun simctl boot <UDID>`; `open -a Simulator`.
2. **Install a sim-runnable build from source** on each: `bun expo run:ios --device <UDID>`. A store `.ipa` is device-only and will **not** run on a simulator.
3. **Host side:** drive the host app to launch a session → it shows a PIN / join code.
4. **Participant side:** join by that PIN. Capture the participant's screen for the hero (it's the experience most users see).
5. **Advance phases on the host** (start → question → reveal → leaderboard) and capture the participant at each beat.

Drive the UI with the `mobile-mcp` tools: `mobile_list_elements_on_screen` (coordinates come from here, **not** from the screenshot pixels), `mobile_click_on_screen_at_coordinates`, `mobile_swipe_on_screen`.

## Capture at native resolution

The plugin ships two scripts. Capture re-applies the clean status bar (it resets on every app launch):

```bash
./scripts/sim-capture.sh <UDID> raw/<screen>.png phone   # or: pad
```

`sim-capture.sh` calls `sim-clean-statusbar.sh`, which forces **9:41 + full battery (discharging 100%, NOT "charged" — "charged" draws a lightning bolt) + full signal**, then `xcrun simctl io screenshot`, and prints the pixel size so you can confirm it matches a store slot.

## Gotchas — no dev chrome in shots (hard rules)

- **Expo dev-launcher floating gear.** Open the dev menu, turn **OFF "Tools button"** so the gear stops overlaying every screen.
- **In-app `__DEV__` UI** (quick-login chips, debug panels). Temporarily gate it off in code (`{false && __DEV__ && …}`), capture the clean screen, then **REVERT the edit**. Do not ship the gate.
- **Fresh bundle.** After editing JS, terminate + relaunch the app (or tap the Metro server entry in the dev launcher) so the new bundle loads — a relaunch alone may serve the old one.
- **Onboarding tours.** Dismiss tour overlays / coachmarks before capturing.
- **Empty states.** Skip sparse screens; seed first and pick the richest entity for any detail screen.

## Output

Save raws as `raw/<screen-key>.png` so the keys line up with your `frames.config.json` `order`, then hand off to `framing-store-screenshots`.
