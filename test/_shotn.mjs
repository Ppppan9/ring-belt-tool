import { open } from './_page.mjs'; import fs from 'fs';
const [theme, out, file] = process.argv.slice(2);
const { b, p, errs } = await open('?det&seed=3', { width: 540, height: 1200 }, file || 'index.html');
await p.evaluate(() => __setSettings({ showHint: false, handImage: '' }));
await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), theme);
for (const lv of [6, 1]) {
  await p.evaluate(l => { __setSettings({ startLevel: l, showHint: false }); __game.loadLevel(l - 1); __game.state = 'play'; }, lv);
  for (let i = 0; i < 600 && await p.evaluate(() => __themeBusy && __themeBusy()); i++) await p.evaluate(() => __step(50));
  await p.evaluate(() => __step(60));
  const d = await p.evaluate(() => { const c = document.querySelector('canvas'); return [c.width, c.height, c.toDataURL('image/png')]; });
  console.log('backing', d[0], d[1]); fs.writeFileSync(`${out}_L${lv}.png`, Buffer.from(d[2].split(',')[1], 'base64'));
}
console.log('errs', errs); await b.close();
