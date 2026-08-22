#!/usr/bin/env node
/**
 * mobile-projects.mjs — what mobile apps do I have, and what is live in each store?
 *
 * The point is inheritance, not a dashboard: one place that says which apps exist, so a new
 * project can be pointed at the closest prior art, and so a release that never made it out
 * of processing is visible without opening five repos.
 *
 * DELIBERATELY THIN. The registry stores only what cannot be derived — the path to each
 * project. Versions and identifiers are re-read from disk on every run, because a registry
 * that caches them is a registry that lies, which is the same failure as the duplicated
 * skill files this kit was consolidated out of.
 *
 *   mobile-projects.mjs                    list every project (default)
 *   mobile-projects.mjs register [path]    add a project (default: cwd)
 *                       [--country AZ]     ...and remember its storefront
 *   mobile-projects.mjs forget <name>      drop one
 *   mobile-projects.mjs --no-live          skip the store lookups (offline / fast)
 *   mobile-projects.mjs --country AZ       storefront to query (default: us). A region-
 *                                          limited app is absent from every other one.
 *   mobile-projects.mjs --json             machine-readable
 *
 * State: ~/.claude/mobile-release-kit/registry.json  (user scope — never inside this repo,
 * which is public and shared).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { findMobileDir, readVersion, readIdentifiers, readName } from './lib/expo-project.mjs';

const STATE_DIR = join(homedir(), '.claude', 'mobile-release-kit');
const REGISTRY = join(STATE_DIR, 'registry.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const cmd = argv.find((a) => !a.startsWith('-')) ?? 'list';

function load() {
  if (!existsSync(REGISTRY)) return { projects: [] };
  try { return JSON.parse(readFileSync(REGISTRY, 'utf8')); }
  catch { console.error(`! ${REGISTRY} is unreadable — starting empty`); return { projects: [] }; }
}
function save(d) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(REGISTRY, JSON.stringify(d, null, 2) + '\n');
}

/** Everything derived. Never stored. */
function inspect(entry) {
  const root = resolve(entry.path);
  if (!existsSync(root)) return { ...entry, error: 'path is gone' };
  const mobileDir = entry.mobileDir ? resolve(root, entry.mobileDir) : findMobileDir(root);
  if (!mobileDir) return { ...entry, error: 'no Expo app found' };
  const ids = readIdentifiers(mobileDir);
  return {
    ...entry,
    name: entry.name ?? readName(mobileDir) ?? basename(root),
    mobileDir,
    version: readVersion(mobileDir),
    ios: entry.ios ?? ids.ios,
    android: entry.android ?? ids.android,
  };
}

/**
 * App Store version, from the public iTunes Lookup endpoint — no auth, no account.
 *
 * There is no equivalent for Play: the Play Developer API needs the service account already
 * configured for `eas submit`, which this tool deliberately does not read (credentials are
 * referenced by path elsewhere, never loaded here). Android therefore reports `?` rather
 * than a guess — an invented version is worse than an absent one.
 */
async function appStoreVersion(bundleId, country) {
  if (!bundleId) return null;
  try {
    const r = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${encodeURIComponent(country)}`,
      { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.results?.[0]?.version ?? null;   // no result = not published under that id
  } catch { return null; }
}

// ------------------------------------------------------------------ commands
if (cmd === 'register') {
  const target = resolve(argv.find((a) => !a.startsWith('-') && a !== 'register') ?? process.cwd());
  const d = load();
  const mobileDir = findMobileDir(target);
  if (!mobileDir) { console.error(`no Expo app under ${target} — nothing to register`); process.exit(2); }
  const name = readName(mobileDir) ?? basename(target);
  const ci = argv.indexOf('--country');
  const country = ci === -1 ? undefined : argv[ci + 1]?.toLowerCase();
  const existing = d.projects.find((p) => resolve(p.path) === target);
  if (existing) {
    // Re-registering is how you correct a storefront, so let it update rather than refuse.
    if (country && existing.country !== country) {
      existing.country = country; save(d);
      console.log(`updated ${existing.name} → storefront ${country.toUpperCase()}`);
    } else {
      console.log(`already registered: ${existing.name} (${target})`);
    }
  } else {
    d.projects.push({ name, path: target, ...(country ? { country } : {}) });
    save(d);
    console.log(`registered ${name} → ${target}${country ? ` (${country.toUpperCase()})` : ''}`);
  }
  process.exit(0);
}

if (cmd === 'forget') {
  const name = argv[argv.indexOf('forget') + 1];
  if (!name) { console.error('forget needs a name'); process.exit(2); }
  const d = load();
  const before = d.projects.length;
  d.projects = d.projects.filter((p) => p.name !== name);
  save(d);
  console.log(before === d.projects.length ? `no project named ${name}` : `forgot ${name}`);
  process.exit(0);
}

// ---------------------------------------------------------------------- list
const d = load();
if (!d.projects.length) {
  console.log('No mobile projects registered yet.\n');
  console.log('  mobile-projects register            # from inside a project');
  console.log('  mobile-projects register <path>');
  process.exit(0);
}

const rows = d.projects.map(inspect);
if (!has('--no-live')) {
  const country = (argv[argv.indexOf('--country') + 1] ?? 'us').toLowerCase();
  const live = await Promise.all(rows.map((r) => (r.error ? null : appStoreVersion(r.ios, r.country ?? country))));
  rows.forEach((r) => { r.queriedCountry = (r.country ?? country).toUpperCase(); });
  rows.forEach((r, i) => { r.iosLive = live[i]; });
}

if (has('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }

const w = (s, n) => String(s ?? '—').padEnd(n).slice(0, n);
console.log('');
console.log(`${w('APP', 18)} ${w('LOCAL', 8)} ${w('APP STORE', 10)} ${w('PLAY', 6)} PATH`);
console.log(`${w('---', 18)} ${w('-----', 8)} ${w('---------', 10)} ${w('----', 6)} ----`);

let ahead = 0;
for (const r of rows) {
  if (r.error) { console.log(`${w(r.name, 18)} ${w('!', 8)} ${w(r.error, 10)} ${w('', 6)} ${r.path}`); continue; }
  // Absent means only that: not published in the storefront queried. An app in review, an
  // app approved but not released, and a region-limited app all look identical from here —
  // so say where we looked rather than pronouncing it dead.
  const iosLive = has('--no-live') ? '—' : (r.iosLive ?? `not in ${r.queriedCountry}`);
  // "local is ahead of the store" is the state worth surfacing: a version bumped and
  // committed but never submitted, or submitted and stuck in review.
  const isAhead = r.version && r.iosLive && r.version !== r.iosLive;
  if (isAhead) ahead++;
  console.log(`${w(r.name, 18)} ${w(r.version, 8)} ${w(iosLive, 10)} ${w('?', 6)} ${r.path}${isAhead ? '   ← local ≠ App Store' : ''}`);
}
console.log('');
console.log(`${rows.length} project(s)${ahead ? `, ${ahead} where local differs from the App Store` : ''}.`);
console.log('PLAY is always ? — the Play API needs the service account, which this tool does not read.');
if (!has('--no-live')) {
  console.log('An app in review, approved-but-unreleased, or limited to another region all read the same');
  console.log('here. --country <CC> queries a different storefront.');
}
