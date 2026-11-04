import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + process.cwd() + '/index.html?det=1&seed=3'); await p.waitForFunction(() => window.__ready);
await p.evaluate(() => { __game.loadLevel(1); window.__auto(true); });
for (let i = 0; i < 16; i++) { await p.evaluate(() => __step(25)); console.log(await p.evaluate(() => JSON.stringify({ ev: __game.events.filter(e => !['land', 'box'].includes(e.name)).slice(-2).map(e => e.name + e.ring), rings: __game.rings.map(r => [r.id, r.alive, +r.rot.toFixed(2)]), drag: __game.drag && __game.drag.ring.id, f: [__finger.x | 0, __finger.y | 0] }))); }
await b.close();
