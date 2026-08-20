#!/usr/bin/env bash
# PreToolUse(Bash) hook: warn — never block — when a command looks like it is about to
# upload a store artifact without the artifact having been verified first.
#
# Why: a signed .ipa/.aab that installs and launches can still carry none of its
# build-time configuration. `babel-preset-expo` inlines EXPO_PUBLIC_* by static
# substitution, so a computed `process.env[key]` read inlines nothing — and Metro
# populates `process.env` at runtime, so it works in development and fails only in a
# release build. A real release shipped with no backend URL that way, and the upload is
# the last moment it is cheap to catch.
#
# Warn-only by deliberate choice. A blocking hook cannot know whether the gate already
# passed in this session, and would fire on every legitimate retry (Apple's uploader
# retries parts on its own). Matches guard-build-artifacts.sh's non-blocking convention.
#
# Hook contract: JSON on stdin, the bash command at .tool_input.command. Always exit 0.

input="$(cat 2>/dev/null || true)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || true)"
else
  cmd="$(printf '%s' "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*:[[:space:]]*"(.*)"/\1/' || true)"
fi

# Upload paths: altool/Transporter for Apple, `eas submit` for either store, and the
# Play Developer API via fastlane supply.
if printf '%s' "$cmd" | grep -qiE '(altool[[:space:]]+.*--upload-app|iTMSTransporter|eas[[:space:]]+submit|fastlane[[:space:]]+supply)' 2>/dev/null; then
  cat >&2 <<'MSG'
mobile-release-kit: about to upload a store artifact. If you have not run the artifact
gate on THIS build, run it first — a signed binary can install, launch, and hold none of
its build-time env:

    ./scripts/verify-release-artifact.sh <artifact>      # or: just verify-artifact

  exit 0  every checked value is in the binary — cleared to upload
  exit 1  a value is missing — do not upload
  exit 2  could not inspect — deliberately NOT a pass

A rejected or inert build costs a review cycle; the gate costs two seconds.
MSG
fi

exit 0
