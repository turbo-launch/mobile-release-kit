---
name: capturing-what-you-learned
description: >-
  Use when a mobile release or debugging session just produced a lesson worth keeping — a failure that took hours to diagnose, a silent gotcha, a step that is not written down anywhere. Decides whether it belongs in this shared plugin or in the one project, and writes it to the right place. Trigger on "we just fixed", "that was the problem", "remember this for next time", "add this to the kit", "capture this lesson", "write this down", "why did that take so long", and at the end of a release. Keywords: lesson, postmortem, gotcha, retro, document this, add to the plugin, kit, lessons.md, knowledge capture, don't rediscover.
---

# Capturing what you learned

A mobile lesson is worth roughly what it cost to learn, and it evaporates within a day. This
skill spends five minutes writing it where it will be found again.

**The failure this prevents is specific.** Knowledge earned in one app gets hand-copied into
the next, and the next — until there are seven versions of the same document, all slightly
different, and a fix applied to one reaches none of the others. Copying is the anti-pattern.
Everything below exists to route a lesson to exactly one home.

## 1. Apply the layer test

> **Would this be true in a different Expo app, with different identifiers?**

| Answer | Home | Why |
|---|---|---|
| **Yes** | this plugin | every project gets it at once |
| **No** | that project's `ops/mobile-releases/README.md` (under its docs) | it is a fact about one app |
| **Unsure** | **ask the user** | see below |

When genuinely unsure, keep it local. Wrongly promoting a project quirk into a shared plugin
is the more expensive mistake, because every other project then follows it as if it were
general. Local knowledge can be promoted later; a bad shared rule has to be found first.

Two clarifiers that resolve most hard cases:

- **Strip the identifiers.** If the lesson survives replacing `com.acme.app`, the host name
  and the directory layout with placeholders and still says something, it is general.
- **Would a stranger shipping their first Expo app hit this?** If yes it is general, even if
  you hit it in one specific app.

## 2. Write it where it goes

### General — into the plugin

Two places, and usually both:

1. **`docs/lessons.md`** — the narrative. House style, in this order:

   ```markdown
   ## <The rule, stated as a claim>

   What actually happened, in two or three sentences. What it looked like while it was
   happening — which is what makes it recognisable next time. What it cost.

   **Rule:** the thing to do differently, imperative.

   **Corollary:** (optional) the second-order trap.

   → `the-skill-that-states-it`
   ```

   Write the *symptom*, not just the cause. Someone hitting this again will search for what
   they are seeing, not for the explanation they do not have yet.

2. **The relevant `SKILL.md`** — the operative rule, so it fires without anyone reading
   `lessons.md`. A lesson only in `lessons.md` is a lesson nobody will be told at the moment
   they need it. Match the surrounding density: bold the rule, keep the command runnable.

If the lesson is a *check* rather than a fact, prefer making it executable — a flag on
`scripts/verify-release-artifact.sh`, a line in a template — over prose. A check that runs
beats a paragraph that is skimmed.

### Project-specific — into the project

Its release README, under the heading it belongs to (identity, credentials, deploy
prerequisites). Keep it to a line or two. If that file is growing past a screen, some of it
is general and should have gone into the plugin.

## 3. Edit the source clone, not the cache

**This is the step that silently wastes the work.** Once installed from a marketplace, the
plugin runs from a *cache*:

```
~/.claude/plugins/cache/<marketplace>/<plugin>/…      ← runtime copy, DISCARDED on update
```

Edits there vanish on the next `/plugin marketplace update`, with no warning. Write to the
git clone, then publish:

```bash
cd <path-to-the-mobile-release-kit-clone>
git status                       # confirm you are in the clone, not the cache
# …edit…
node scripts/validate-kit.js     # manifests + skills + referenced paths must pass
git add -p && git commit
```

If you cannot find the clone, ask — do not edit the cache "for now".

## 4. Check before you publish

The repo is public. Before committing anything to it:

```bash
grep -rniE '<your-org>|<your-app-id>|<real-host>|<personal-email>|\+[0-9]{9,}' \
  --include='*.md' --include='*.sh' --include='*.mjs' --include='*.js' .
```

Replace real identifiers, hosts, emails and phone numbers with placeholders. The *technique*
is the payload; the identifiers are what makes it someone's private business.

**Never push without confirmation.** Stage the commit, show what changed, and let the human
decide — publishing is outward-facing and irreversible in the way that matters.

## 5. Say where it went

End by naming the file and the layer, so the decision is auditable:

> Added to the plugin: `docs/lessons.md` + a rule in `setting-up-push-notifications`.
> Committed, not pushed — say the word.

## Related

- `driving-a-release` — its final step should call this while the release is fresh
- `docs/lessons.md` — the accumulated record, and the tone to match
