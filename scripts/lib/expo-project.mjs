/**
 * Locating an Expo app and reading its identity, without depending on where it lives.
 *
 * Projects in the wild call the app directory `mobile/`, `mobile_frontend/`, `frontend/`, or
 * `frontend/apps/mobile/` in a monorepo. Any tool that hardcodes one of those names grows a
 * per-project fork the first time it meets another — which is the drift this kit exists to
 * stop. So: find the app by locating its config, and read everything from there.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'ios', 'android', '.expo', 'dist', 'build', 'vendor']);

/** First directory under `root` that holds an Expo config, or null. */
export function findMobileDir(root, depth = 4) {
  const hits = [];
  const walk = (dir, d) => {
    if (d > depth || hits.length) return;
    for (const f of ['app.json', 'app.config.ts', 'app.config.js']) {
      const p = join(dir, f);
      if (!existsSync(p)) continue;
      // `app.json` is a plausible filename for other things; require an `expo` key.
      if (f !== 'app.json') { hits.push(dir); return; }
      try { if (JSON.parse(readFileSync(p, 'utf8')).expo) { hits.push(dir); return; } } catch { /* not ours */ }
    }
    let entries = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e) || e.startsWith('.')) continue;
      let s; try { s = statSync(join(dir, e)); } catch { continue; }
      if (s.isDirectory()) walk(join(dir, e), d + 1);
    }
  };
  walk(root, 0);
  return hits[0] ?? null;
}

/** The `expo` block from app.json, or {} when the config is dynamic. */
function expoBlock(mobileDir) {
  const p = join(mobileDir, 'app.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')).expo ?? {}; } catch { return {}; }
}

/** Best-effort literal read out of a dynamic config. A computed value is not knowable
 *  without evaluating the config, so callers must tolerate null rather than trust a guess.
 *
 *  Two shapes are resolved, because the second is common enough that missing it makes a
 *  live app look unpublished:
 *      bundleIdentifier: 'com.acme.app'      ← literal
 *      bundleIdentifier: IOS_BUNDLE_ID       ← const declared earlier in the same file
 *  Anything else (a template string, a ternary, an env read) stays null by design. */
function fromDynamicConfig(mobileDir, key) {
  for (const f of ['app.config.ts', 'app.config.js']) {
    const p = join(mobileDir, f);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf8');

    const literal = src.match(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`));
    if (literal) return literal[1];

    const ref = src.match(new RegExp(`${key}:\\s*([A-Za-z_$][\\w$]*)`));
    if (ref) {
      const decl = src.match(
        new RegExp(`(?:const|let|var)\\s+${ref[1]}\\s*(?::[^=]+)?=\\s*['"]([^'"]+)['"]`),
      );
      if (decl) return decl[1];
    }
  }
  return null;
}

/** Marketing version. EAS owns the build number, so this is the only version in the repo. */
export function readVersion(mobileDir) {
  return expoBlock(mobileDir).version ?? fromDynamicConfig(mobileDir, 'version');
}

/** { ios, android } store identifiers — permanent once a build is uploaded. */
export function readIdentifiers(mobileDir) {
  const e = expoBlock(mobileDir);
  return {
    ios: e.ios?.bundleIdentifier ?? fromDynamicConfig(mobileDir, 'bundleIdentifier'),
    android: e.android?.package ?? fromDynamicConfig(mobileDir, 'package'),
  };
}

/** Display name for the app. */
export function readName(mobileDir) {
  return expoBlock(mobileDir).name ?? fromDynamicConfig(mobileDir, 'name');
}
