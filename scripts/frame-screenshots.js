#!/usr/bin/env node
/**
 * frame-screenshots.js — render raw app screenshots into framed App Store /
 * Play Store marketing images: brand background + headline + device chassis.
 *
 * Config-driven (no per-app code edits). Point it at a frames.config.json that
 * defines your palette, per-screen eyebrow+headline copy, and screen order.
 *
 *   node frame-screenshots.js <config.json> <rawDir> <outDir> <device>
 *
 *   <config.json>  frames config (see templates/frames.config.json)
 *   <rawDir>       dir of raw <screen-key>.png screenshots (the inputs)
 *   <outDir>       where to write NN-<screen-key>.png framed images
 *   <device>       iphone-6.9 | ipad-13 | android-phone | android-tablet
 *                  | feature-graphic   (or any key under config.devices)
 *
 * Requires Playwright + a Chromium browser:
 *   npm i -D playwright && npx playwright install chromium
 *   # or reuse a monorepo install: NODE_PATH=../node_modules node frame-screenshots.js ...
 *
 * Design rationale (from real App Store ASO research):
 *  - Straight-on device by default (isometric tilt reads dated); `tilt` opt-in.
 *  - Headline in the top third; device below, bleeding off the bottom edge so
 *    sparse screens don't show a white void.
 *  - One consistent background SYSTEM across the set; make the most exciting
 *    frame (live gameplay / hero) the most saturated via a per-screen `tone`.
 *  - Optional energy "pop" chip (big number / rank / %) over the device corner.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Built-in store sizes (current as of 2026 — see docs/store-specs.md, the single
// source of truth). Override or extend via config.devices.
//   kind 'phone'|'tablet' = a portrait device frame; 'graphic' = the landscape
//   Play feature graphic (no device chassis, just background + headline).
const DEFAULT_DEVICES = {
  'iphone-6.9':      { w: 1320, h: 2868, kind: 'phone' },   // iPhone 16/17 Pro Max — Apple's only required iPhone size
  'ipad-13':         { w: 2064, h: 2752, kind: 'tablet' },  // iPad Pro 13" (only if supportsTablet)
  'android-phone':   { w: 1080, h: 1920, kind: 'phone' },   // 16:9 — safe under Play's 1:2..2:1 aspect cap (1080x2400 is REJECTED)
  'android-tablet':  { w: 1600, h: 2560, kind: 'tablet' },  // Play 10-inch tablet
  'feature-graphic': { w: 1024, h: 500,  kind: 'graphic' }, // Play feature graphic (required, landscape, no alpha)
};

function die(msg) { console.error('frame-screenshots: ' + msg); process.exit(1); }

// Escape user-supplied copy so an &, <, or > in a headline can't break the markup.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Read a PNG's pixel dimensions from the IHDR chunk (bytes 16-23), no deps.
function pngSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch { return null; }
}

function loadConfig(p) {
  if (!fs.existsSync(p)) die(`config not found: ${p}`);
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { die(`config is not valid JSON: ${e.message}`); }
  if (!cfg.screens || typeof cfg.screens !== 'object') die('config.screens (object) is required');
  if (!Array.isArray(cfg.order) || cfg.order.length === 0) die('config.order (array of screen keys) is required');
  return cfg;
}

// Resolve a background gradient for a tone, from config.tones or sensible defaults.
function toneCss(cfg, toneName) {
  const tones = cfg.tones || {};
  if (tones[toneName]) return tones[toneName];
  // Fallback: derive from palette so a config without explicit tones still works.
  const p = cfg.palette || {};
  const ground = p.ground || '#15392E';
  const ground2 = p.ground2 || '#0E2A21';
  const accent = p.accent || '#C96E3F';
  const text = p.text || '#F4EFE4';
  const ink = p.ink || '#15201B';
  if (toneName === 'paper') return { bg: `linear-gradient(160deg,#FBF8F0 0%,${text} 55%,#E9E1CF 100%)`, text: ink, eye: accent, eyeLine: accent };
  if (toneName === 'hot')   return { bg: `radial-gradient(90% 60% at 50% 0%,${accent} 0%,${accent} 30%,#9E4F2C 72%,#6E351C 100%)`, text, eye: '#FCEADD', eyeLine: text };
  /* forest / default */     return { bg: `radial-gradient(70% 50% at 18% 8%,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 60%),linear-gradient(155deg,${ground} 0%,${ground} 42%,${ground2} 100%)`, text, eye: '#E7B58C', eyeLine: accent };
}

function buildHTML(cfg, dev, screen, imgDataUri) {
  const t = toneCss(cfg, screen.tone || cfg.defaultTone || 'forest');
  const font = cfg.fontFamily || '-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif';
  const watermark = cfg.watermark || '';

  // Feature graphic: landscape banner, no device chassis — background + headline.
  if (dev.kind === 'graphic') {
    const fg = Math.round(dev.h * 0.18);  // ~90px headline on a 500px-tall banner
    const eg = Math.round(dev.h * 0.05);
    return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:${dev.w}px;height:${dev.h}px;overflow:hidden;}
    .stage{position:relative;width:${dev.w}px;height:${dev.h}px;background:${t.bg};font-family:${font};
      display:flex;flex-direction:column;justify-content:center;padding:0 ${Math.round(dev.w * 0.08)}px;overflow:hidden;}
    .eyebrow{color:${t.eye};font-size:${eg}px;font-weight:800;letter-spacing:5px;margin-bottom:14px;}
    .head{color:${t.text};font-size:${fg}px;font-weight:800;line-height:1.0;letter-spacing:-1.5px;white-space:pre-line;}
    </style></head><body><div class="stage">
      ${screen.eyebrow ? `<div class="eyebrow">${esc(screen.eyebrow)}</div>` : ''}
      <div class="head">${esc(screen.head)}</div>
    </div></body></html>`;
  }

  const isTablet = dev.kind === 'tablet';
  const small = dev.w <= 1100; // android phone canvas is narrow → scale type down
  const tilt = cfg.tilt ? (isTablet ? -4 : -5) : 0;

  const chassis   = isTablet ? 24 : 16;
  const radius    = isTablet ? 76 : small ? 60 : 82;
  const screenRad = radius - chassis;
  const eyebrowFs = isTablet ? 36 : small ? 26 : 32;
  const headFs    = isTablet ? 120 : small ? 84 : 108;
  const padTop    = isTablet ? 140 : small ? 96 : 116;
  const sidePad   = isTablet ? 150 : small ? 72 : 92;
  const align     = cfg.headlineAlign || 'center';

  const deviceW      = Math.round(dev.w * (isTablet ? 0.78 : small ? 0.70 : 0.82));
  const deviceBottom = -Math.round(dev.h * (isTablet ? 0.09 : 0.10));

  const pop = screen.pop;
  const popColor = (pop && pop.color) || (cfg.palette && cfg.palette.accent) || '#C96E3F';
  const popHTML = pop ? `
    <div class="pop" style="--pc:${esc(popColor)}">
      <div class="pop-big">${esc(pop.big)}</div>
      ${pop.sub ? `<div class="pop-sub">${esc(pop.sub)}</div>` : ''}
    </div>` : '';

  const wmHTML = watermark ? `<div class="wm">${watermark}</div>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${dev.w}px;height:${dev.h}px;overflow:hidden;}
  .stage{position:relative;width:${dev.w}px;height:${dev.h}px;background:${t.bg};font-family:${font};overflow:hidden;}
  .wm{position:absolute;left:-${dev.w * 0.06}px;bottom:-${dev.h * 0.05}px;font-size:${dev.w * 0.6}px;font-weight:900;line-height:.8;color:rgba(255,255,255,0.035);letter-spacing:-10px;user-select:none;}
  .copy{position:absolute;top:${padTop}px;left:${sidePad}px;right:${sidePad}px;z-index:3;text-align:${align};}
  .eyebrow{display:inline-block;color:${t.eye};font-size:${eyebrowFs}px;font-weight:800;letter-spacing:${isTablet ? 7 : 5}px;padding-bottom:${isTablet ? 16 : 12}px;margin-bottom:${isTablet ? 24 : 18}px;border-bottom:3px solid ${t.eyeLine};}
  .head{color:${t.text};font-size:${headFs}px;font-weight:800;line-height:1.02;letter-spacing:-2px;white-space:pre-line;}
  .device-wrap{position:absolute;left:50%;bottom:${deviceBottom}px;width:${deviceW}px;transform:translateX(-50%) rotate(${tilt}deg);transform-origin:50% 100%;filter:drop-shadow(0 50px 80px rgba(0,0,0,0.40));z-index:2;}
  .chassis{width:${deviceW}px;background:linear-gradient(135deg,#2b2b30 0%,#0a0a0c 60%);border-radius:${radius}px;padding:${chassis}px;box-shadow:inset 0 0 0 2px rgba(255,255,255,0.08);}
  .screen{width:100%;border-radius:${screenRad}px;overflow:hidden;display:block;background:#fff;}
  .screen img{width:100%;display:block;}
  .pop{position:absolute;z-index:4;right:${isTablet ? dev.w * 0.10 : dev.w * 0.05}px;top:${dev.h * 0.30}px;width:${isTablet ? 250 : small ? 180 : 205}px;height:${isTablet ? 250 : small ? 180 : 205}px;border-radius:50%;background:var(--pc);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 24px 50px rgba(0,0,0,0.35),inset 0 0 0 ${isTablet ? 8 : 6}px rgba(255,255,255,0.18);transform:rotate(-8deg);}
  .pop-big{color:#fff;font-size:${isTablet ? 90 : small ? 64 : 76}px;font-weight:900;letter-spacing:-2px;line-height:1;}
  .pop-sub{color:rgba(255,255,255,0.92);font-size:${isTablet ? 24 : 20}px;font-weight:800;letter-spacing:2px;margin-top:6px;}
  </style></head><body><div class="stage">
    ${wmHTML}
    <div class="copy"><div class="eyebrow">${esc(screen.eyebrow)}</div><div class="head">${esc(screen.head)}</div></div>
    <div class="device-wrap"><div class="chassis"><div class="screen"><img src="${imgDataUri}"/></div></div></div>
    ${popHTML}
  </div></body></html>`;
}

(async () => {
  const [, , configPath, rawDir, outDir, deviceKey] = process.argv;
  if (!configPath || !rawDir || !outDir || !deviceKey) {
    die('usage: frame-screenshots.js <config.json> <rawDir> <outDir> <device>');
  }
  const cfg = loadConfig(configPath);
  const devices = { ...DEFAULT_DEVICES, ...(cfg.devices || {}) };
  const dev = devices[deviceKey];
  if (!dev) die(`unknown device "${deviceKey}". Known: ${Object.keys(devices).join(', ')}`);
  if (!fs.existsSync(rawDir)) die(`rawDir not found: ${rawDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: 1 });

  let n = 0, skipped = [];
  for (const key of cfg.order) {
    const screen = cfg.screens[key];
    if (!screen) { skipped.push(`${key} (no config.screens entry)`); continue; }
    // Resolve the raw image: <key>.png, or a per-device/per-screen fallback list.
    let src = path.join(rawDir, key + '.png');
    if (!fs.existsSync(src) && screen.fallback) {
      const fb = Array.isArray(screen.fallback) ? screen.fallback : [screen.fallback];
      const hit = fb.map(k => path.join(rawDir, k + '.png')).find(fs.existsSync);
      if (hit) src = hit;
    }
    // The feature graphic has no device screen — it doesn't consume a raw.
    if (dev.kind !== 'graphic' && !fs.existsSync(src)) { skipped.push(`${key} (no raw png in ${rawDir})`); continue; }

    let imgDataUri = '';
    if (dev.kind !== 'graphic') {
      // Warn if the raw's aspect ratio is far from the device's, or it's tiny —
      // the chassis stretches the <img> to fit, so a wrong-shape/low-res raw
      // ships distorted with no error otherwise.
      const sz = pngSize(src);
      if (sz) {
        const rawAR = sz.w / sz.h, devAR = dev.w / dev.h;
        if (Math.abs(rawAR - devAR) / devAR > 0.12) {
          console.warn(`  ⚠ ${key}: raw is ${sz.w}x${sz.h} (aspect ${rawAR.toFixed(2)}) but ${deviceKey} is ${devAR.toFixed(2)} — it will be stretched. Recapture at the device aspect.`);
        }
        if (sz.w < dev.w * 0.5) {
          console.warn(`  ⚠ ${key}: raw width ${sz.w}px is low for a ${dev.w}px frame — it may look soft.`);
        }
      }
      imgDataUri = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');
    }
    await page.setContent(buildHTML(cfg, dev, screen, imgDataUri), { waitUntil: 'networkidle' });
    n++;
    const out = path.join(outDir, String(n).padStart(2, '0') + '-' + key + '.png');
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: dev.w, height: dev.h } });
    console.log('rendered:', out);
  }
  await browser.close();
  if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '));
  console.log(`done: ${n} frame(s) at ${dev.w}x${dev.h} (${deviceKey})`);
})();
