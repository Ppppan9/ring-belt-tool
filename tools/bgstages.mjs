import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await p.goto('file:///workspace/ring-belt/index.html?seed=3'); await p.waitForFunction(() => window.__ready);
const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[2] || 4) });
await p.evaluate(() => { window.__ckT = []; document.querySelector('.theme-card[data-theme="jade"]').click(); });
await p.waitForFunction(() => !__themeJob().bg, null, { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => __ckT.filter(x => x[1] > 60))));
await b.close();
