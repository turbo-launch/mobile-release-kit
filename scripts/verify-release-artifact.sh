#!/usr/bin/env bash
# verify-release-artifact.sh — prove a store artifact is not inert BEFORE uploading.
#
# A signed .ipa/.aab that installs and launches can still carry none of its build-time
# configuration. `babel-preset-expo` inlines env vars by STATIC substitution of literal
# `process.env.NAME` member expressions, so a computed read — `process.env[key]`,
# destructuring, or any helper taking the name as an argument — inlines NOTHING. Metro
# populates `process.env` at runtime, so it works in development and fails only in a
# release bundle. A real release shipped with no backend URL that way.
#
# What this does: for every variable in the env file, assert its VALUE appears in the
# JS bundle and its NAME does not. The name surviving as a string is the signature of a
# non-inlinable read.
#
#   ./verify-release-artifact.sh [artifact] [--env-file .env] [--prefix EXPO_PUBLIC_]
#                               [--var NAME]... [--quiet]
#
#   artifact     .ipa | .aab | .apk. Auto-detected from the cwd when omitted.
#   --env-file   defaults to .env
#   --prefix     only check vars whose name starts with this (default EXPO_PUBLIC_;
#                pass --prefix '' to check every var in the file)
#   --var        check only these names (repeatable); overrides --prefix
#   --optional   downgrade this name to a warning if absent (repeatable). For vars that
#                live in the env file but are legitimately not consumed by the native
#                app — e.g. web-only OAuth redirect URIs. Explicit by design: the gate
#                stays failing-by-default, and every exemption is visible in the command.
#
# Exit codes — deliberately distinct, so a broken invocation cannot look like a pass:
#   0  every checked value present, no leaked names
#   1  a value is missing, or a variable name leaked (REAL FAILURE — do not upload)
#   2  could not inspect (artifact/bundle/env file not found, unknown format)
set -uo pipefail

ARTIFACT=""; ENV_FILE=".env"; PREFIX="EXPO_PUBLIC_"; QUIET=0; VARS=(); OPTIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE="${2:?--env-file needs a path}"; shift 2 ;;
    --prefix)   PREFIX="${2-}"; shift 2 ;;
    --var)      VARS+=("${2:?--var needs a name}"); shift 2 ;;
    --optional) OPTIONAL+=("${2:?--optional needs a name}"); shift 2 ;;
    --quiet)    QUIET=1; shift ;;
    -h|--help)  sed -n '2,28p' "$0"; exit 0 ;;
    -*)         echo "unknown flag: $1" >&2; exit 2 ;;
    *)          ARTIFACT="$1"; shift ;;
  esac
done

say() { [ "$QUIET" -eq 1 ] || printf '%s\n' "$*"; }
die2() { printf 'verify: %s\n' "$*" >&2; exit 2; }

# ---------------------------------------------------------------- find artifact
if [ -z "$ARTIFACT" ]; then
  # Newest of each kind; prefer whichever is newer overall.
  ARTIFACT="$(ls -t ./*.ipa ./*.aab ./*.apk 2>/dev/null | head -1 || true)"
  [ -n "$ARTIFACT" ] || die2 "no .ipa/.aab/.apk in $(pwd) — pass one explicitly"
fi
[ -f "$ARTIFACT" ] || die2 "not a file: $ARTIFACT"

# ------------------------------------------------------- locate the JS bundle
# Two places a build-time value can land, and a project may use either:
#   JS bundle    — `process.env.EXPO_PUBLIC_*` statically inlined by Babel
#   app.config   — `process.env.X` read in app.config.ts and passed via `extra`,
#                  which ships as an Expo constants asset, NOT in the JS bundle
# Searching only the bundle reports false negatives for the `extra` pattern.
case "$ARTIFACT" in
  *.ipa) GLOB='Payload/*.app/main.jsbundle';        CFG='Payload/*.app/EXConstants.bundle/app.config' ;;
  *.aab) GLOB='base/assets/index.android.bundle';   CFG='base/assets/app.config' ;;
  *.apk) GLOB='assets/index.android.bundle';        CFG='assets/app.config' ;;
  *)     die2 "unknown artifact type: $ARTIFACT (expected .ipa/.aab/.apk)" ;;
esac

BUNDLE="$(mktemp)"; CONFIG="$(mktemp)"; trap 'rm -f "$BUNDLE" "$CONFIG"' EXIT
unzip -p "$ARTIFACT" "$GLOB" > "$BUNDLE" 2>/dev/null || true
unzip -p "$ARTIFACT" "$CFG"  > "$CONFIG" 2>/dev/null || true
SIZE=$(wc -c < "$BUNDLE" | tr -d ' ')
CFGSIZE=$(wc -c < "$CONFIG" | tr -d ' ')
[ "$SIZE" -gt 1024 ] || die2 "no JS bundle at '$GLOB' inside $ARTIFACT (extracted ${SIZE}B).
       An empty extract greps as 'string absent' and would read as a failure — refusing
       to guess. Check the path with: unzip -l '$ARTIFACT' | grep -i bundle"

# Hermes bytecode starts c61fbc03c103191f; a plain-JS bundle is text. Either is fine —
# this only rules out having extracted something that is neither.
MAGIC="$(head -c 8 "$BUNDLE" | xxd -p 2>/dev/null || true)"
KIND="plain JS"
[ "$MAGIC" = "c61fbc03c103191f" ] && KIND="Hermes bytecode"

say "artifact : $ARTIFACT"
say "bundle   : $GLOB  (${SIZE} bytes, $KIND)"
say "config   : $CFG  (${CFGSIZE} bytes)"

# ------------------------------------------------------------- collect vars
[ -f "$ENV_FILE" ] || die2 "env file not found: $ENV_FILE (use --env-file)"

if [ "${#VARS[@]}" -eq 0 ]; then
  while IFS= read -r name; do VARS+=("$name"); done < <(
    grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" \
      | tr -d ' \t=' | grep -E "^${PREFIX}" || true
  )
fi
[ "${#VARS[@]}" -gt 0 ] || die2 "no variables matched prefix '${PREFIX}' in $ENV_FILE"

# ------------------------------------------------------------------- checks
is_optional() { local q="$1" o; for o in ${OPTIONAL+"${OPTIONAL[@]}"}; do [ "$o" = "$q" ] && return 0; done; return 1; }

fail=0; skipped=0; checked=0; warned=0
say ""
printf '%-38s %-9s %-9s %s\n' "VARIABLE" "FOUND IN" "NAME" "VERDICT"
printf '%-38s %-9s %-9s %s\n' "--------" "--------" "----" "-------"

for name in "${VARS[@]}"; do
  # Last assignment wins, matching dotenv precedence.
  value="$(grep -E "^[[:space:]]*${name}=" "$ENV_FILE" | tail -1 | cut -d= -f2- \
           | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
  if [ -z "$value" ]; then
    printf '%-38s %-9s %-9s %s\n' "$name" "-" "-" "SKIP (empty in $ENV_FILE)"
    skipped=$((skipped+1)); continue
  fi

  # -a is mandatory: BSD grep short-circuits on binary input and reports 0 matches
  # whether the string is present or absent. Without it this check cannot fail
  # correctly, which is worse than having no check.
  # -F: values are literal strings, not regexes — a URL's dots would otherwise match
  # any character and produce false positives.
  # No `|| echo 0`: `grep -c` already prints 0 and merely exits 1 on no match, so the
  # fallback would append a second line and break the integer comparisons below.
  vb=$(grep -aFc -- "$value" "$BUNDLE" 2>/dev/null); vb=${vb:-0}
  vc=$(grep -aFc -- "$value" "$CONFIG" 2>/dev/null); vc=${vc:-0}
  # The NAME is only meaningful in the JS bundle: app.config legitimately contains
  # config keys, and a name there says nothing about Babel inlining.
  n=$(grep -aFc -- "$name" "$BUNDLE" 2>/dev/null); n=${n:-0}
  checked=$((checked+1))
  where="-"
  [ "$vb" -ge 1 ] && where="bundle"
  [ "$vc" -ge 1 ] && where="${where/-/}${vb:+ }config"
  where="${where# }"; [ -n "$where" ] || where="-"

  if   { [ "$vb" -ge 1 ] || [ "$vc" -ge 1 ]; } && [ "$n" -eq 0 ]; then verdict="ok"
  elif { [ "$vb" -ge 1 ] || [ "$vc" -ge 1 ]; }; then verdict="ok (name also present — confirm it is not a runtime lookup)"
  elif [ "$n" -ge 1 ]; then verdict="FAIL — name leaked, value absent: non-inlinable read"; fail=$((fail+1))
  elif is_optional "$name"; then verdict="warn — absent, declared optional"; warned=$((warned+1))
  else                       verdict="FAIL — value absent: env missing at build time"; fail=$((fail+1))
  fi
  printf '%-38s %-9s %-9s %s\n' "$name" "$where" "$n" "$verdict"
done

# --------------------------------------------------------- iOS plist assertions
if [ "${ARTIFACT##*.}" = "ipa" ]; then
  say ""
  say "Info.plist:"
  unzip -p "$ARTIFACT" 'Payload/*.app/Info.plist' 2>/dev/null | plutil -p - 2>/dev/null \
    | grep -E '"(CFBundleIdentifier|CFBundleShortVersionString|CFBundleVersion|ITSAppUsesNonExemptEncryption|MinimumOSVersion)"' \
    | sed 's/^/  /' || say "  (could not read)"
  if ! unzip -p "$ARTIFACT" 'Payload/*.app/Info.plist' 2>/dev/null | plutil -p - 2>/dev/null \
       | grep -q 'ITSAppUsesNonExemptEncryption'; then
    say "  NOTE ITSAppUsesNonExemptEncryption is unset — expect an export-compliance"
    say "       question on every submission."
  fi
fi

say ""
if [ "$fail" -gt 0 ]; then
  say "FAIL — $fail of $checked checked variable(s) did not make it into the binary."
  say "       Do not upload. See docs/prompts/audit-env-inlining.md."
  exit 1
fi
say "PASS — $checked variable(s) checked${warned:+, $warned optional-absent}${skipped:+, $skipped skipped}."
exit 0
