import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file:///workspace/ring-belt/index.html?det'); await p.waitForFunction(() => window.__ready);
const c = await p.context().newCDPSession(p);
for (const r of [1, 2, 4, 6]) { await c.send('Emulation.setCPUThrottlingRate', { rate: r }); const v = await p.evaluate(() => { const t = performance.now(); let s = 0; for (let i = 1; i < 2e6; i++) s += Math.sqrt(i) * Math.sin(i); return performance.now() - t; }); console.log(r, v.toFixed(1)); }
await b.close();
