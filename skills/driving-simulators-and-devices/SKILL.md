---
name: driving-simulators-and-devices
description: >-
  Use when running an Expo/RN app on an iOS Simulator or Android emulator during development — booting a device, installing and launching a build, resetting app state, scripting taps, and finding out why the app crashed or shows something the code cannot explain. Trigger on "run the app", "boot the simulator", "the app crashed", "app closed itself / disappeared", "nothing in the Metro logs", "reset the app", "tap through the app", "the simulator shows the wrong thing", "stale bundle", "which device for screenshots". Keywords: xcrun simctl, adb, logcat, .ips, DiagnosticReports, Metro, port 8081, expo run:ios, Expo Go, Maestro, testID, status bar, uninstall, persisted cache, cold launch.
---

# Driving simulators and devices

The commands behind the daily loop, and the two places a failure hides: a native crash that
never reaches Metro, and a Metro that isn't the one you started.

Substitute your own app identifier (`com.example.app`) and mobile directory throughout —
this skill never assumes where they live. If the project has a
release README (`ops/mobile-releases/README.md` under its docs), it names both.

## The daily loop

**Always `expo run:*`, never `expo start --ios`.** The latter opens Expo Go, which cannot
load native modules — sign-in, notifications, secure storage. If the app uses any, Expo Go
is not a shortcut, it is a *different app* that will mislead you about what works.

```bash
bun run ios          # native build + install + launch, attaches to Metro
bun run android
bun run start        # Metro alone
```

## Two crash surfaces, and they do not overlap

| Symptom | Where it shows | How to read it |
|---|---|---|
| JS exception | Metro's stream | `bun run start`, or tee to a log and `tail -f` |
| Native crash (bad TurboModule, nil in a native SDK) | **nowhere in Metro** | `.ips` on iOS · `adb logcat` on Android |

A native crash kills the process silently from JS's point of view. **If the app vanishes and
Metro says nothing, stop reading Metro** — you are looking at the wrong surface, and no
amount of JS logging will ever show it.

```bash
# newest iOS crash report
cat "$(ls -t ~/Library/Logs/DiagnosticReports/<AppName>-*.ips | head -1)"

# Android, filtered to this app's process
adb logcat --pid=$(adb shell pidof -s com.example.app)
```

## Something on :8081 you didn't start

`expo run:ios` **reuses** whatever already listens on 8081 rather than starting its own
Metro. A forgotten instance from another checkout or git worktree will silently serve your
app — you debug code that isn't running.

Before debugging anything the code cannot explain:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN          # who owns it
lsof -a -p <pid> -d cwd -Fn               # from which directory
```

## Driving the simulator (`xcrun simctl`)

`simctl` is the whole iOS toolbox. (Not `xctool` — that is Facebook's long-dead `xcodebuild`
wrapper, unrelated and unmaintained. If a doc or an old answer tells you to install it, the
doc is stale.)

```bash
xcrun simctl list devices available                    # names + UDIDs
xcrun simctl boot "iPhone 17 Pro Max"; open -a Simulator
xcrun simctl install   booted /path/to/App.app
xcrun simctl launch    booted com.example.app
xcrun simctl terminate booted com.example.app
xcrun simctl io booted screenshot /tmp/shot.png
xcrun simctl ui booted appearance dark                 # light | dark
xcrun simctl openurl booted "myscheme://path"          # deep links
```

**Resetting app state — uninstall is the only reliable way.** It clears SecureStore,
AsyncStorage and any persisted React Query cache:

```bash
xcrun simctl uninstall booted com.example.app
adb uninstall com.example.app
```

Do this after every backend change. A persisted query cache (`persistQueryClient`, often
24h) makes a **dead backend look like a live one** — the app renders yesterday's data while
every request fails. Correct production behaviour for warm starts; a menace while testing.

**Trust only a cold launch for layout.** Fast Refresh keeps mounted component state and
stale style objects, so a layout fix can look applied when it isn't, and vice versa. When
verifying anything visual: uninstall, install, launch.

## Picking the device for store screenshots

Output pixels must match the store slot exactly, and most simulators don't:

| Slot | Pixels | Device |
|---|---|---|
| iPhone 6.9" (App Store requires it) | 1320×2868 | iPhone 16/17 **Pro Max** |
| iPad 13" (only if `supportsTablet`) | 2064×2752 | iPad Pro 13" |
| Play phone | 1080×1920 output | any 1080-wide AVD — Play rejects aspect > 2:1, so 1080×2400 raws are inputs only |

A plain iPhone 17 is **not** 6.9". Check every capture: `sips -g pixelWidth -g pixelHeight shot.png`.

Clean the status bar before capturing (9:41, full bars, full battery):

```bash
xcrun simctl status_bar booted override \
  --time "9:41" --cellularBars 4 --wifiBars 3 --batteryState charged --batteryLevel 100
```

The kit automates both of these — see `capturing-store-screenshots-live` and
`scripts/sim-clean-statusbar.sh`.

**Android equivalents:**

```bash
"$ANDROID_HOME/emulator/emulator" -list-avds
adb exec-out screencap -p > /tmp/shot.png
```

## Driving the UI (Maestro)

For anything beyond one screen, script the navigation. Maestro works on both platforms and
needs no test target inside the native project — which matters, because `ios/` and
`android/` are `expo prebuild` output and get regenerated.

```bash
maestro --device <UDID> test flow.yaml
maestro --device <UDID> test -e KEY=value flow.yaml   # -e goes AFTER `test`
```

```yaml
appId: com.example.app
---
- tapOn: { id: "tab-settings" }      # testID — stable
- tapOn: { point: "220,196" }        # points, = pixels / device scale
- inputText: ${EMAIL}
- eraseText: 30                      # bare `eraseText` clears only part
- tapOn: { point: "220,430" }        # tap empty space to dismiss; a numeric keypad
- waitForAnimationToEnd              #   has no return key and `hideKeyboard` fails
```

**Prefer `testID` over coordinates.** Coordinates are in points, break on a different
device, and cost a screenshot-and-correct cycle every time you guess. Add a `testID` to
anything you will want to drive later.

> **fastlane `snapshot` is a poor fit for Expo.** It needs an XCUITest target inside `ios/`,
> which `expo prebuild` regenerates — you would need a config plugin just to keep it alive.
> Its real value is a locale × device matrix; with one locale and one phone slot that is
> five captures, and it still would not do the framing step. Use the kit's capture skills.

## Related

- `capturing-store-screenshots-live` — turning these commands into a store-ready capture run
- `configuring-expo-env` — when the app runs but reaches nothing
- `setting-up-push-notifications` — when the device registers no token
