import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log('CERR', m.text()));
await p.goto('file://' + process.cwd() + '/index.html?det=1&seed=3'); await p.waitForFunction(() => window.__ready, null, { timeout: 15000 });
const shot = async n => { const d = await p.evaluate(() => document.getElementById('cv').toDataURL()); (await import('fs')).writeFileSync(`/tmp/${n}.png`, Buffer.from(d.split(',')[1], 'base64')); };
await shot('s0'); await p.evaluate(() => window.__auto(true));
for (let i = 0; i < 75; i++) { await p.evaluate(() => window.__step(50)); const st = await p.evaluate(() => ({ l: __game.levelIdx, s: __game.state, b: __game.balls.filter(b => b.state !== 'boxed').length, belt: __game.belt.slots.filter(Boolean).length })); console.log(i + 1, JSON.stringify(st)); if (i % 4 == 1) await shot('s' + (i + 1)); }
console.log(JSON.stringify(await p.evaluate(() => __game.events.map(e => [e.name, +e.t.toFixed(2), e.level, e.ring || e.color || '']))).slice(0, 3000));
await b.close();
