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

## A var living only in `.env` builds fine on your machine and nowhere else

An app kept its iOS Google client ID and URL scheme only in the gitignored `.env`. Release
builds were correct for months — because production loads **both** `.env.production` and
`.env`, so the developer's own machine filled the gap. On any other machine, or in CI, those
two variables simply vanished and the build baked the placeholder
`com.googleusercontent.apps.placeholder` into `Info.plist`: a signed artifact whose Google
Sign-In cannot work, from a completely green build.

The precedence is worth stating exactly, because "`.env` overrides `.env.production`" is the
intuition and it is backwards:

| Mode | Loads | Wins |
|---|---|---|
| `NODE_ENV=production` | `.env.production` **then** `.env` | `.env.production`, per variable |
| dev / default | `.env` only | — `.env.production` is never read |

**Rule:** every variable a release build needs belongs in the *committed* env file. Treat the
gitignored one as dev-only overrides, never as the sole home of anything.

**Corollary:** ask the tooling instead of guessing. `NODE_ENV=production expo config --type
public` prints an `env: load …` line naming the files in precedence order, and the resolved
config underneath — the whole question answered in two seconds, no build required.

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

## "Not published" and "I could not read the identifier" must not print the same

`mobile-projects` reported an app as `not in AZ` when it was live on the App Store under
that exact storefront. The store lookup was fine; the *bundle ID* was never read. The app
declared `bundleIdentifier: IOS_BUNDLE_IDENTIFIER` — a const, not a string literal — so the
literal-only reader returned null, and a null identifier rendered identically to a confirmed
absence. The tool was reporting a fact about itself as a fact about the App Store.

**Rule:** when a lookup never ran, say so (`no bundle id`) rather than reporting the empty
result. An unqueried app must never read as unpublished — that is the same invented answer
the version column already refuses to give.

**Corollary:** a literal-only regex over a dynamic `app.config.ts` misses the very common
`key: SOME_CONST` shape. Resolve one level of const reference; leave genuinely computed
values null.

→ `mobile-projects` / `scripts/lib/expo-project.mjs`

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


## A persisted cache written by the old build is input to the new build's code

An update crashed on launch, every launch, and only deleting the app recovered it. The
backend saw exactly one request — `GET /me`, 200 — and nothing after. That single request is
the whole diagnosis: the auth bootstrap completed, then the first screen died during render,
before any query could fire.

The previous version had persisted its filter state (client-owned UI state parked in the
React Query cache under a synthetic key — permanently `status: 'success'` because it has
`initialData`, so `shouldDehydrateQuery` wrote it as though it were a server read). The new
version's code read a field that state never had, and `undefined.length` threw out of a
component on the home screen. A red box in development. A dead process in release.

**A fresh install cannot reproduce this**, which is why it survived a full verification pass
on both platforms. Every check had run after an `uninstall`, so every check ran against empty
storage and never once exercised rehydration.

**Rule:** version-key any persisted client cache, so a cache written by a different build is
discarded instead of being trusted. With `persistQueryClient` that is one line, and it costs
one cold fetch per update rather than a crash loop:

```ts
persistQueryClient({ queryClient, persister, buster: `v${Constants.expoConfig?.version}` })
```

Read the version from the app config, never `process.env` — the same value the artifact
gate reads back out of the binary.

**Corollary:** persist *server reads only*. Client UI state in the cache is a cross-version
migration surface you did not mean to create; exclude it from `shouldDehydrateQuery`. And
read defensively where the shape is rehydrated (`{ ...DEFAULTS, ...persisted }`) — three
cheap layers, one root cause.

**Corollary:** an upgrade is a distinct test from an install. Before calling a release
verified, install the *previous shipped artifact*, use it enough to write its caches, then
install the new build over it and cold-launch. Cheap substitute when the old build is awkward
to get: terminate the app and edit the simulator's AsyncStorage to the old shape —
`.../Data/Application/<id>/Library/Application Support/<bundle-id>/RCTAsyncLocalStorage_V1/<hash>`.

→ `driving-simulators-and-devices`, `releasing-with-eas`

## A review submission is a basket, and "Add for Review" makes a *new* one

An app with its first in-app purchase was rejected 2.1(b) — *"the app includes references to
purchases but the associated In-App Purchase products have not been submitted for review."*
The fix is to submit the IAP together with the version. A draft submission was created, the
subscription added to it — and then **Add for Review** was pressed on the app version page.
That did not add the version to the open draft. It created a second submission containing
only the app, and sent it. The draft with the subscription sat there, `submitted=None`, while
the app went to review alone for the third time.

Nothing in the UI says this. The version page's **In-App Purchases and Subscriptions**
section is now read-only explanatory text with nothing to tick, and the version shows a
cheerful *Waiting for Review*. The submission list is the only place the truth appears, in a
column nobody reads: every failed attempt says **1 Item**.

Recovery is worse than the mistake. Removing the version from review sets it
`DEVELOPER_REJECTED`, which **greys out Add for Review** — so the UI now offers no way to put
the version into the draft at all. The API does:

```
POST /v1/reviewSubmissionItems
{"data":{"type":"reviewSubmissionItems","relationships":{
  "reviewSubmission":{"data":{"type":"reviewSubmissions","id":"<draft-id>"}},
  "appStoreVersion":{"data":{"type":"appStoreVersions","id":"<version-id>"}}}}}
```

And the queue cost is not theoretical: on this app a submission sat in *Waiting for Review*
for **twelve days**, and only moved when the developer wrote to App Review — who then
rejected it in two hours. A withdraw-and-resubmit is a two-week decision.

**Rule:** build the submission in the **draft**, add every item to it, and submit once from
there. Never press *Add for Review* on the version page while a draft is open — it silently
forks a second submission. Before submitting, confirm the item count matches what you
intend; **1 Item on an app that sells anything is the bug.**

**Corollary:** adding the subscription **group** is not adding the subscription. The draft
accepts the group, then refuses to submit with *"New subscription groups must be submitted
with an auto-renewable subscription from within that group"* — you must add the
auto-renewable subscription itself, from inside the group.

**Corollary:** verify from the API, not the console. After submitting, the subscription must
read `WAITING_FOR_REVIEW`; if it still reads `READY_TO_SUBMIT` it did not go, and the version
page looks identical either way.

→ `passing-app-review`, `selling-subscriptions`

## `deliver --verify_only` validates a binary, not your listing

Used as the dry run before a metadata push — which is what it looks like, and what this kit
told you to do — it validates nothing you care about. `deliver/runner.rb`:

```ruby
def run
  if options[:verify_only]
    verify_binary
    return          # never reaches upload_metadata
  end
```

It package-validates an `.ipa` and returns. With build artifacts sitting in the app directory
it picks one up and tries to validate an **already-uploaded build**, failing with
*"The bundle version must be higher than the previously uploaded version"* — an error about
a binary you were not pushing, from a command you ran to check your copy.

**Rule:** there is no metadata dry run in `deliver`. Build the check out of the parts that do
work — the metadata generator (character limits, surviving placeholders), a screenshot
dimension check, and `precheck` on its own:

```bash
bunx fastlane precheck --include_in_app_purchases false
```

(`precheck` cannot read IAPs with an API key and errors out if you let it try.)

**Corollary:** pin `app_version` in the `Deliverfile`. Left unset, deliver reads it from
whichever `.ipa` it auto-detected (`detect_values.rb`) — so with several builds lying around
a metadata push can land this release's copy on an **older version record**.

**Corollary:** `__dir__` is not the `Deliverfile`'s directory. fastlane `eval`s that file, and
`__dir__` resolves one level up — so `File.expand_path('../app.json', __dir__)` climbs out of
the app directory and dies on `ENOENT`, and `File.expand_path('metadata', __dir__)` silently
points somewhere that does not exist. Locate the app by searching for `app.json` instead of
trusting `__dir__`.

**Corollary:** `deliver` reports screenshot success it did not have. Its post-upload check
races App Store Connect's processing, decides the still-processing images are *"missing on
App Store Connect"*, re-uploads them, and prints **"Successfully uploaded all screenshots"** —
leaving duplicates, and silently dropping the tail of the set once the 10-image cap is hit.
Count them afterwards rather than trusting the line.

→ `publishing-listings-with-fastlane`
