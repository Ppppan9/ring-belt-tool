import { chromium } from 'playwright';
const b = await chromium.launch();
for (const f of process.argv.slice(2)) { const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await p.goto('file:///workspace/ring-belt/' + f + '?seed=3'); await p.waitForFunction(() => window.__ready);
await p.evaluate(() => document.querySelector('.theme-card[data-theme="jade"]').click());
await p.waitForFunction(() => !window.__themeBusy || !__themeBusy(), null, { timeout: 120000 }); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/jade_' + f.replace('.html', '') + '.png' }); }
await b.close();
