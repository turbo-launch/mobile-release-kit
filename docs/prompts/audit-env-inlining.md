# Prompt — audit an Expo app for env vars that never reach the release binary

> Working *inside* a project that has this plugin? Use the **configuring-expo-env** skill
> and `scripts/verify-release-artifact.sh` instead — they carry the same rules plus the
> artifact gate. This file exists to be pasted into a codebase that has neither, and it
> covers the equivalent breakage in Vite / Next.js / CRA.

Paste the block below into any Expo / React Native project. It is self-contained: it
assumes no prior context and ends in a verified state rather than a claim.

Background for the reader (not part of the prompt): this bug shipped a signed `.ipa`
with no backend URL in it. Development, dev clients and Expo Go all worked, because
Metro populates `process.env` at runtime. Only the release bundle was empty, and the
symptom was an app that installed, launched, and reached nothing.

---

## The prompt

> Audit this Expo app for `EXPO_PUBLIC_*` environment variables that silently fail to be
> inlined into release builds, then fix what you find and prove the fix.
>
> **The rule.** `babel-preset-expo` inlines `EXPO_PUBLIC_*` by *static substitution* of
> literal `process.env.EXPO_PUBLIC_FOO` member expressions. Any read the transform cannot
> see statically yields `''` in a release bundle:
>
> ```ts
> const get = (k: string) => process.env[k] ?? '';   // computed — inlines NOTHING
> const { EXPO_PUBLIC_API_BASE_URL } = process.env;  // destructured — nothing
> const k = 'EXPO_PUBLIC_API_BASE_URL';
> process.env[k];                                    // nothing
> process.env.EXPO_PUBLIC_API_BASE_URL ?? '';        // correct
> ```
>
> **Why it escapes testing.** Metro populates `process.env` at runtime, so every dynamic
> form works in development, on a dev client, and in Expo Go. It fails only in a release
> bundle — the one build nobody runs before submitting. Do not treat "it works on my
> simulator" as evidence.
>
> **Do this:**
>
> 1. Find every read. Search for `process.env[`, destructuring off `process.env`, and any
>    helper that takes a variable *name* as an argument (`get('EXPO_PUBLIC_…')`,
>    `readEnv(…)`, `cfg('…')`). Check the whole app, not just an `env.ts` — including
>    `app.config.*`, plugins and any `src/lib/config*`.
> 2. Rewrite each one as a literal `process.env.EXPO_PUBLIC_NAME` member expression.
>    Keep any normalisation (trailing-slash trims, defaults) but move it *outside* the
>    read, so the read itself stays statically analysable.
> 3. Leave a comment at the definition site saying why the shape is mandatory. Without
>    it, the next person refactors it back into a helper — that is exactly how it
>    regressed the first time.
> 4. Check the build profile actually receives the vars. EAS supplies environment
>    variables only to a profile that declares one:
>    ```json
>    "production": { "channel": "production", "environment": "production" }
>    ```
>    A profile with no `"environment"` key gets none of them, silently. Confirm with
>    `eas env:list --environment production`.
> 5. **Prove it** — do not stop at a passing typecheck. Build a production bundle and
>    grep it. `expo export` runs the same transform in seconds, so no native build is
>    needed:
>    ```bash
>    set -a; . ./.env; set +a
>    bunx expo export --platform ios --output-dir /tmp/envcheck --no-minify
>    B=$(ls /tmp/envcheck/_expo/static/js/ios/*.hbc)
>    grep -ac '<a value that must be present>' "$B"   # expect >= 1
>    grep -ac 'EXPO_PUBLIC_API_BASE_URL'       "$B"   # expect 0
>    ```
>    Or use the kit's script, which does all of this plus the `app.config` asset and
>    distinct exit codes: `./scripts/verify-release-artifact.sh <artifact>`
>
>    `-a` is mandatory: Hermes output is binary, and plain `grep -c` returns 0 whether
>    the string is present or not because BSD grep short-circuits on binary input. A
>    check without `-a` cannot fail correctly, which is worse than no check.
>
>    Read the two lines together:
>
>    | value | var name | verdict |
>    |---|---|---|
>    | present | absent | inlined correctly |
>    | absent | **present** | still a computed access somewhere — the name survived as a runtime string |
>    | absent | absent | env absent at build time — profile `environment` or `.env` |
>
> 6. Report what you changed, and paste the actual grep counts. If you could not run the
>    export, say so plainly rather than implying the fix is verified.
>
> **Do not** add a runtime fallback that hardcodes the production URL to paper over this.
> That trades a loud failure for a silent one and ships a URL you cannot rotate.

---

## Same bug, other shapes

The pattern generalises past Expo — any build-time substitution defeated by indirection:

| Toolchain | Inlines | Breaks on |
|---|---|---|
| `babel-preset-expo` | `process.env.EXPO_PUBLIC_*` | computed / destructured |
| Vite | `import.meta.env.VITE_*` | `import.meta.env[k]` |
| Next.js | `process.env.NEXT_PUBLIC_*` | computed access |
| CRA / webpack `DefinePlugin` | `process.env.REACT_APP_*` | computed access |

The tell is identical everywhere: the variable **name** appears in the built bundle as a
string, and its **value** does not.
