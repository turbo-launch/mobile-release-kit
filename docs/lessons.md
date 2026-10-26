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
binary carries the config: `unzip -p build.aab base/resources.pb | grep -ac google_app_id`.

**Corollary:** don't look for the file. The Gradle plugin compiles `google-services.json`
into resources, so `unzip -l build.aab | grep google-services` finds nothing on a good
build. That check once sat in a release checklist, where it could only fail.

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

## The previous release folder is the spec for this one

A release shipped its store screenshots as bare simulator crops. The previous release,
sitting in the sibling directory, had framed marketing images — device chassis, brand
gradient, benefit headline — rendered from a `frames.config.json` that the new release
never got. Nothing failed. The captures were the right size, the upload succeeded, App
Review did not care. The listing simply got quietly worse than the one before it, and
nobody noticed until the version was already `WAITING_FOR_REVIEW` and too expensive to
touch.

The checklist said *capture screenshots*, and that was done. It did not say *to the same
standard as last time*, so the treatment was dropped without ever being a decision.

**Rule:** before capturing anything, **list the previous release folder and diff its
deliverables against your plan**. Every artifact that exists there — framed sets, a
`frames.config.json`, per-locale directories, a feature graphic, a promo video — is
required this release too, unless the user says otherwise. Carry the config forward and
edit it; never start from an empty folder.

```bash
ls -R <releases-dir>/v<previous>/   # this is the spec
```

**Corollary:** the cost is asymmetric and back-loaded. Framing is under an hour of work,
but screenshots on a version already submitted cannot be swapped without withdrawing it —
which surrenders the review queue slot. Getting it right before submission is cheap;
noticing afterwards means shipping the regression or paying days of queue time.

**Corollary:** a listing regression is invisible to every automated check in this kit.
Dimension checks, `precheck` and the metadata generator all pass on an unframed capture.
Only the comparison against last release catches it.

→ `driving-a-release`, `framing-store-screenshots`

## Capture at the frame's aspect and the tablet layout's narrowest width

A release captured Android phones at `360×800` css (20:9) because that is what a phone
is, then framed them into the `1080×1920` (9:16) canvas that Play's 2:1 cap forces. The
framer printed one warning per screen, and the kit said that warning was expected. The
phones came out taller than the frame expected, crowding the headline and set apart from
the iPhone frames. The same release captured tablets at the full `1024` css iPad width.
Framed into the store canvas, the UI text was too small to read.

Both came from sizing the capture to the device. The framer rescales anyway, so only the
raw's *aspect* has to match the frame, and a narrower viewport means bigger text.

**Rule:** size the viewport to the frame. Android phone `360×640` @3. Tablets at the
narrowest width that still gets the tablet layout: iPad 13" `834×1112` @2, Play 10"
`768×1229` @`1600/768`. The framer now refuses a raw more than 5% off the frame's aspect.

→ `capturing-store-screenshots-web`, `framing-store-screenshots`

## eas-cli 24 local builds take their env from EAS, not your `.env` files

A local build (`eas build --local`) of an app whose `eas.json` profile declares
`"environment": "production"` came out with no RevenueCat keys and no WebSocket URL. The
same command had always read `.env.production` from the working directory. With eas-cli
24.x it read only the EAS-hosted environment, which held a different subset of variables.
The build was green. The artifact gate caught it.

**Rule:** before a local build, load the committed env file into the shell
(`set -a; source .env.production; set +a`), then gate the artifact. Don't reason about
which source wins; the gate tells you.

→ `releasing-with-eas`, `configuring-expo-env`

## `EXPO_NO_CAPABILITY_SYNC=1` gets you past one wall and leaves stale profiles

EAS could not turn on App Groups for a widget extension: Apple's API rejected its
capability patch (*"invalid value at data.relationships.bundleIdCapabilities…attributes"*).
The workaround was to enable App Groups by hand in the developer portal and build with
`EXPO_NO_CAPABILITY_SYNC=1`. The next archive failed with *"Provisioning profile … doesn't
include the Associated Domains capability"*. The flag also stops EAS from regenerating
profiles, so the existing ones never picked up the capabilities added since.

**Rule:** the flag is for one build at most. Once the capability is on in the portal,
build without it. Sync then passes and the profiles regenerate. The extension target also
needs its own profile, and EAS creates that only in an interactive run.

→ `releasing-with-eas`

## An EAS Update reaches most users on the second cold start, not the first

A feature shipped over the air to a live version. On an Android phone it never appeared.
Every check said it should have: the update was on the branch at the right runtime, and a
`curl` to the update server with the binary's headers got it back. Installing the real
store `.aab` on an emulator showed what was happening. The first launch downloaded the
update behind the running app and kept the old bundle. Only a force-stop and relaunch
applied it. With `fallbackToCacheTimeout: 0` that is by design. On Android back and home
never end the process, so "next cold start" can be days away.

The fix was a JS gate that holds the splash and reloads into the update before first
render. Its first version waited 3 s, and unit tests passed. A release build on a throwaway
channel showed the check answering in under a second and the full-bundle download taking
4.2 s. The gate opened on the old bundle. Only the device test caught it.

**Rule:** if you ship updates often, gate first render on the update. Wait ~3 s for the
check, extend to ~10 s once it has found an update, and reload only after the startup
procedure ends. Verify it on a release build against a throwaway channel, never on unit
tests alone.

**Corollary:** gate the providers, not just the splash. Anything that runs before the
reload runs twice or is lost. A cold-start notification tap consumed before the reload
is gone.

**Corollary:** "the update is not showing" is a delivery question before it is a code
question. Ask the server with the binary's own headers, and read the runtime version and
channel from the artifact, not from a local `android/`/`ios/` that CNG regenerates.

→ `shipping-ota-updates`

## Privacy and support pages belong on a site you already run, one Markdown file per app

A new app's privacy and support URLs were planned as a fresh subdomain with its own
container, DNS record and deploy. The release stalled on it: both stores require a live
privacy URL before review, and the host was the one piece nobody could finish unattended.
Moving the pages under the owner's existing site took a commit and a 30-second deploy.

What it looked like: a release checklist with every box ticked except "privacy page live",
and a `curl` that returned nothing because the subdomain did not resolve.

**Rule:** give every app a Markdown file in a content collection on a site that already
deploys (`/app-privacy/<app>`, `/support/<app>`). Adding an app is adding a file. Point the
store listing and the in-app link at that path before the first build, because the in-app
link is baked into the binary.

**Corollary:** many static and SPA hosts answer an unknown path with the homepage and a
200. A status code cannot tell a missing policy from a live one. Verify by grepping the
live page for a sentence only the policy contains.

→ `writing-store-listings`

## The first Play upload of a new app is a human drag

Google Play refuses API uploads for a package until one bundle has been uploaded through
the Console, so `eas submit` cannot make the first release. A browser agent cannot finish it
either: CDP file transfer to a browser that is not on the same machine as the driver is
capped (Playwright: 50 MB), and a release AAB with game or media assets is usually larger.
The upload failed with `Cannot transfer files larger than 50Mb`.

**Rule:** for a new Play app, create the app and open Internal testing › Create release,
then have a person drag the `.aab` onto the drop zone. Everything after that (more bundles,
listing, prices, tracks) can go through the API or `eas submit`.

**Corollary:** a page reload after the upload loses the draft but not the bundle. Use
**Add from library** instead of uploading again.

→ `releasing-with-eas`

## Play "Add app" for a user grants view-only, and only after Save

**What happened:** an existing Play service account got 403 `The caller does not have
permission` from `eas submit` for a new app in the same developer account. Adding the app
under Users and permissions › user › Add app then Apply showed "13" permissions in the row,
but nothing is stored until **Save changes › Yes**. After saving, the row said **2**: the
default is view-only. A manual "made it admin" that skipped Save had no effect either.

**Rule:** after Add app, open that app's **Manage permissions**, tick **Admin** (or the two
Release permissions), Apply, **Save changes**, confirm **Yes**. Then prove it through the API
(create an edit on the package and expect 200) before running `eas submit`. Access arrived
within a minute.

→ `releasing-with-eas`

## AI-generated app icons come back with rounded corners and a fork outside the crop

**What happened:** asked for a mobile game icon, Gemini drew its own rounded-square mask with white corners outside it, and kept a pitchfork's prongs at the edge. Both stores apply their own mask to a full-bleed square, so a baked-in mask shows as white corners, and Android's adaptive-icon circle clipped the prongs. Asking Gemini to "zoom out" was ignored twice.

**Rule:** ask for a full-bleed square with no rounded corners, border or text, then check it in a circle mask before accepting it. When the subject sits too close to the edge, scale the image to about 82%, centre it, and have the model paint the new border, rather than asking it to zoom out. For Android, ship separate adaptive layers: a cut-out foreground scaled into the central 66% safe zone, a plain background plate, and a white monochrome silhouette. Don't reuse the flat icon as the foreground.

→ `framing-store-screenshots`

## A new app's first local iOS build fails non-interactive, and the team may already hold three certificates

**What happened:** `eas build --local --non-interactive` for a new app stopped at "Distribution Certificate is not validated for non-interactive builds", even with the App Store Connect API key in the environment, and each try spent a build number. Running `eas credentials -p ios` by hand then hit Apple's limit of three distribution certificates. None of the three was stored in the app's Expo account, because another app built under a different Expo account (an organization), so "Use an existing one" listed nothing.

**Rule:** before the first iOS build of a new app, have a person run `eas credentials -p ios` → production → All once. Don't retry the non-interactive build. If the team is at three certificates and none is in this Expo account, revoke the oldest: apps already live are unaffected, and the app that used it gets a new certificate on its next build.

→ `releasing-with-eas`

## Play custom store listings: the asset library dedupes by content and orders by click

Seen 2026-10-18 building three URL-targeted custom store listings for Praxis in the
Play Console UI.

- **"Duplicate an existing listing" copies every slot**, phone and both tablet sizes.
  Remove the inherited screenshots, or the tutor page keeps the student tablet shots.
- **Uploads land in a shared asset library that dedupes by bytes.** A file identical to
  one uploaded earlier (a reused frame) does not appear under its new name; it silently
  becomes the old asset (`image`, unnamed). Give every file a unique name per listing
  (`s1-play-03.png`) and, when a frame is shared between listings, change one pixel so
  the bytes differ.
- **Upload selects everything in random order.** Click *Deselect all*, then click the
  assets in the order you want, then *Add*. Order of selection is order on the listing.
- A second upload attempt while the first is still processing adds both sets (12 of 8,
  red border). Wait for the names to appear before acting again.
- **Rollout percentage can only go up after publishing**, and choosing 100% asks for a
  confirmation that "cannot be easily reversed". Save at 50% and raise later if unsure.
- The review step's *Save* only queues the change in Publishing overview ("Changes not
  yet submitted for review"); with Managed publishing off, *Submit for review* there is
  the step that goes live after approval.
- **The first upload after opening the asset panel often does nothing.** Upload, wait,
  search the file names; if they are missing, upload the same files again. A file Play
  merged with an old one shows "Asset was deduplicated" and keeps the old name.
- **Find a slot's "Add assets" by its section heading, never by index.** The buttons shift
  when a section expands; picking by index put tablet frames into the phone slot. Tag the
  button whose nearest container reads "Phone screenshots" (or "7-inch tablet") and click that.
- **Removing assets works with a scripted click; selecting them does not.** Remove buttons
  (`aria-label="Remove <name>"`) accept `element.click()`, so clear a slot in a loop. Asset
  selection in the panel needs real pointer clicks on `[aria-label="Deselected asset <name>"]`.
- **"Rollout 50%" shown right after Save is a display glitch** when the saved value is 100%;
  reload the edit page to read the real value.
- **Play can target a custom listing by search keyword**, not only by URL, country or ads.

## `eas submit` for Android can hang forever in a sandboxed shell, with zero sign of why

**What happened:** `eas submit -p android --path build.aab` sat for 25+ minutes with no
output, 0% CPU, and no open network connections — not slow, stalled. Killing it and
checking `lsof` on the PID showed it had no active sockets at all. This was inside an
agent's sandboxed shell (restricted outbound network); `eas submit` appears to phone home
to Expo's own servers before or alongside the actual Play upload, and that call never
returned or never got to run. The same `.aab`, uploaded straight to the Google Play
Developer API (`androidpublisher/v3`, service-account JWT, no Expo in the loop) with a
~40-line script, worked on the first try in under a minute.

**Rule:** if `eas submit -p android` produces no output for several minutes, check the
process for open sockets (`lsof -p <pid> | grep -i tcp`) and CPU time (`ps -o %cpu,time -p
<pid>`) before assuming it is just slow — near-zero on both means it is stuck, not working.
Kill it and upload directly: `POST /edits`, `POST .../bundles?uploadType=media` with the
raw `.aab` bytes, `PUT .../tracks/internal`, `POST .../edits/{id}:commit`. The JWT exchange
needs only the service-account JSON already required for `eas submit` itself (`iss`,
`scope: androidpublisher`, signed RS256, exchanged at the key's `token_uri`) — no new
credential.

**Corollary:** this bypasses `eas submit` entirely for Android, so it is worth keeping as
the default path in a sandboxed or CI shell rather than a break-glass fallback — it has one
fewer network hop and one fewer thing that can silently stall. iOS still needs `altool` (or
`eas submit`) since Apple has no equivalent raw-bytes upload endpoint this simple.

→ `releasing-with-eas`

## A native module that merely links the recorder needs the microphone string, even if your app never calls it

**What happened:** adding an audio *player* (`expo-audio`, no code calling `startRecording`
anywhere in the app) with no `NSMicrophoneUsageDescription` built, signed and passed the
artifact gate clean — then stalled or was rejected at App Store processing. The library
statically links AVAudioSession's record-permission path regardless of whether the app ever
asks for it, and Apple's binary analysis checks the linked symbols, not the call graph. An
earlier release of the same app had *removed* this exact string when a different recording
feature was cut — so its reappearance for an unrelated, playback-only feature looked wrong
at review time and nearly got reverted.

**Rule:** any native module whose SDK *can* record — an audio/video player built on a
recording-capable library, a WebRTC component, a barcode/ML-kit camera library — needs its
platform permission string declared even when your own code path never exercises it. Check
the module's own `ios/*.podspec` / `AndroidManifest.xml` for what it links, not just what
your code calls. On Android the asymmetry runs the other way: the manifest merger pulls in
`RECORD_AUDIO` from the library by default, and it has to be explicitly suppressed
(`recordAudioAndroid: false` on an Expo config plugin, or `tools:node="remove"` in a raw
manifest) if the app truly never records.

**Corollary:** write the usage string to say what's actually true (record-capable library,
playback-only feature) — App Review reads it, and a string that overclaims ("this app
records your voice") for a feature that never does invites the exact rejection it's meant to
avoid.

→ `releasing-with-eas`, `passing-app-review`

## Back-to-back local iOS + Android builds can exhaust disk mid-build, and the failure reads as a code problem

**What happened:** an Android local build failed at `mergeReleaseNativeLibs` with "No space
left on device" — a Gradle task failure that looks like a build config problem, not a
resource one, unless you read past the first error line. The preceding local iOS build (CocoaPods
resolution, DerivedData, archive) plus Gradle's own module/build caches had used most of the
disk; 11 GB free wasn't enough headroom for a native-lib merge step mid-build. Clearing the
CocoaPods *download* cache (`~/Library/Caches/CocoaPods` — safe, just re-downloads pods on
the next `pod install`) freed 14 GB and the rebuild passed. Separately, each
`eas build --local` leaves its working copy in a `$TMPDIR/eas-build-local-nodejs/<uuid>/`
directory that is not cleaned up after a successful build, and idle Gradle/Kotlin daemons
from the build (`gradlew` leaves them running by default) keep holding memory afterward.

**Rule:** before a local build session — especially both platforms back to back — check
`df -h /` has real headroom (treat under ~20 GB free as a reason to clear caches first, not
to build and see). Read "No space left on device" literally before debugging it as a Gradle
or dependency problem. After the session: `rm -rf "$TMPDIR"/eas-build-local-nodejs`, and
`pkill -f GradleDaemon; pkill -f KotlinCompileDaemon` to release the memory they keep
holding once you're done building.

→ `releasing-with-eas`

## Play "completed" on the production track does not mean the app is public

**What happened:** after sending a first production release for review, the Play Developer API
reported the production track as `status: completed` for that version code. That read as
"live", and a marketing page was about to link the Play listing. The public listing URL
(`https://play.google.com/store/apps/details?id=<package>`) still returned 404: the release was
committed and waiting for Google's review, and the track status says nothing about review.

**Rule:** treat a release as live only when the public listing URL answers 200 for a signed-out
request (`curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" "<listing url>&hl=en"`). Keep
store badges on "coming soon" until then.

→ `releasing-with-eas`

## `eas submit` can also stall on Expo's side: "Scheduled", then "Submitting" for half an hour

**What happened:** a local Android and iOS build were uploaded to EAS Submit ("Uploaded to EAS
Submit", "Scheduled ... submission"), then both sat at `- Submitting` for 30+ minutes while
status.expo.dev showed "Partially Degraded Service". Unlike the sandbox hang above, the CLI was
fine; the queue was not. The iOS `.ipa` went up directly in 8 seconds. The Android direct upload
then failed with `Version code 17 has already been used`: the queued EAS submission had landed in
the meantime, as a draft.

**Rule:** after ~10 minutes at `Submitting`, stop waiting and upload directly.
- iOS, with the App Store Connect API key `eas.json` already holds (no Apple ID password):
  copy the `.p8` to a temp dir as `AuthKey_<keyId>.p8`, then
  `API_PRIVATE_KEYS_DIR=<dir> xcrun altool --upload-app -f build.ipa -t ios --apiKey <keyId> --apiIssuer <issuerId>`.
- Android: the direct `androidpublisher` upload above. If it answers "version code already used",
  EAS got there first: skip the upload and just set the track release (`PUT .../tracks/<track>`
  with that version code and `status: completed`, then commit). A queued EAS Android submit with
  managed publishing lands as a draft and never reaches testers on its own.

→ `releasing-with-eas`

## Adding Google sign-in to an app whose push lives in another app's Firebase project shows that app's name

BirƏmlak's FCM sat in the Praxis Google Cloud project. The OAuth consent screen belongs to the
project, so Google sign-in would have asked users to "sign in to Praxis". The sign-in clients went
into a project of their own: Android resolves its client by package name + SHA-1 in whatever project
holds it, and the native SDK's `webClientId` must come from that same project. Push was untouched.

**Rule:** check the consent screen's app name before reusing a project for sign-in. Register an
Android client per SHA-1 (debug, upload, *and* Play App Signing; the last one is only exposed through
Play Console's copy button, not the page text).

→ `wiring-social-sign-in`

## Turning on a capability invalidates the profile; a non-interactive local build can fix it with the ASC key

Enabling Sign in with Apple on the App ID made the existing provisioning profile invalid. A local
`eas build --non-interactive` regenerated it without an Apple ID login once these were exported:
`EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`,
`EXPO_APPLE_TEAM_TYPE`. Verify the result: `codesign -d --entitlements :-` on the `.app` must list
`com.apple.developer.applesignin`.

→ `releasing-with-eas`

## Small store-console traps from one release

- Apple Services ID descriptions reject non-ASCII letters ("BirƏmlak" is "Invalid description"); use ASCII.
- `precheck` flags "Google" in an iOS description or What's New (other platforms, 2.3.10). Keep the
  Play copy separate when the app offers Google sign-in.
- Play's Data safety "Delete account URL" check got 403 from every Cloudflare-fronted host, though
  browsers and curl got 200, and the form will not advance past it. A public GitHub gist with the steps
  and the data deleted passed at once.
- A `deliver` piped into `head` dies of SIGPIPE mid-screenshot-upload with `overwrite_screenshots`
  on: log to a file instead, or the listing can be left without screenshots.

→ `writing-store-listings`, `publishing-listings-with-fastlane`

## `Appearance.setColorScheme` does not exist on react-native-web

An in-app theme switch that calls `Appearance.setColorScheme(...)` at module load crashed the whole
web bundle on import (`setColorScheme is not a function`) and nothing noticed, because only native
was ever opened. Web is what screenshot and design-board capture run on. Call it optionally
(`Appearance.setColorScheme?.(…)`) for the native chrome, and have the theme hook read the stored
pick itself instead of trusting `useColorScheme`, which web cannot be told.

→ `driving-simulators-and-devices`, `capturing-store-screenshots-web`

## `CI=1 expo start` serves a frozen bundle

A web dev server started as `CI=1 bunx expo start --web` (to stop it prompting in a background
shell) never picks up edits: in CI mode Metro turns file watching off. A QA agent fetched the bundle,
found none of the branch's changes in it, and lost its click-test. Start background servers without
`CI=1`; they don't prompt without a TTY anyway. If a fresh edit isn't in the bundle, check how the
server was started before suspecting the code.

→ `driving-simulators-and-devices`, `capturing-store-screenshots-web`

## `eas submit` "service account cannot submit this app"

The Play service account was active in the developer account and already releasing two other apps,
but app access in Play Console is per app: a new app under the same account isn't covered.
Users and permissions › the service account › App permissions › Add app › the new app, then Save
changes. The retry went through at once. Account permissions would cover every app instead.

→ `releasing-with-eas`

## Google sign-in silently "cancels" on a Play install: the SHA-1 was a SHA-256 prefix

On the Play-installed build, the account chooser opened, but picking an account closed it with nothing
else happening, and no request reached the backend. Credential Manager reports this rejection as a
cancellation, which the app rightly keeps silent. The Android OAuth client held
`AD:E1:…:EC:30`, the first 20 bytes of the Play app-signing **SHA-256**, which is the right length
for a SHA-1 and looks plausible. Play Console no longer renders the fingerprints as text: use the
"Copy SHA-1 certificate fingerprint" button (or download the certificate and run
`openssl x509 -inform der -fingerprint -sha1`), and check that the value isn't the start of the SHA-256.

→ `wiring-social-sign-in`
