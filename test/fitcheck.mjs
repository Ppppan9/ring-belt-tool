// phase37：所有关卡 × 主题，环组外沿（R+最大管宽+余量）须在棋盘深色内框内
import { open, ok, done } from './_page.mjs';
const { b, p } = await open('?det&seed=3', { width: 540, height: 1200 });
const n = await p.evaluate(() => __game.levels().length);
for (const lv of [...Array(Math.max(n, 20)).keys()].map(i => i + 1)) {
  const r = await p.evaluate(l => { __game.loadLevel(l - 1); return __boardIn(); }, lv);
  const fit = r.b.x0 >= r.B.x0 - 0.5 && r.b.x1 <= r.B.x1 + 0.5 && r.b.y0 >= r.B.y0 - 0.5 && r.b.y1 <= r.B.y1 + 0.5;
  ok(fit, `L${lv} 环组 [${[r.b.x0, r.b.y0, r.b.x1, r.b.y1].map(v => v.toFixed(0))}] ⊂ 内框`);
}
await b.close(); done('fitcheck');
