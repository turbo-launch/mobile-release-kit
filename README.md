# Mobile Release Kit

Ship an **Expo / React Native** app to the **App Store** and **Google Play** without rediscovering every trap along the way.

This is a [Claude Code](https://code.claude.com) plugin **and** a set of standalone CLI scripts. It packages a complete store-release pipeline:

- **Capture** store screenshots — from live iOS Simulators (real gameplay / multiplayer hero screens) *or* from the Expo web bundle in headless Chromium (fast static batches).
- **Frame** raw screenshots into deliberate, conversion-oriented marketing images — brand background + benefit headline + device chassis — driven by one config file, rendered at exact store pixel sizes for iPhone, iPad, and Android phone + tablet.
- **Release** with EAS — a build → submit → review runbook with the real gotchas baked in (service-account permissions, version mismatches, demo-credential rejections, gitignored binaries).

It was extracted from a shipped Kahoot-style education app, then generalized. The opinionated design defaults come from App Store ASO research, not guesswork.

---

## Install (as a Claude Code plugin)

```
/plugin marketplace add turbo-launch/mobile-release-kit
/plugin install mobile-release-kit@turbo-launch
```

Then, in any Expo project:

```
/mobile-release-kit:frame-screenshots <rawDir> <outDir> iphone-6.9
/mobile-release-kit:release ios
```

…or just describe the goal ("capture store screenshots and frame them", "ship this to TestFlight") and the **release-orchestrator** agent will pick the right skills.

### What you get

| Component | Name | What it does |
|-----------|------|--------------|
| Skill | `framing-store-screenshots` | Render raw screenshots into framed marketing images |
| Skill | `capturing-store-screenshots-live` | Native iOS Simulator capture (live / hero screens) |
| Skill | `capturing-store-screenshots-web` | Expo web-bundle capture (fast static batches) |
| Skill | `releasing-with-eas` | EAS build + submit runbook |
| Skill | `writing-store-listings` | Listing copy + review notes within store limits |
| Command | `/…:frame-screenshots` | One-shot framing of a screenshot dir |
| Command | `/…:release` | Walk the EAS release runbook (stops before billed actions) |
| Agent | `release-orchestrator` | Orchestrates the whole pipeline across the skills |

---

## Use the scripts directly (no Claude Code required)

The renderers are plain Node + [Playwright](https://playwright.dev). They work standalone in any shell or CI.

```bash
# one-time: install a Chromium for Playwright
npm i -D playwright && npx playwright install chromium

# frame a raw screenshot dir into store images (config-driven)
node scripts/frame-screenshots.js frames.config.json ./raw ./out iphone-6.9
node scripts/frame-screenshots.js frames.config.json ./raw ./out ipad-13
node scripts/frame-screenshots.js frames.config.json ./raw ./out android-phone

# tile a set into one review image
node scripts/contact-sheet.js ./out ./contact-sheet.png 5
```

In a Bun/Expo monorepo that already has Playwright, skip the install and reuse it:

```bash
NODE_PATH=./node_modules node scripts/frame-screenshots.js frames.config.json ./raw ./out iphone-6.9
```

Capture from a booted simulator (re-applies the clean 9:41 status bar each time):

```bash
xcrun simctl list devices booted          # find the UDID
./scripts/sim-capture.sh <UDID> raw/home.png phone
```

Copy [`templates/frames.config.json`](templates/frames.config.json) and edit the palette, per-screen `eyebrow`/`head` copy, and `order` for your app. Frame 1 should be your most exciting screen.

---

## Repository layout

```
mobile-release-kit/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest
│   └── marketplace.json     # marketplace catalog (install via this repo)
├── skills/                  # the five release skills
├── commands/                # /frame-screenshots, /release
├── agents/                  # release-orchestrator
├── hooks/                   # safety guard (warns before committing build artifacts)
├── scripts/                 # frame-screenshots.js, contact-sheet.js, sim-capture.sh, …
├── templates/               # frames.config.json, eas.json, listing + runbook templates
└── docs/                    # release-tree convention, store specs
```

---

## Design opinions (why the frames look the way they do)

The framing defaults encode what actually converts on the stores:

- **Lead with the peak moment.** Frame 1 is the live/most-exciting screen, never a calm dashboard, splash, or settings page. The first three frames carry most of the install decision.
- **Straight-on device.** The 3D-tilted phone reads dated; tilt is opt-in.
- **One background system, hottest hero.** Keep a consistent palette across the set, but make the hero frame the most saturated.
- **Benefit headlines, 2–4 words.** Plus an optional energy "pop" chip (a big number / rank / %) on the competitive frames.

See [`docs/store-specs.md`](docs/store-specs.md) for the exact pixel sizes and listing limits, and [`docs/release-tree.md`](docs/release-tree.md) for organizing release artifacts per version.

---

## License

[MIT](LICENSE).
