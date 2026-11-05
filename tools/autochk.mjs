import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await p.goto('file:///workspace/ring-belt/index.html?seed=3'); await p.waitForFunction(() => window.__ready);
await p.evaluate(() => { __setSettings({ loopLevels: false, autoStartDelay: 0 }); __auto(true); });
for (let k = 0; k < 15; k++) { console.log(await p.evaluate(() => JSON.stringify([__game.state, Math.round(__finger.x), Math.round(__finger.y), __autoState(), __game.time.toFixed(1)]))); await p.waitForTimeout(300); }
await b.close();
