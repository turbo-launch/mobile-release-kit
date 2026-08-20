---
description: Prove a built .ipa/.aab actually carries its build-time env, before uploading
---

Verify the store artifact in the current project is not inert, then report the verdict.

A signed `.ipa`/`.aab` that installs and launches can still hold none of its build-time
configuration — the failure mode is an app that opens and reaches nothing. Run the gate
rather than eyeballing it:

```bash
./scripts/verify-release-artifact.sh $ARGUMENTS
```

If the project has a recipe, prefer it (it carries the project's own `--prefix` /
`--optional` flags): `just verify-artifact $ARGUMENTS`

Then act on the exit code, and **state it explicitly** in your report:

- **0** — every checked value is in the binary. Cleared to upload.
- **1** — a value is missing. **Do not upload.** Read the FOUND IN and NAME columns:
  - name present, value absent → a non-inlinable env read in app code
    (`process.env[key]`, destructuring, a `get(name)` helper). Fix the read to a literal
    `process.env.EXPO_PUBLIC_*` member expression; see `docs/prompts/audit-env-inlining.md`.
  - both absent → the var was not present at build time. Check the build profile
    declares `"environment"` in `eas.json`, and `eas env:list --environment <env>`.
- **2** — could not inspect (missing artifact, unknown format, no bundle at the expected
  path). This is deliberately **not** a pass. Fix the invocation and re-run.

Do not report success on exit 2, and do not report success without having run the
command. If you could not run it, say so.
