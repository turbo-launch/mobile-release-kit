# Release-tree convention

Organize a mobile app's release artifacts under `docs/ops/mobile-releases/`, one folder per version. Keeps every submission's screenshots, listing copy, and runbook together and reviewable in git.

```
docs/ops/mobile-releases/
├── README.md              # how captures are produced + the device/locale matrix
├── CHANGELOG.md           # per version: what shipped + any deploy prereqs
└── v<version>/            # matches app.config.ts / app.json `version`
    ├── PUBLISH.md         # the build → submit runbook for THIS release
    ├── PREFLIGHT.md       # the gating checklist
    ├── shared/            # cross-store copy: app-description.txt, release-notes.txt (per locale)
    ├── ios/
    │   ├── app-store-listing.txt
    │   └── screenshots/<device>/<lang>/        # raw inputs
    │       └── framed/                         # framed deliverables (uploaded)
    └── android/
        ├── play-store-listing.txt
        ├── feature-graphic.png                 # 1024×500
        └── screenshots/<slot>/<lang>/          # <slot> = phone | tablet-10
            └── framed/                         # framed deliverables (uploaded)
```

## Conventions

- **`<version>` matches the app config `version`.** EAS owns the build number, so the folder name is the marketing version only.
- **`<device>`** for iOS = `iphone-6.9`, `ipad-13`. **`<slot>`** for Android = `phone`, `tablet-10`. **`<lang>`** = `en`, plus any shipped locale.
- **Raw vs framed.** The bare captures are regenerable **inputs**; the `framed/` PNGs are self-contained **deliverables** (the screenshot pixels are baked in). After framing, you can delete the raws to cut redundancy — recapture when you need to re-frame. (Keep the raws if recapture is expensive, e.g. a hard-to-stage live screen.)
- **Upload the `framed/` set** to App Store Connect / Play Console — not the raws.
- One `PUBLISH.md` + `PREFLIGHT.md` per version; copy the templates from this plugin's `templates/` and fill in the placeholders.
