import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file:///workspace/ring-belt/index.html?seed=3'); await p.waitForFunction(() => window.__ready);
const c = await p.context().newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[2] || 4) });
await p.evaluate(() => document.querySelector('.theme-card[data-theme="jade"]').click());
for (let i = 0; i < 400; i++) { const s = await p.evaluate(() => ({ ...__themeJob(), fm: __fmax() })); if (s.fm.ms > 150 || i % 8 == 0 || !s.busy) console.log(i * 250, JSON.stringify(s)); if (i === 2) await p.screenshot({ path: '/tmp/sw_early.png' }); if (!s.busy && i > 2) break; await p.waitForTimeout(250); if (i % 8) continue; }
await p.screenshot({ path: '/tmp/sw_end.png' }); console.log(JSON.stringify(await p.evaluate(() => __jobLog().filter(x=>x[2]>20)))); console.log(await p.evaluate(() => __spriteKeys().filter(k => k.startsWith('jade')).length));
await b.close();
