#!/usr/bin/env bash
# sim-capture.sh — capture one native iOS Simulator screenshot at full device
# resolution (higher fidelity than any MCP preview), after re-applying the clean
# status bar. Pair with a UI driver (Claude's mobile-mcp tools, Maestro, or hand
# navigation) that puts the app on the screen you want first.
#
#   ./sim-capture.sh <UDID> <out.png> [phone|pad]
#
# Typical loop (driven by the live-simulator-capture skill):
#   1. navigate the app to the target screen
#   2. ./sim-capture.sh <UDID> raw/<screen>.png phone
#   3. eyeball the PNG (no dev chrome, no empty state), repeat
set -euo pipefail
UDID="${1:?usage: sim-capture.sh <UDID> <out.png> [phone|pad]}"
OUT="${2:?usage: sim-capture.sh <UDID> <out.png> [phone|pad]}"
KIND="${3:-phone}"
HERE="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$(dirname "$OUT")"
"$HERE/sim-clean-statusbar.sh" "$UDID" "$KIND" >/dev/null
xcrun simctl io "$UDID" screenshot "$OUT" >/dev/null
# Report the real pixel size so you can confirm it matches a store slot.
DIMS="$(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/{print $2}' | paste -sd x -)"
echo "captured: $OUT ($DIMS)"
