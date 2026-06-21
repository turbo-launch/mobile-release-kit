# Announcement kit

Ready-to-paste launch copy. **Run [`PUBLISHING.md`](../PUBLISHING.md) first** — don't
post until the repo is public, CI is green, and every install command you quote
has been tested in a fresh session. Lead every post with the before→after image.
Be honest about scope (macOS-only sim capture; submit is a guided human runbook,
not full automation).

Replace `turbo-launch/mobile-release-kit` everywhere if your repo path differs.

---

## Hacker News — Show HN

**Title** (≤80 chars, no emoji, HN style):
```
Show HN: Mobile Release Kit – frame App Store screenshots and run EAS releases
```

**Body:**
```
I kept re-solving the same friction every time I shipped an Expo/React Native
app: store screenshots at the wrong pixel size, an EAS submit that died on a
service-account permission, a review rejected because the demo login didn't
work, framing that made a decent app look like a template.

So I extracted the parts that are easy to get wrong into a toolkit:

- Capture store screenshots — from live iOS simulators (real gameplay / the
  multiplayer hero screen) or the Expo web bundle (fast static batches).
- Frame raw screenshots into marketing images at exact store sizes. The
  defaults (lead with the peak moment, straight-on device, one consistent
  background, 2-4 word benefit headlines) come from App Store ASO research,
  and it's one JSON config — no per-app code.
- An EAS build/submit runbook with the real gotchas inline (the Play
  service-account permission, the first-release closed-testing gate, the
  1080x2400-is-rejected aspect cap), plus a guided, resumable release that
  tracks state in a checklist you can resume across days.

It's both a Claude Code / Codex / Cursor / Gemini plugin (skills + an MCP
server) and plain Node/Bash scripts you can run in CI — no AI required for the
scripts. MIT.

Honest scope: live simulator capture is macOS-only; the store submit stays a
human runbook (it never runs eas build/submit without confirmation, and never
fabricates Apple/Google IDs).

Repo: https://github.com/turbo-launch/mobile-release-kit
```

> Post Tue–Thu, ~9am ET. Reply to comments fast in the first hour.

---

## Reddit — r/reactnative and r/expo

**Title:**
```
I built a toolkit for App Store / Play Store screenshots + EAS releases (Expo/RN, MIT)
```

**Body:**
```
Shipping to the stores is mostly undocumented friction, so I packaged the parts
I kept getting wrong into one MIT toolkit:

📸 Capture screenshots — live iOS simulator (the real gameplay/hero screen, even
multiplayer two-device flows) or the Expo web bundle for fast static batches.

🖼️ Frame them into marketing images at exact store sizes from one JSON config.
Defaults follow ASO research (peak-moment first, straight-on device, benefit
headlines). It even generates the Play 1024x500 feature graphic.

🚀 EAS release runbook with the gotchas baked in — the Play service-account
permission error, the new-app closed-testing gate, the screenshot aspect-ratio
cap that silently rejects 1080x2400 — plus a resumable checklist that tracks a
multi-day release.

Works as plain Node/Bash scripts (CI-friendly, no AI needed) and as a plugin for
Claude Code / Codex / Cursor / Gemini.

[before → after image]

Repo + docs: https://github.com/turbo-launch/mobile-release-kit

Would love feedback on the framing defaults and any store gotcha I'm missing.
```

> r/expo and r/reactnative have different mods/rules — check each subreddit's
> self-promotion policy; some want a flair or a weekly thread. r/iOSProgramming
> and r/androiddev are secondary targets (lead with the relevant platform there).

---

## X / Bluesky thread

```
1/ Shipping an Expo app to the App Store + Play Store is mostly undocumented
friction. I packaged the parts that are easy to get wrong into an MIT toolkit:
store screenshots, framing, and the EAS release dance. 🧵

[before → after image]

2/ Capture: live iOS simulator (the real gameplay / multiplayer hero screen) or
the Expo web bundle for fast static batches across every device + locale.

3/ Frame: raw screenshots → store marketing images at exact pixel sizes from one
JSON config. Defaults from ASO research — peak moment first, straight-on device,
2-4 word benefit headlines. Generates the Play feature graphic too.

4/ Release: an EAS build/submit runbook with the real gotchas inline (the Play
service-account permission, the first-release closed-testing gate, the aspect
cap that rejects 1080x2400) + a resumable checklist for multi-day releases.

5/ It's plain Node/Bash scripts (CI-friendly) AND a plugin for Claude Code /
Codex / Cursor / Gemini. MIT.

https://github.com/turbo-launch/mobile-release-kit
```

> Tag @expo / @reactnative where appropriate. First post carries the image.

---

## awesome-expo / awesome-react-native — PR

Add under a "Tools" / "Deployment" section:

```markdown
- [Mobile Release Kit](https://github.com/turbo-launch/mobile-release-kit) - Capture and frame App Store / Play Store screenshots and run EAS releases. One JSON config, CI-friendly scripts, and a Claude Code / Codex / Cursor / Gemini plugin. MIT.
```

PR description:
```
Adds Mobile Release Kit — an MIT toolkit for Expo/RN store screenshots
(capture + framing at exact store sizes) and EAS releases (build/submit runbook
with the common gotchas + a resumable checklist). Works as standalone Node/Bash
scripts and as a multi-agent plugin. Following the list's contribution format;
happy to adjust the section/wording.
```

> Target lists: `expo/expo` community lists, `jondot/awesome-react-native`,
> `vintasoftware/awesome-react-native`. Read each list's CONTRIBUTING first.

---

## Cross-agent / AI communities (second, distinct audience)

Because it's also a SKILL.md/AGENTS.md plugin + MCP server, it fits:
- the **agents.md** ecosystem and **agentskills.io** registry,
- Claude Code plugin / MCP server directories,
- a short **dev.to / Hashnode** writeup ("I turned a messy app-release process
  into a cross-agent skill") that doubles as SEO for the gotchas.

Frame it there as "a real, non-trivial skill set + MCP server" rather than just
a screenshot tool — that audience cares about the agent integration.
