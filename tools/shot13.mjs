// 用法: node tools/shot13.mjs file theme lv out [extraSettingsJSON]
import { chromium } from 'playwright';
const [file, th, lv, out, extra] = process.argv.slice(2);
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 2000 } });
await ctx.route('**/*', r => r.continue({ headers: { ...r.request().headers(), 'cache-control': 'no-cache' } }));
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:8731/${file}?det&seed=3&nocache=${Date.now()}`); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await p.evaluate(([th, lv, ex]) => { __setSettings({ theme: th, ...(ex ? JSON.parse(ex) : {}) }); __game.loadLevel(lv - 1); __step(20); }, [th, +lv, extra || '']);
await p.waitForTimeout(600); await p.evaluate(() => __step(1)); await p.locator('#stage').screenshot({ path: out }); console.log(out, errs.join('|')); await b.close();
