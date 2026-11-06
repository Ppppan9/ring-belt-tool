import { open } from './_page.mjs';
const [theme, out, file] = process.argv.slice(2);
const { b, p, errs } = await open('?det&seed=3', { width: 540, height: 1200 }, file || 'index.html');
await p.evaluate(() => __setSettings({ showHint: false, handImage: '' }));
await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), theme);
for (const lv of [6, 1]) {
  await p.evaluate(l => { __setSettings({ startLevel: l, showHint: false }); __game.loadLevel(l - 1); __game.state = 'play'; }, lv);
  const t0 = Date.now(); for (let i = 0; i < 600 && await p.evaluate(() => __themeBusy && __themeBusy()); i++) await p.evaluate(() => __step(50));
  await p.evaluate(() => __step(60)); console.log('L', lv, 'gen ms', Date.now() - t0);
  await p.locator('canvas').first().screenshot({ path: `${out}_L${lv}.png` });
}
console.log('errs', errs); await b.close();
