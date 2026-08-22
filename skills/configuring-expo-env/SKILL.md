---
name: configuring-expo-env
description: >-
  Use when an Expo/RN app's build-time configuration is wrong or absent — the app launches but reaches nothing, an env var is undefined in a release build but fine in dev, a LAN address got baked into a store artifact, or you are deciding which .env file a build will actually read. Trigger on "the app can't reach the backend", "env var is undefined in the build", "works in dev but not in the release", "which .env is used", "EXPO_PUBLIC not working", "wrong API URL in the build", "localhost / 192.168 in the binary". Keywords: EXPO_PUBLIC, babel-preset-expo, static substitution, process.env, dotenv, .env.local, .env.production, eas env, environment, app.config extra, inlining, Metro.
---

# Configuring Expo env

Two mechanisms decide what a build can reach, and both fail **silently and only in a release
binary** — the one build nobody runs before submitting.

## 1. Inlining: `EXPO_PUBLIC_*` is a static substitution, not a lookup

`babel-preset-expo` rewrites literal `process.env.EXPO_PUBLIC_NAME` **member expressions**
at build time. Anything computed is invisible to it and inlines nothing:

```ts
const get = (k: string) => process.env[k] ?? '';      // ← inlines NOTHING
const { EXPO_PUBLIC_API_BASE_URL } = process.env;      // ← also nothing
const name = 'EXPO_PUBLIC_API_BASE_URL';
process.env[name];                                     // ← nothing

baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? ''    // ← the only correct shape
```

**Why this reaches production:** Metro populates `process.env` at runtime, so a dynamic read
works in dev, on a dev client, and in Expo Go. It fails only where `process.env` is empty —
the release bundle. A real release shipped this way with no backend URL at all: it compiled,
signed, installed, launched, and reached nothing.

**Rule: every read is a literal member expression.** No destructuring, no `process.env[key]`,
no `getEnv(name)` helper. If you want a helper, have it take the *value*, not the name:

```ts
export const API_BASE_URL = required(process.env.EXPO_PUBLIC_API_BASE_URL, 'API_BASE_URL');
```

Values not prefixed `EXPO_PUBLIC_` are never inlined at all — they exist only where the
config is evaluated (`app.config.ts`), and reach the app only if you put them in `extra`.

> `EXPO_PUBLIC_*` values are **in the binary and readable by anyone**. Never put a secret
> behind that prefix; there is no client-side hiding place.

## 2. Which `.env` a build actually reads

Expo's dotenv precedence (highest first) is the trap, because it differs by build *route*,
not by profile:

| File | Local build (`--local`, `expo run:*`) | EAS **cloud** build |
|---|---|---|
| `.env.local` | **read** — and outranks `.env` | **never** — gitignored, so it isn't in the uploaded archive |
| `.env.<mode>` | read | only if committed |
| `.env` | read | only if committed |
| `eas env` / profile `environment` | not used | **the real source** |

The failure this produces: mid-session you point the app at a LAN IP for device testing, then
run a production build later with `.env.local` still in place. A cloud build ignores it; a
`--local` build **bakes `192.168.x.x` into a signed store artifact**.

**Rule: move `.env.local` aside before any release build, and assert against the artifact
afterwards.** Not "remember to" — make it a step in the build recipe.

**The files merge per-variable, and the mode file wins — not `.env`.** A production build
loads `.env.<mode>` *and* `.env`; `.env` only fills variables the mode file does not define.
The intuition that the gitignored `.env` overrides everything is backwards, and it hides a
second failure: **a variable that lives only in `.env` still builds correctly on the machine
that has it, and silently vanishes everywhere else** — CI, a colleague, a fresh clone —
baking a placeholder into a signed artifact. Every variable a release needs belongs in the
*committed* env file; treat the gitignored one as dev overrides only.

**Ask the tooling rather than reasoning about precedence.** It prints the answer:

```bash
NODE_ENV=production bunx expo config --type public   # → "env: load .env.production .env"
```

The `env: load` line names the files in precedence order for that exact mode, and the
resolved config follows — no build required. (`--type introspect` goes further and applies
config-plugin mods in memory, which is the cheap way to prove a plugin chain works — that an
entitlement or manifest entry really lands — without running a build.)

**EAS env vars only reach a build whose profile declares an environment.** A profile with no
`"environment"` key silently gets none of them:

```json
"production": { "autoIncrement": true, "channel": "production", "environment": "production" }
```

```bash
eas env:list --environment production
eas env:set --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://api.example.com \
    --visibility plaintext --type string --non-interactive     # env:set upserts; env:create is deprecated
```

> **EAS env vars live only on EAS.** Deleting and re-creating a project takes its whole
> environment with it, and nothing in the repo will tell you. Keep the production values
> recoverable from the tracked `.env` and a small idempotent script that replays them with
> `eas env:set` — `env:set` upserts, so re-running is safe.

## Verify against the artifact, never against the build succeeding

A green build tells you nothing about this. Gate the upload instead — see
the artifact gate in `releasing-with-eas` and `scripts/verify-release-artifact.sh`, which checks every var in
the env file and searches both places a value can land (the JS bundle *and* the Expo
`app.config` asset, since `extra`-delivered values never appear in the bundle).

Read the pair — value present, variable **name** absent:

| value | var name | verdict |
|---|---|---|
| present | absent | inlined correctly — ship it |
| absent | **present** | computed access; the binary has no config |
| absent | absent | env missing at build time — check the profile's `environment` |

Plus the negative assertion, which the script cannot infer:

```bash
grep -ac '192.168' "$BUNDLE"      # expect 0 — a LAN URL from local testing
grep -ac 'localhost' "$BUNDLE"    # expect 0
```

`-a` is mandatory: BSD `grep` short-circuits on binary input and returns 0 whether the string
is present or not. **A check that cannot fail is worse than no check**, because it is
recorded as a pass.

Seconds-long loop instead of a native rebuild, same transform:

```bash
set -a; . ./.env; set +a
bunx expo export --platform ios --output-dir /tmp/envcheck --no-minify
grep -ac '<api host>' /tmp/envcheck/_expo/static/js/ios/*.hbc
```

## Task runners

If the project loads env through a task runner (`just`, `make`, package scripts), the plain
underlying command usually gets **no env at all** and fails in a way that looks like a code
bug. Run the project's own recipe, not the bare tool it wraps. The project's
release README (`ops/mobile-releases/README.md` under its docs) should name which.

## Auditing a codebase that doesn't have this plugin

`docs/prompts/audit-env-inlining.md` is a self-contained, paste-anywhere version of this
audit — it covers the same defect in Vite, Next.js and CRA, where the bundler substitutes
`import.meta.env` / `process.env` the same way and breaks on the same computed access.

## Related

- `releasing-with-eas` — the artifact gate in the release flow
- `driving-simulators-and-devices` — when the app runs but shows stale data (persisted cache, not env)
