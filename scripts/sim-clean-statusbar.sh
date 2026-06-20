#!/usr/bin/env bash
# sim-clean-statusbar.sh — force an iOS Simulator's status bar to the clean
# "marketing" state Apple uses (9:41, full battery, full signal, no charging
# bolt). Re-run before EVERY capture: the override resets on each app launch.
#
#   ./sim-clean-statusbar.sh <UDID> [phone|pad]
#
# phone (default): time + full cellular + wifi + 100% battery (discharging, so
#                  there's NO lightning bolt — "charged" draws an ugly bolt).
# pad:             time + wifi + battery only (iPads show no cellular).
#
# Find a UDID with:  xcrun simctl list devices booted
set -euo pipefail
UDID="${1:?usage: sim-clean-statusbar.sh <UDID> [phone|pad]}"
KIND="${2:-phone}"

if [ "$KIND" = "pad" ]; then
  xcrun simctl status_bar "$UDID" override \
    --time "9:41" \
    --batteryState discharging --batteryLevel 100 \
    --wifiBars 3
else
  xcrun simctl status_bar "$UDID" override \
    --time "9:41" \
    --batteryState discharging --batteryLevel 100 \
    --cellularMode active --cellularBars 4 \
    --wifiBars 3
fi
echo "clean status bar applied to $UDID ($KIND)"
