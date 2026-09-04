#!/usr/bin/env bash
# check-screenshots.sh — assert every store screenshot is a size App Store Connect accepts.
#
# ASC silently refuses a wrong-sized file at the drop zone: the upload appears to happen,
# and the slot stays at "0 of 10". `deliver` is no safer — its post-upload check races ASC's
# processing, re-uploads images it wrongly believes are missing, and prints "Successfully
# uploaded all screenshots" over a set that now contains duplicates. Both failures are cheap
# to prevent and expensive to notice, so check the files before they are pushed and count
# them again afterwards.
#
#   ./check-screenshots.sh <dir> [--device iphone|ipad]
#
#   dir   a directory containing <locale>/*.png, or any parent of one. Every PNG beneath it
#         is checked, and each locale directory must be internally consistent — a set with
#         mixed sizes is rejected by ASC as a whole.
set -euo pipefail

DIR="${1:-}"
[ -n "$DIR" ] || { echo "usage: check-screenshots.sh <dir> [--device iphone|ipad]" >&2; exit 2; }
[ -d "$DIR" ] || { echo "no such directory: $DIR" >&2; exit 2; }
DEVICE="iphone"
[ "${2:-}" = "--device" ] && DEVICE="${3:-iphone}"

DIR="$DIR" DEVICE="$DEVICE" python3 <<'PY'
import os, sys, pathlib, struct
from collections import Counter

# Sizes ASC accepts, both orientations. iPhone 6.9" and 6.5" are the only iPhone slots that
# still take uploads; ASC scales one set to every other display size, so a single set is
# enough — supplying more buys nothing.
IPHONE = {(1320,2868),(2868,1320),(1290,2796),(2796,1290),   # 6.9"
          (1242,2688),(2688,1242),(1284,2778),(2778,1284)}   # 6.5"
IPAD   = {(2064,2752),(2752,2064),(2048,2732),(2732,2048)}   # 13"
OK = IPAD if os.environ["DEVICE"] == "ipad" else IPHONE

def png_size(p):
    with open(p,'rb') as f: head = f.read(24)
    return None if head[:8] != b'\x89PNG\r\n\x1a\n' else struct.unpack('>II', head[16:24])

root = pathlib.Path(os.environ["DIR"])
shots = sorted(root.rglob('*.png'))
if not shots:
    print(f"no screenshots found under {root}", file=sys.stderr); sys.exit(1)

bad = []
by_dir = {}
for p in shots:
    sz = png_size(p)
    if sz is None:
        bad.append((p.relative_to(root), "not a PNG")); continue
    if sz not in OK:
        bad.append((p.relative_to(root), f"{sz[0]}x{sz[1]} is not a size ASC accepts"))
    by_dir.setdefault(p.parent.relative_to(root), []).append(sz)

print(f"{len(shots)} screenshot(s) under {root}")
for d, sizes in sorted(by_dir.items()):
    uniq = sorted(set(sizes))
    print(f"  {d}  {len(sizes)} file(s)  " + ", ".join(f"{w}x{h}" for w,h in uniq))
    if len(uniq) > 1:
        bad.append((d, "mixed sizes in one locale directory — ASC rejects the set"))
    if len(sizes) > 10:
        bad.append((d, f"{len(sizes)} files — ASC caps a slot at 10"))

if bad:
    print("\nPROBLEMS:", file=sys.stderr)
    for rel, why in bad: print(f"  {rel}: {why}", file=sys.stderr)
    sys.exit(1)
print("all screenshots are a size ASC accepts")
PY
