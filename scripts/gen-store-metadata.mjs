#!/usr/bin/env node
/**
 * gen-store-metadata.mjs — build fastlane `deliver`'s metadata tree from the human-readable
 * listing document, so the copy lives in exactly one place.
 *
 * `deliver` wants one short file per field (metadata/en-US/name.txt, subtitle.txt, …).
 * Maintaining those BESIDE a readable listing doc means the same copy in two places, and
 * duplicated copy drifts — that is how a store listing ends up describing an app that no
 * longer exists. The doc stays the single source; this generates the tree.
 *
 * The review password is spliced in at generate time from a gitignored local file, so the
 * tracked source can carry a REPLACE_WITH_ marker safely. The OUTPUT therefore contains a
 * real credential and must be gitignored — see the skill.
 *
 *   node gen-store-metadata.mjs [--release-dir docs/ops/mobile-releases] [--version 1.2.0]
 *                               [--mobile-dir path] [--locale en-US] [--out path]
 *
 * Exit codes: 0 written · 1 over a store limit or a REPLACE_WITH_ placeholder survived
 *             2 could not locate the inputs
 *
 * Reads   <release-dir>/v<version>/ios/app-store-listing.txt   (the source document)
 *         <release-dir>/v<version>/shared/release-notes.txt    (optional, per-locale blocks)
 *         <release-dir>/v<version>/REVIEW-CREDS.local.txt      (optional, gitignored)
 * Writes  <mobile-dir>/fastlane/metadata/<locale>/*.txt
 *         <mobile-dir>/fastlane/metadata/review_information/*.txt
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const die2 = (msg) => { console.error(`gen-store-metadata: ${msg}`); process.exit(2); };

/**
 * Find the Expo app directory by locating its config, rather than assuming a name.
 *
 * Projects in the wild call this `mobile/`, `mobile_frontend/`, `frontend/`, or
 * `frontend/apps/mobile/` in a monorepo. Depending on the name is how a shared tool ends up
 * with a per-project fork, so the kit resolves it instead.
 */
function findMobileDir(root, depth = 4) {
  const SKIP = new Set(['node_modules', '.git', 'ios', 'android', '.expo', 'dist', 'build']);
  const hits = [];
  const walk = (dir, d) => {
    if (d > depth) return;
    for (const f of ['app.json', 'app.config.ts', 'app.config.js']) {
      const p = join(dir, f);
      // app.json is also a plain npm-ish filename; require an `expo` key to be sure.
      if (existsSync(p)) {
        if (f !== 'app.json') { hits.push(dir); return; }
        try { if (JSON.parse(readFileSync(p, 'utf8')).expo) { hits.push(dir); return; } } catch { /* not ours */ }
      }
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

/** Marketing version, from app.json or a best-effort read of app.config.*. */
function readVersion(mobileDir) {
  const jsonPath = join(mobileDir, 'app.json');
  if (existsSync(jsonPath)) {
    try {
      const v = JSON.parse(readFileSync(jsonPath, 'utf8'))?.expo?.version;
      if (v) return v;
    } catch { /* fall through */ }
  }
  for (const f of ['app.config.ts', 'app.config.js']) {
    const p = join(mobileDir, f);
    if (!existsSync(p)) continue;
    // A dynamic config can compute anything; a literal covers the common case and we say so
    // rather than silently guessing wrong.
    const m = readFileSync(p, 'utf8').match(/version:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return null;
}

const REPO = resolve(arg('repo', process.cwd()));
const MOBILE = resolve(arg('mobile-dir', findMobileDir(REPO) ?? '')) || null;
if (!MOBILE || !existsSync(MOBILE)) {
  die2(`could not find an Expo app under ${REPO} — pass --mobile-dir`);
}
const VERSION = arg('version', readVersion(MOBILE));
if (!VERSION) die2(`could not read a version from ${MOBILE} — pass --version`);

const LOCALE = arg('locale', 'en-US'); // ASC has no entry for every language; localized copy
                                       // can still live inside description.txt.
const RELEASE = resolve(REPO, arg('release-dir', 'docs/ops/mobile-releases'), `v${VERSION}`);
const listingPath = join(RELEASE, 'ios/app-store-listing.txt');
const credsPath = join(RELEASE, 'REVIEW-CREDS.local.txt');
const outRoot = resolve(arg('out', join(MOBILE, 'fastlane/metadata')));
const outDir = join(outRoot, LOCALE);
const reviewDir = join(outRoot, 'review_information');

if (!existsSync(listingPath)) die2(`listing document not found: ${listingPath}`);
const listing = readFileSync(listingPath, 'utf8');

// -------------------------------------------------------------- doc parsing
/**
 * True for a section heading: an unindented ALL-CAPS label, optionally followed by a
 * parenthetical note whose text is free-form ("DESCRIPTION (<=4000 chars — …"). Testing the
 * whole line fails on those, which is how an early version folded SUBTITLE into name.txt.
 */
function isHeading(line) {
  if (!line || /^\s/.test(line)) return false;
  const label = line.split('(')[0].trim();
  return label.length >= 3 && /^[A-Z][A-Z0-9 /&]*$/.test(label);
}

/** Body of the section whose heading starts with `label`.
 *  A heading's parenthetical may WRAP across lines, so the body starts only once the parens
 *  balance — otherwise the tail of the heading lands in the value. */
function section(label, { required = true } = {}) {
  const lines = listing.split('\n');
  const start = lines.findIndex((l) => l.startsWith(label));
  if (start === -1) {
    if (required) die2(`section not found in the listing document: ${label}`);
    return '';
  }
  let i = start, depth = 0;
  do {
    depth += (lines[i].match(/\(/g) || []).length - (lines[i].match(/\)/g) || []).length;
    i++;
  } while (depth > 0 && i < lines.length);

  const body = [];
  for (; i < lines.length; i++) {
    if (isHeading(lines[i])) break;
    if (/^-{10,}$/.test(lines[i].trim())) break;
    body.push(lines[i]);
  }
  return body.join('\n').trim();
}

/** `Label:  value` inside a section body. A trailing "(…)" note is editorial —
 *  "Support URL: https://… (consider a /support page)" — and must not reach ASC. */
function field(body, label) {
  const m = body.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, 'm'));
  return m ? m[1].replace(/\s*\(.*$/, '').trim() : '';
}

function releaseNotes() {
  const p = join(RELEASE, 'shared/release-notes.txt');
  if (!existsSync(p)) return '';
  const raw = readFileSync(p, 'utf8');
  // The file may carry one block per language behind `--- <lang> ---`.
  const lang = arg('notes-lang', LOCALE.split('-')[0]);
  const m = raw.match(new RegExp(`--- ${lang} ---\\n([\\s\\S]*?)(?=\\n--- |\\n*$)`));
  if (m) return m[1].trim();
  if (!/^--- /m.test(raw)) return raw.trim();   // no blocks at all — the whole file
  // A single-language app often ships its own language into the en-US ASC slot (ASC has no
  // entry for every language). Falling back to the only block beats writing nothing, but say
  // which one, so a genuinely missing translation is still visible.
  const first = raw.match(/--- (\S+) ---\n([\s\S]*?)(?=\n--- |\n*$)/);
  if (first) {
    console.warn(`! release-notes: no '${lang}' block; using '${first[1]}' (--notes-lang to override)`);
    return first[2].trim();
  }
  return '';
}

const urls = section('URLS', { required: false });
const review = section('APP REVIEW INFORMATION', { required: false });
const notes = section('NOTES', { required: false });

// The real password never lives in a tracked file — splice it in at generate time.
let password = '';
if (existsSync(credsPath)) {
  const m = readFileSync(credsPath, 'utf8').match(/^\s*Password:\s*(\S+)/m);
  if (m) password = m[1];
} else {
  console.warn(`! ${credsPath} missing — review password left as whatever the doc says`);
}

const files = {
  'name.txt': section('NAME'),
  'subtitle.txt': section('SUBTITLE'),
  'promotional_text.txt': section('PROMOTIONAL TEXT', { required: false }),
  'keywords.txt': section('KEYWORDS'),
  'description.txt': section('DESCRIPTION'),
  'support_url.txt': field(urls, 'Support URL'),
  'marketing_url.txt': field(urls, 'Marketing URL'),
  'privacy_url.txt': field(urls, 'Privacy URL'),
  'release_notes.txt': releaseNotes(),
};

const reviewFiles = {
  'demo_user.txt': field(review, 'Email'),
  'demo_password.txt': password || field(review, 'Password'),
  'first_name.txt': field(review, 'First/Last').split(/\s+/)[0] || '',
  'last_name.txt': field(review, 'First/Last').split(/\s+/).slice(1).join(' ') || '',
  'phone_number.txt': field(review, 'Phone'),
  'email_address.txt': '',
  'notes.txt': notes,
};
// The contact email sits under `Contact`, not the demo block — take the last match.
const emails = [...review.matchAll(/^\s*Email:\s*(\S+@\S+)$/gm)].map((m) => m[1]);
if (emails.length) reviewFiles['email_address.txt'] = emails[emails.length - 1];

// -------------------------------------------------------------------- write
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

let wrote = 0;
const empty = [];
for (const [name, value] of Object.entries(files)) {
  writeFileSync(join(outDir, name), value + '\n');
  if (!value) empty.push(`${LOCALE}/${name}`);
  wrote++;
}
for (const [name, value] of Object.entries(reviewFiles)) {
  writeFileSync(join(reviewDir, name), value + '\n');
  if (!value) empty.push(`review_information/${name}`);
  wrote++;
}

// App Store Connect counts CHARACTERS, not bytes — and any multibyte locale passes a
// byte-length check on copy that ASC then rejects. [...str].length counts code points.
const LIMITS = {
  'name.txt': 30, 'subtitle.txt': 30, 'promotional_text.txt': 170,
  'keywords.txt': 100, 'description.txt': 4000,
};

console.log(`wrote ${wrote} file(s) to ${outRoot} (v${VERSION}, ${LOCALE})`);
console.log(`  source: ${listingPath}`);
for (const [f, max] of Object.entries(LIMITS)) {
  console.log(`  ${f.padEnd(22)} ${String([...(files[f] || '')].length).padStart(4)}/${max} chars`);
}
if (empty.length) console.warn(`! empty: ${empty.join(', ')}`);

const tooLong = Object.entries(LIMITS)
  .filter(([f, max]) => [...(files[f] || '')].length > max)
  .map(([f, max]) => `${f}: ${[...files[f]].length}/${max}`);

// Loud about placeholders: the runbook keeps REPLACE_WITH_ markers on purpose, and shipping
// one to a store is worse than failing here.
const placeholders = Object.entries({ ...files, ...reviewFiles })
  .filter(([, v]) => /REPLACE_WITH_/.test(v))
  .map(([k]) => k);

if (tooLong.length) {
  console.error(`\n✗ over App Store Connect's limit: ${tooLong.join('; ')}`);
}
if (placeholders.length) {
  console.error(`\n✗ placeholder still present in: ${placeholders.join(', ')}`);
  console.error(`  Fill it in ${listingPath} (or REVIEW-CREDS.local.txt) and re-run.`);
}
process.exit(tooLong.length || placeholders.length ? 1 : 0);
