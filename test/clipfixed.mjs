// phase17：夹扣固定在场景里——只转环，夹扣位置/朝向不随被转环的角度变化
import { open, ok, done } from './_page.mjs'; import fs from 'fs';
const { b, p, errs } = await open('?det&seed=3', undefined, process.env.FILE);
const shot = async (box, f) => { const r = await p.evaluate(() => { const c = document.querySelector('canvas'), q = c.getBoundingClientRect(); return { x: q.x, y: q.y, k: q.width / 864 }; });
  return p.screenshot({ path: f, clip: { x: r.x + box[0] * r.k, y: r.y + box[1] * r.k, width: box[2] * r.k, height: box[3] * r.k } }); };
for (const theme of ['default', 'jade']) for (const lv of [1, 20]) {
  await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), theme);
  await p.evaluate(l => { __setSettings({ startLevel: l, showHint: false }); __game.loadLevel(l - 1); __game.state = 'play'; }, lv);
  for (let i = 0; i < 400 && await p.evaluate(() => __themeBusy && __themeBusy()); i++) await p.evaluate(() => __step(50));
  const id = lv === 1 ? 'r' : 'bl';
  const g = async rot => p.evaluate(([id, rot]) => { const G = __game, r = G.rings.find(q => q.id === id); G.rotateRing(r, rot - r.rot); const cw = G.clampWorld(r); __step(1); return { cw: cw.map(v => +v.toFixed(2)), alive: r.alive }; }, [id, rot]);
  const A = await g(0.15); const cw = A.cw, box = [cw[0] - 30, cw[1] - 30, 60, 60]; const fa = `/tmp/clip_${theme}_L${lv}_a.png`, fb = `/tmp/clip_${theme}_L${lv}_b.png`;
  const px = () => p.evaluate(([x, y]) => { const c = document.getElementById('stage'), k = c.width / 864; return Array.from(c.getContext('2d').getImageData((x - 8) * k | 0, (y - 8) * k | 0, 16 * k | 0, 16 * k | 0).data); }, cw);
  const ia = await shot(box, fa); const pa = await px(); const B = await g(-0.25); const ib = await shot(box, fb); const pb = await px();
  ok(A.alive && B.alive && A.cw[0] === B.cw[0] && A.cw[1] === B.cw[1], `${theme} L${lv}: 转环 0.4rad 夹扣世界坐标不变 ${A.cw}`);
  ok(pa && pb, `${theme} L${lv}: 截图 ${fa} / ${fb}`);
  let d = 0; for (let i = 0; i < pa.length; i++) d += Math.abs(pa[i] - pb[i]); d /= pa.length;
  ok(d < 6, `${theme} L${lv}: 夹扣中心像素几乎不变（平均差 ${d.toFixed(2)} < 6）`);
}
// 银色夹扣（子环已脱落后留在父环缺口端的夹扣）：真实鼠标拖动父环，夹扣位置/朝向必须固定
for (const theme of ['jade', 'default']) {
  await p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), theme);
  await p.evaluate(() => { __setSettings({ showHint: false, handImage: '' }); __game.loadLevel(19); __auto(false); const G = __game; for (const id of ['br', 'bl', 'ss']) G.detach(G.rings.find(r => r.id === id)); });
  for (let i = 0; i < 400 && await p.evaluate(() => __themeBusy()); i++) await p.evaluate(() => __step(50));
  await p.evaluate(() => __step(60));
  const info = await p.evaluate(() => { const G = __game, s = G.rings.find(r => r.id === 's'), ss = G.rings.find(r => r.id === 'ss'), q = document.getElementById('stage').getBoundingClientRect(); return { c: s.c, R: s.R, rot: s.rot, cw: G.clampWorld(ss), alive: s.alive, x: q.x, y: q.y, k: q.width / 864 }; });
  const scr = (X, Y) => [info.x + X * info.k, info.y + Y * info.k], cw = info.cw, box = [cw[0] - 40, cw[1] - 40, 80, 80];
  const px = () => p.evaluate(([x, y]) => { const c = document.getElementById('stage'), k = c.width / 864; return Array.from(c.getContext('2d').getImageData((x - 10) * k | 0, (y - 10) * k | 0, 20 * k | 0, 20 * k | 0).data); }, cw);
  const f0 = `/tmp/clipsilver_${theme}_0.png`; await shot(box, f0); const p0 = await px(); const cw0 = cw.map(v => +v.toFixed(2));
  // 真实拖动：从环左侧按下，沿圆弧往上拖 ~35°（分步，含中途截图）
  const a0 = Math.PI, pt = a => scr(info.c[0] + info.R * Math.cos(a), info.c[1] + info.R * Math.sin(a));
  await p.mouse.move(...pt(a0)); await p.mouse.down(); let worst = 0, rotN = [];
  for (let j = 1; j <= 3; j++) { for (let s2 = 0; s2 < 4; s2++) { await p.mouse.move(...pt(a0 + (j - 1 + (s2 + 1) / 4) * 0.2)); await p.evaluate(() => __step(2)); }
    const st = await p.evaluate(() => { const G = __game, s = G.rings.find(r => r.id === 's'), ss = G.rings.find(r => r.id === 'ss'); return { rot: s.rot, cw: G.clampWorld(ss), alive: s.alive }; });
    const f = `/tmp/clipsilver_${theme}_${j}.png`; await shot(box, f); const pj = await px(); let d = 0; for (let i = 0; i < p0.length; i++) d += Math.abs(p0[i] - pj[i]); d /= p0.length; worst = Math.max(worst, d);
    rotN.push(+(st.rot - info.rot).toFixed(3)); ok(Math.hypot(st.cw[0] - cw0[0], st.cw[1] - cw0[1]) < 0.01, `${theme} L20 银扣 拖动第${j}段（环转 ${(st.rot - info.rot).toFixed(2)}rad）位置不变 ${f}`); }
  await p.mouse.up();
  ok(Math.abs(rotN[rotN.length - 1]) > 0.2, `${theme} L20 真实拖动确实转动了父环 ${rotN}`);
  ok(worst < 8, `${theme} L20 银扣中心像素不变（最大平均差 ${worst.toFixed(2)}）`);
}
ok(!errs.length, '无页面错误 ' + errs.join('|')); await b.close(); done('clipfixed');
