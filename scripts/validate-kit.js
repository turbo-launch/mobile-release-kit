#!/usr/bin/env node
/**
 * validate-kit.js — structural checks for the plugin, runnable anywhere (no deps).
 * Run locally or in CI:  node scripts/validate-kit.js
 *
 * Checks:
 *  - every *.json parses
 *  - .claude-plugin/plugin.json + marketplace.json have required fields
 *  - every skills/<name>/SKILL.md, commands/*.md, agents/*.md has a --- fenced
 *    frontmatter with the required keys (name/description for skills+agents,
 *    description for commands), and skill descriptions are <=1024 chars
 *  - every templates/* / scripts/* path referenced from a skill/command/agent exists
 *
 * Exits non-zero on any failure (so CI fails). `claude plugin validate --strict`
 * is the authoritative local gate; this mirrors its structural checks for CI,
 * where the claude CLI isn't available.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };
const ok = (m) => console.log('✓ ' + m);

function ls(glob) {
  // tiny glob: dir + extension, no deps
  return cp.execSync(`find . -type f -not -path './.git/*' -not -path './node_modules/*'`, { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).map((p) => p.replace(/^\.\//, ''));
}
const files = ls();

// 1. JSON parses
for (const f of files.filter((f) => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); ok(`json ${f}`); }
  catch (e) { fail(`json ${f}: ${e.message}`); }
}

// 2. plugin + marketplace required fields
function requireFields(file, fields) {
  let o;
  try { o = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch { return fail(`${file}: unreadable`); }
  for (const k of fields) if (o[k] === undefined) fail(`${file}: missing "${k}"`);
}
if (files.includes('.claude-plugin/plugin.json')) requireFields('.claude-plugin/plugin.json', ['name']);
if (files.includes('.claude-plugin/marketplace.json')) requireFields('.claude-plugin/marketplace.json', ['name', 'owner', 'plugins']);

// 3. frontmatter on skills / commands / agents
function frontmatter(file) {
  const t = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = t.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  // good-enough line parser: "key: value" or "key: >-" block scalar (value on next indented lines)
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const km = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!km) continue;
    let [, key, val] = km;
    if (val === '>-' || val === '>' || val === '|') {
      const buf = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) buf.push(lines[++i].trim());
      val = buf.join(' ');
    }
    fm[key] = val.replace(/^["']|["']$/g, '');
  }
  return fm;
}
for (const f of files.filter((f) => f.startsWith('skills/') && f.endsWith('SKILL.md'))) {
  const fm = frontmatter(f);
  if (!fm) { fail(`${f}: no frontmatter`); continue; }
  if (!fm.name) fail(`${f}: missing name`);
  if (!fm.description) fail(`${f}: missing description`);
  else if (fm.description.length > 1024) fail(`${f}: description > 1024 chars (${fm.description.length})`);
  if (fm.name && fm.description) ok(`skill ${f}`);
}
for (const f of files.filter((f) => f.startsWith('agents/') && f.endsWith('.md'))) {
  const fm = frontmatter(f);
  if (!fm || !fm.name || !fm.description) fail(`${f}: needs name + description frontmatter`);
  else ok(`agent ${f}`);
}
for (const f of files.filter((f) => f.startsWith('commands/') && f.endsWith('.md'))) {
  const fm = frontmatter(f);
  if (!fm || !fm.description) fail(`${f}: needs description frontmatter`);
  else ok(`command ${f}`);
}

// 4. referenced templates/scripts/docs paths exist
const refRe = /\b((?:templates|scripts|docs)\/[A-Za-z0-9._\/-]+\.[A-Za-z]+)/g;
for (const f of files.filter((f) => f.endsWith('.md') && (f.startsWith('skills/') || f.startsWith('commands/') || f.startsWith('agents/')))) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(refRe)) {
    const ref = m[1];
    if (!fs.existsSync(path.join(ROOT, ref))) fail(`${f}: references missing ${ref}`);
  }
}

console.log(`\n${errors ? errors + ' error(s)' : 'all checks passed'}`);
process.exit(errors ? 1 : 0);
