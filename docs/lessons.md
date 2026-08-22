# Lessons

Mistakes made shipping real Expo apps to the App Store and Play, and the rules that came out
of them. The skills state the rules; this file is the *why*, which is what makes a rule
survive contact with a deadline.

The theme running through all of them: **a mobile build fails silently.** It compiles, signs,
installs, launches, and is simply missing a feature. Nothing in `eas build` knows what the
app was supposed to do.

## A binary that reads a new server field must ship after that field deploys

An app placed a paywall boundary using a field the API had only just gained. The binary was
built first. It compiled, installed and ran — and the entire paywall silently disappeared,
because the field came back `undefined` and the `?? null` fallback read as "no boundary".
The build was green. The app looked fine. The gate was gone.

This is worse than a crash. A crash is reported; this ships and nobody notices until revenue
is wrong.

**Rule:** when a release depends on a backend change, deploy the backend first and *verify
against production* before building. Put the check in the runbook as a command, not a
sentence: `curl -s "https://<api>/<endpoint>" | grep -q '<new_field>' && echo OK`

**Corollary:** record the prereq in `CHANGELOG.md` next to the build number, and mark any
binary built before that deploy as *superseded — do not submit*. Build artifacts outlive
memory, and the bad one looks exactly like the good one.

→ `releasing-with-eas`

## Hermes stores non-ASCII as UTF-16, so grep lies about your translations

Verifying that a release bundle contained localized copy, four separate strings came back
absent. All four were present. Every *ASCII* string matched; every string with an accented
letter did not. Hermes keeps non-ASCII in its string table as UTF-16, so a UTF-8 `grep`
cannot find it.

This nearly caused a good build to be thrown away and rebuilt.

**Rule:** `grep -a` is necessary but not sufficient. To check non-ASCII copy, search the
UTF-16 encoding — `scripts/verify-release-artifact.sh` does this automatically via
`--string`.

**Corollary:** plain `grep -c` (no `-a`) returns 0 on binary input whether the string is
there or not — BSD grep short-circuits. **A check that cannot fail is worse than no check**,
because it is recorded as a pass.

→ `configuring-expo-env`, `releasing-with-eas`

## `EXPO_PUBLIC_*` inlines only by static substitution

A shipped build had no backend URL in it at all. The config helper read
`process.env[key]`, and `babel-preset-expo` substitutes `EXPO_PUBLIC_*` **statically** — a
computed access inlines nothing. Development hid it completely, because Metro populates
`process.env` at runtime. The failure exists only in a release binary, and presents as an app
that launches and reaches nothing.

**Rule:** every read must be a literal `process.env.EXPO_PUBLIC_NAME` member expression. No
destructuring, no `process.env[key]`, no `getEnv(name)` helper.

**Corollary:** gate the upload on an artifact check, not on the build succeeding. Read the
*pair* — value present, variable name absent.

→ `configuring-expo-env`

## `.env.local` reaches a local build but not a cloud one

Mid-session an app was pointed at a LAN IP for device testing. A production build ran later
with that file still in place. EAS **cloud** builds ship a git archive, so a gitignored
`.env.local` never reaches them — but `--local` builds read the working directory, and
Expo's dotenv precedence puts `.env.local` *above* `.env`. A LAN address can be baked into a
signed store artifact.

**Rule:** move `.env.local` aside before any release build, and assert against the artifact
afterwards — `--absent '192.168'` must pass.

→ `configuring-expo-env`

## A fixed `--output` path silently destroys the previous artifact

`build --local --output build-<version>.ipa` run twice overwrites the first artifact with no
prompt. Worse, `appVersionSource: remote` had already auto-incremented the build number, so
the replaced binary was unrecoverable — and had it been uploaded, a stale build would sit in
TestFlight looking identical to the good one.

**Rule:** before building, check whether the artifact exists and who made it. If one does,
say so and get agreement before overwriting — it is somebody's signed, numbered,
possibly-uploaded binary, not a scratch file.

→ `releasing-with-eas`

## Android push needs a file *inside the binary*; iOS does not

Push worked on iOS and silently did nothing on Android, repeatedly, across projects. Both
credentials live server-side in EAS — but Android additionally needs `google-services.json`
**bundled in the artifact**, without which `expo-notifications` can never obtain an FCM
token. Because iOS push is entirely server-side, it is natural to conclude Android is too.
Uploading the Android credential to EAS afterwards changes nothing until you rebuild.

**Rule:** treat "no notifications" as "no token" until proven otherwise, and verify the
binary carries the config: `unzip -l build.aab | grep -i google-services`.

**Corollary:** the *Legacy* FCM slot in `eas credentials` is dead — Google retired the legacy
HTTP API in June 2024. Uploading there appears to succeed and delivers nothing.

→ `setting-up-push-notifications`

## Screenshots are the most stale artifact you ship

Store screenshots predated a tab-bar change, a number-formatting fix and two new card lines.
They advertised an app that no longer existed. Nothing flags this: screenshots live in a docs
folder and never fail a build.

More useful than the fix: **recapturing found four real bugs** that the type checker, the
linter, the test suite and manual simulator testing had all missed — untranslated data
values, a tofu-box glyph, a field never passed through the translation helper, and a crop
tuned to a layout that had changed.

**Rule:** recapture every release, and treat capture as a test pass, not a chore. Walking
every screen with fresh eyes is the only step that looks at what the user actually sees.

**Corollary:** if features are gated behind a paid tier, capture signed in as the review
account. Otherwise the screenshots advertise the locked state.

→ `capturing-store-screenshots-live`, `capturing-store-screenshots-web`

## Bundled fonts carry no emoji — draw icons instead

A 🔒 in a `<Text>` rendered as a tofu box on device. Bundled faces have no emoji glyphs, and
React Native does not fall back to the system emoji font inside a styled `Text`. It shipped
to a screenshot before anyone noticed.

Symbols that *are* in most faces — `♡ ♥ ⇄ ◈ ▦ ✓` — render fine. Emoji and Dingbats
(`✈` U+2708) do not.

**Rule:** never put an emoji in app UI text. Draw it with `react-native-svg`, which also gets
you theme-aware colour for free.

## App Store Connect counts characters, not bytes

Listing copy in a language with multibyte letters passes any byte-length check and is then
rejected by ASC, which counts characters.

**Rule:** validate with `[...str].length`, never `Buffer.byteLength` or `wc -c`. Limits:
name 30, subtitle 30, promotional text 170, keywords 100, description 4000.

→ `writing-store-listings`, `publishing-listings-with-fastlane`

## The bundle identifier is permanent

Once a build is uploaded to ASC the bundle ID is locked forever; on Play the `applicationId`
locks once the app exists on any track. Changing either means a new listing — new URL, zero
ratings, zero install history. The Android upload keystore is likewise unrecoverable.

**Rule:** when an identifier mismatch appears, fix the *configuration*, not the identifier. A
native Sign in with Apple token's `aud` is the **bundle ID**; the web flow's is a **Services
ID**. Both belong in the server's allowed-audience list — that list is the thing to change.

## An auth endpoint that only says "invalid" cannot be debugged

Sign-in failed in production with `Bad Request` and nothing else. The same response covered
three unrelated causes: provider not configured, wrong audience, expired token. Diagnosis
took hours of elimination.

Adding one log line — the token's *unverified* `aud`/`iss`/`kid` beside the audiences the
server accepts — named the cause on the next attempt.

**Rule:** on any token-verification failure, log what you got and what you expected. Read the
unverified claims purely for the message, never for a decision, and never log the token
itself — it is a bearer credential.

## Generated store metadata holds secrets — gitignore it

fastlane `deliver` wants one file per listing field, including
`review_information/demo_password.txt`. Generating that tree from the release doc keeps the
copy in one place; it also means a real password now sits on disk.

**Rule:** generate the metadata tree, never hand-maintain it, and gitignore the output
directory. Keep `REPLACE_WITH_*` markers in the tracked source and make the generator **exit
non-zero** if one survives — shipping a placeholder to a store is worse than failing the
command.

→ `publishing-listings-with-fastlane`

## A stale Metro on :8081 serves the wrong bundle without saying so

A dev client kept showing an error from a git worktree nobody was working in. `expo run:ios`
reuses whatever already listens on 8081 rather than starting its own, so a forgotten Metro
from another checkout silently served the app.

**Rule:** if the simulator shows something the code cannot explain, check what owns 8081
(`lsof -nP -iTCP:8081 -sTCP:LISTEN`) before debugging the code. Reset the app (`uninstall`,
which also clears the persisted query cache) rather than trusting a reload — a persisted
cache makes a dead backend look like a live one.

→ `driving-simulators-and-devices`
