// 回归：主题背景像素采样（贴图晚到 / 主题切换后不得落到玉石程序背景）
import { chromium } from 'playwright'; import path from 'path'; import { ROOT, ok, done } from './_page.mjs';
const px = p => p.evaluate(() => { const c = __bg(), d = c.getContext('2d').getImageData(432, 760, 1, 1).data; return [d[0], d[1], d[2], !!c.__miss]; });
const brown = c => c[0] > c[1] && c[1] > c[2] && c[0] - c[2] > 30;
for (const delay of [0, 1500]) {
  const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 540, height: 1200 } })).newPage();
  if (delay) await p.addInitScript(d => { const D = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { setTimeout(() => D.set.call(this, v), d); }, get() { return D.get.call(this); } }); }, delay);
  await p.goto('file://' + path.join(ROOT, process.env.RB_FILE || 'index.html') + (process.env.RB_Q ?? '?det&seed=3')); await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  for (const t of ['jade', 'wood', 'candy', 'default', 'wood']) {
    await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), t);
    await p.waitForTimeout(delay ? delay + 800 : 100);
    for (let i = 0; i < 600 && await p.evaluate(() => __themeBusy && __themeBusy()); i++) await p.evaluate(() => __step(50));
    const c = await px(p);
    if (t === 'wood' || t === 'candy') ok(brown(c) && !c[3], `delay${delay} ${t} 背景为参考木板 (${c})`); else ok(true, `delay${delay} ${t} (${c})`);
  }
  await b.close();
}
done('bgtheme');
