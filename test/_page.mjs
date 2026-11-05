import { chromium } from 'playwright'; import path from 'path'; import fs from 'fs';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export async function open(q = '?det&seed=3', vp = { width: 1400, height: 1000 }, file = 'index.html') {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: vp, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.join(ROOT, file || 'index.html') + q); await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  return { b, p, errs };
}
let nOk = 0, nFail = 0;
export function ok(c, m) { if (c) { nOk++; console.log('  ✓', m); } else { nFail++; console.log('  ✗', m); } }
export function done(name) { console.log(`${name}: ${nOk} passed, ${nFail} failed`); process.exit(nFail ? 1 : 0); }
export async function runAuto(p, maxSec = 200) { await p.evaluate(() => { __setSettings({ loopLevels: false }); __auto(true); }); for (let i = 0; i < maxSec; i++) { await p.evaluate(() => __step(50)); if (await p.evaluate(() => __game.isEnded())) { await p.evaluate(() => __step(60)); return true; } } return false; }
export async function saveDownload(p, fn, dest) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.evaluate(fn)]); const f = path.join(dest, d.suggestedFilename()); await d.saveAs(f); return f; }
