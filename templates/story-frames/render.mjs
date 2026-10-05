// Frames → store PNGs + a contact sheet per language. No dependencies: it drives a local Chrome.
//   node render.mjs [--lang en,de] [--only hero,score] [--device iphone-6.9,android-phone] [--page frames.html] [--out out]
//   CHROME=/path/to/chrome node render.mjs      (default is the macOS Chrome path)
// Output: out/<device>/<lang>/NN-<id>.png, out/contact-<device>-<lang>.png. Run beside frames.html.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const flag = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
// w×h are the design space; dsf scales it to the store's pixels. Every phone uses the same 440-wide layout.
const DEVICES = {
  'iphone-6.9': { w: 440, h: 956, dsf: 3 },                       // 1320×2868, Apple's required size
  'iphone-6.5': { w: 440, h: 952, dsf: 1284 / 440 },              // 1284×2778, ASC's 6.5" slot
  'android-phone': { w: 440, h: 880, dsf: 1080 / 440 },           // 1080×2160: Play rejects a long edge over 2× the short
  'ipad-13': { w: 1032, h: 1376, dsf: 2 },                        // 2064×2752
  'android-tablet': { w: 720, h: 1280, dsf: 2 },                  // 1440×2560 (9:16)
};
const LANGS = flag('lang', 'en').split(',');
const ONLY = flag('only')?.split(',');
const WANT = flag('device', Object.keys(DEVICES).join(',')).split(',');
const PAGE = flag('page', 'frames.html');
const OUT = join(HERE, flag('out', 'out'));
const html = readFileSync(join(HERE, PAGE), 'utf8');
const ids = [...html.matchAll(/\{ id: '([\w-]+)'/g)].map((m) => m[1]);

const shoot = (url, out, w, h, dsf) => execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  `--force-device-scale-factor=${dsf}`, `--window-size=${w},${h}`, '--virtual-time-budget=15000', `--screenshot=${out}`, url,
], { stdio: 'ignore' });

for (const device of WANT) for (const lang of LANGS) {
  const { w, h, dsf } = DEVICES[device];
  const dir = join(OUT, device, lang);
  mkdirSync(dir, { recursive: true });
  const made = [];
  ids.forEach((id, i) => {
    const name = `${String(i + 1).padStart(2, '0')}-${id}.png`;
    if (!ONLY || ONLY.includes(id)) { shoot(`file://${join(HERE, PAGE)}#${id}:${lang}:${h}:${w}`, join(dir, name), w, h, dsf); console.log('framed', device, lang, name); }
    made.push(name);
  });
  const tw = w > 600 ? 330 : 220, sheet = join(OUT, `contact-${device}-${lang}.html`);
  writeFileSync(sheet, `<html><body style="margin:0;padding:16px;background:#e8e6df;display:flex;gap:12px">${made
    .map((n) => `<img src="${device}/${lang}/${n}" style="width:${tw}px;border-radius:14px">`).join('')}</body></html>`);
  shoot(`file://${sheet}`, join(OUT, `contact-${device}-${lang}.png`), 32 + made.length * (tw + 12) - 12, Math.ceil(tw * h / w) + 32, 2);
}
