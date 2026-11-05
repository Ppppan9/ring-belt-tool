// 主题切换卡顿基准：file:// + 实时 rAF 循环 + CDP CPU 降速；统计长任务与恢复时间
import { chromium } from 'playwright'; import path from 'path';
const file = process.argv[2] || 'index.html', rate = +(process.argv[3] || 4), lv = +(process.argv[4] || 1), seq = ((process.argv[5] !== '-' && process.argv[5]) || 'jade,default,realistic,jade,default,jade').split(','), mode = process.argv[6] || 'idle';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + path.join(ROOT, file) + '?seed=3'); await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await p.evaluate(lv => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: false }); __game.loadLevel(lv - 1); }, lv);
if (mode === 'auto') await p.evaluate(() => __auto(true));
if (mode === 'mid') { await p.evaluate(() => __auto(true)); await p.waitForTimeout(4000); await p.evaluate(() => __auto(false)); }
const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
const res = [];
for (const t of seq) {
  await p.evaluate(() => { window.__lt = []; });
  const t0 = Date.now();
  await p.evaluate(t => { const c = document.querySelector(`.theme-card[data-theme="${t}"]`); c.click(); }, t);
  const tClick = Date.now() - t0;
  // 等到不忙：有 __themeBusy 钩子则轮询（连续 3 次空闲）；否则（旧版同步生成）等 rAF 间隔恢复 < 100ms
  let pv = null;
  for (let idle = 0, k = 0; idle < 3 && k < 4000; k++) {
    const busy = await p.evaluate(() => new Promise(r => { if (window.__themeBusy && window.__themeBusy()) return r(true); const a = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - a > 200))); }));
    if (pv == null) pv = await p.evaluate(() => (window.__themeJob && (j => !j.bg && j.lqPending === 0)(__themeJob())) ? 1 : 0) ? Date.now() - t0 : null;
    idle = busy ? 0 : idle + 1; if (busy) await p.waitForTimeout(50);
  }
  const total = Date.now() - t0, lt = await p.evaluate(() => window.__lt.slice());
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const a = performance.now(); const f = () => { if (++n < 20) requestAnimationFrame(f); else r(Math.round(20000 / (performance.now() - a))); }; requestAnimationFrame(f); }));
  res.push({ t, clickMs: tClick, previewMs: pv, totalMs: total, fps, maxLong: Math.round(Math.max(0, ...lt)), nLong: lt.length });
}
console.log(JSON.stringify({ file, rate, lv, mode, res, errs }));
await b.close();
