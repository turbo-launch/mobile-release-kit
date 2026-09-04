---
name: publishing-listings-with-fastlane
description: >-
  Use when pushing App Store listing copy and screenshots to App Store Connect from the command line with fastlane deliver — generating the metadata tree, setting up the ASC API key, and keeping the push from touching the binary or starting a review. Trigger on "fastlane", "deliver", "push the listing", "upload screenshots to App Store Connect", "update the store metadata", "automate the listing", "ASC API key", "metadata tree", "listing copy is out of date". Keywords: fastlane deliver, Deliverfile, Appfile, skip_binary_upload, overwrite_screenshots, submit_for_review, .p8, ASC API key, App Store Connect character limit, metadata/en-US, review_information, demo password, precheck.
---

# Publishing listings with fastlane

`deliver` pushes **listing copy and screenshots** to App Store Connect. It is the companion
to the binary upload, not a replacement for it — see `releasing-with-eas` for the artifact.

Write the copy first with `writing-store-listings`; capture and frame the images with the
capture skills. This skill is only the push.

> **Scope guard:** this skill never uploads a binary and never starts a review. Both are
> configured off, deliberately — see the `Deliverfile` below.

## Auth is an ASC API key, not an Apple ID

App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys →
(+), role **App Manager**. Download the `.p8` **once** — Apple never shows it again — and
store it outside the repo.

```bash
export ASC_KEY_ID=...  ASC_ISSUER_ID=...  ASC_KEY_PATH=~/.appstoreconnect/AuthKey_XXX.p8
```

An Apple ID + app-specific password also works for `deliver`, but the API key avoids 2FA
prompts and is the only thing that works unattended.

## Generate the metadata tree — never hand-maintain it

`deliver` wants one short file per field:

```
fastlane/metadata/en-US/{name,subtitle,promotional_text,keywords,description}.txt
fastlane/metadata/en-US/{support_url,marketing_url,privacy_url,release_notes}.txt
fastlane/metadata/review_information/{demo_user,demo_password,first_name,last_name,phone_number,email_address,notes}.txt
```

Maintaining those *beside* a human-readable listing document means the same copy in two
places, and duplicated copy drifts — that is exactly how a store listing ends up describing
an app that no longer exists. **Keep one source document and generate the tree from it.**

```bash
bunx --package github:turbo-launch/mobile-release-kit#main mrk-store-metadata --repo .
```

**Gitignore the output.** The tree contains `review_information/demo_password.txt` — a real
password on disk:

```gitignore
fastlane/metadata/
fastlane/screenshots/
fastlane/report.xml
```

Keep the password itself out of the tracked source too: read it at generate time from a
gitignored local file, so the source document can carry a `REPLACE_WITH_*` marker safely.

### Two guards the generator must have

- **Exit non-zero on a surviving `REPLACE_WITH_*` placeholder.** Shipping a placeholder to a
  store is worse than failing the command.
- **Count characters, not bytes.** ASC's limits are in characters, and any multibyte locale
  (`ə ş ı ğ ç ö ü`, Cyrillic, CJK) passes a `wc -c` or `Buffer.byteLength` check and is then
  rejected by ASC. Use `[...str].length`.

  | Field | Limit |
  |---|---|
  | name | 30 |
  | subtitle | 30 |
  | promotional text | 170 |
  | keywords | 100 |
  | description | 4000 |

## `Deliverfile` — the settings that matter

```ruby
app_version           version # PIN IT — see below
overwrite_screenshots true    # otherwise a re-run STACKS onto the stale set in ASC
submit_for_review     false   # never let a metadata push start a review
automatic_release     false
skip_binary_upload    true    # the binary is uploaded separately
force                 true    # skip the interactive HTML preview (CI)
```

**Pin `app_version`.** Unset, deliver reads it from whichever `.ipa` it auto-detects
(`detect_values.rb`); with several builds in the directory a metadata push can land this
release's copy on an **older version record**.

**Do not resolve paths from `__dir__`.** fastlane `eval`s the `Deliverfile`, and `__dir__`
comes out one level above `fastlane/` — so `'../app.json'` climbs out of the app directory
and dies on `ENOENT`, and `metadata_path` silently points at a directory that does not exist.
Find the app by searching for `app.json`:

```ruby
mobile = [File.expand_path('..', __dir__), Dir.pwd, File.expand_path('..', Dir.pwd)]
         .find { |d| File.exist?(File.join(d, 'app.json')) }
raise 'Deliverfile: could not find app.json' unless mobile
```

`Appfile` carries the identity:

```ruby
app_identifier "com.example.app"
apple_id       "REPLACE_WITH_APPLE_ID"
team_id        "REPLACE_WITH_TEAM_ID"
```

## Running it

```bash
bunx fastlane deliver --precheck_include_in_app_purchases false   # the push
```

**`--verify_only` is NOT a metadata dry run.** It package-validates a binary and returns
before `upload_metadata` ever runs (`deliver/runner.rb`) — so it checks nothing about your
copy or screenshots, and with build artifacts in the app directory it validates an
already-uploaded `.ipa` and fails on a duplicate bundle version. There is no metadata dry run
in `deliver`. Build one from the parts that work:

```bash
bunx mrk-store-metadata                        # limits + surviving REPLACE_WITH_
bunx mrk-check-screenshots <screenshots-dir>   # every capture is a size ASC accepts
bunx fastlane precheck --include_in_app_purchases false
```

`precheck` is what catches the rejections you would otherwise wait a day to hear about —
placeholder text, broken URLs, prohibited words. It **cannot** read in-app purchases with an
API key and errors out if you let it try, hence the flag — on `deliver` it is spelled
`--precheck_include_in_app_purchases false`.

**Count the screenshots afterwards.** `deliver`'s post-upload check races ASC's processing,
declares the still-processing images *"missing on App Store Connect"*, re-uploads them, and
still prints "Successfully uploaded all screenshots" — leaving duplicates and silently
dropping the tail of the set once the 10-image cap is reached.

## What fastlane is *not* for here

**`snapshot` / `screengrab` are the wrong tool for an Expo app.** `snapshot` needs an
XCUITest target inside `ios/`, which `expo prebuild` regenerates — keeping it alive needs a
config plugin. Its real value is a locale × device matrix; with one locale and one phone slot
that is five captures, and it still would not do the framing step. Use the kit's capture and
framing skills instead.

**Google Play** has no `deliver` equivalent worth adopting here — `supply` needs the same
service-account JSON that `eas submit` already uses, and the Play listing has far fewer
fields. Paste it, or drive it with `eas submit`.

## Related

- `writing-store-listings` — produces the source document this generates from
- `releasing-with-eas` — the binary half, including `altool` upload
- `framing-store-screenshots` — produces the images this pushes
