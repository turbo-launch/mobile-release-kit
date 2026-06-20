#!/usr/bin/env bash
# PreToolUse(Bash) hook: warn — never block — when a git command looks like it
# would stage/commit an EAS build artifact (.aab / .ipa / .apk). These are large
# (an .aab is ~74MB) and belong in .gitignore, not in the repo.
#
# Hook contract: input arrives as JSON on stdin; the bash command is at
# .tool_input.command. Always exit 0 (non-blocking) — this is a nudge, not a gate.

input="$(cat 2>/dev/null || true)"

# Extract the command being run (jq if available, else a tolerant grep).
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || true)"
else
  cmd="$(printf '%s' "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*:[[:space:]]*"(.*)"/\1/' || true)"
fi

# Only care about git add / git commit ...
if printf '%s' "$cmd" | grep -qiE 'git[[:space:]]+(add|commit)' 2>/dev/null; then
  # ... that reference a build-artifact extension.
  if printf '%s' "$cmd" | grep -qiE '\.(aab|ipa|apk)\b' 2>/dev/null; then
    echo "mobile-release-kit: heads up — that git command references a build artifact (.aab/.ipa/.apk). These are produced by EAS and uploaded to the stores; gitignore them (build-*.aab, build-*.ipa, *.apk) instead of committing." >&2
  fi
fi

exit 0
