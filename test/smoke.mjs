import { chromium } from 'playwright';
import path from 'path';
const url = 'file://' + path.resolve('index.html') + '?det&seed=3';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(url); await p.waitForFunction(() => window.__ready, null, { timeout: 15000 }).catch(() => {});
console.log('ready', await p.evaluate(() => !!window.__ready));
await p.evaluate(() => { __setSettings({ loopLevels: false }); __aeStart(); __auto(true); });
for (let i = 0; i < 60; i++) { await p.evaluate(() => __step(50)); if (await p.evaluate(() => __game.isEnded() && __game.lcT > 2)) break; }
console.log(await p.evaluate(() => ({ lvl: __game.levelIdx, st: __game.state, ended: __game.isEnded(), cursor: document.getElementById('stage').style.cursor, items: __items().length })));
const ae = await p.evaluate(async () => { __aeStop(); const o = await __aeExport(); return o && { name: o.name, stats: o.stats }; });
console.log('ae', JSON.stringify(ae));
const d3 = await p.evaluate(async () => { const o = await __export3d(); return o && { name: o.name, stats: o.stats, size: o.blob.size }; });
console.log('3d', JSON.stringify(d3));
await p.screenshot({ path: '/tmp/smoke.png' });
console.log('errs', errs.slice(0, 8)); await b.close();
