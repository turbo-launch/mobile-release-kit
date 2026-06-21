#!/usr/bin/env node
/**
 * contact-sheet.js — tile every PNG in a directory into one review image, so you
 * can judge a whole screenshot set's rhythm at a glance (and read a few back).
 *
 *   node contact-sheet.js <dir> <out.png> [cols]
 *
 * Requires Playwright + Chromium (same as frame-screenshots.js).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [, , dir, out, colsArg] = process.argv;
  if (!dir || !out) { console.error('usage: contact-sheet.js <dir> <out.png> [cols]'); process.exit(1); }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  if (!files.length) { console.error('no PNGs in ' + dir); process.exit(1); }
  const COLS = parseInt(colsArg || '5', 10);
  const cells = files.map(f => {
    const b64 = fs.readFileSync(path.join(dir, f)).toString('base64');
    return `<div class="c"><img src="data:image/png;base64,${b64}"/><div class="l">${f}</div></div>`;
  }).join('');
  const W = COLS * 340 + 40;
  const html = `<!doctype html><meta charset="utf-8"><style>
   *{margin:0;box-sizing:border-box;font-family:-apple-system,Arial}
   body{background:#1a1a1a;padding:20px;width:${W}px}
   .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:16px}
   .c{background:#000;border-radius:8px;overflow:hidden}
   .c img{width:100%;display:block}
   .l{color:#bbb;font-size:13px;padding:6px 8px;text-align:center;word-break:break-all}
  </style><div class="grid">${cells}</div>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 100 } });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log('sheet:', out, `(${files.length} tiles, ${COLS} cols)`);
})();
