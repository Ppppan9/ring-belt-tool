// phase16：主题切换不卡死 —— 实时 rAF 循环（非 det）+ CDP CPU 4× 降速，模拟弱 Windows 机。
// 断言：无 >300ms 长任务；进度提示出现；切换期间输入/循环不阻塞；自动演示继续；生成最终完成（不挂起）；
// 已缓存主题再切换即时；快速连切取消过期任务。
import { open, ok, done } from './_page.mjs';
const RATE = +(process.env.THROTTLE || 4);
const { b, p, errs } = await open('?seed=3');
await p.evaluate(() => {
  window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
  window.__rafN = 0; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f);
  __setSettings({ loopLevels: false, autoStartDelay: 0 });
});
const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const sw = t => p.evaluate(t => document.querySelector(`.theme-card[data-theme="${t}"]`).click(), t);
const busy = () => p.evaluate(() => __themeBusy());
async function waitIdle(maxMs) { const t0 = Date.now(); let n = 0, tf = 0; while (Date.now() - t0 < maxMs) { if (!(await busy())) { if (!n++) tf = Date.now() - t0; if (n >= 3) return tf; } else n = 0; await p.waitForTimeout(100); } return -1; }
const maxLT = () => p.evaluate(() => { const m = Math.max(0, ...window.__lt); window.__lt = []; return m; });
await p.waitForTimeout(2500); await maxLT();

// 1) 首次切到玉石（最重）：点击立即返回、出现进度提示、输入与循环不阻塞
const gt0 = await p.evaluate(() => __game.time);
let t0 = Date.now(); await sw('jade'); const clickMs = Date.now() - t0;
await p.evaluate(() => __auto(true)); // 切换后立即开自动演示：生成期间演示必须照常推进
ok(clickMs < 300, `点击玉石立即返回（${clickMs}ms）`);
await p.waitForTimeout(300);
const j = await p.evaluate(() => __themeJob());
ok(j.busy && j.progress && j.progress.visible && /正在生成玉石材质/.test(j.progress.text), `进度提示：${j.progress && j.progress.text}`);
const lag = []; const raf0 = await p.evaluate(() => __rafN);
for (let i = 0; i < 10; i++) { const a = Date.now(); await p.evaluate(() => 1); lag.push(Date.now() - a); await p.waitForTimeout(200); }
const raf1 = await p.evaluate(() => __rafN);
ok(Math.max(...lag) < 500, `生成期间主线程响应（Playwright 往返，含 4× 降速 IPC）<500ms（最大 ${Math.max(...lag)}ms）`);
ok(raf1 - raf0 >= 5, `生成期间游戏循环持续运行（2s 内 ${raf1 - raf0} 帧）`);
// 自动演示在生成期间持续推进：采样手指位置/步骤，忙碌期间应有变化
const samp = new Set(); let busyN = 0; for (let k = 0; k < 16; k++) { const q = await p.evaluate(() => ({ b: __themeBusy(), s: JSON.stringify([__game.state, Math.round(__finger.x), Math.round(__finger.y), __autoState() && [__autoState().step, __autoState().t.toFixed(2)], __game.rings.filter(r => r.alive).length]) })); if (q.b) { busyN++; samp.add(q.s); } await p.waitForTimeout(200); }
const gt1 = await p.evaluate(() => __game.time), auOn = await p.evaluate(() => !!__autoState());
await p.evaluate(() => __auto(false)); const tA = Date.now(), wI = await waitIdle(150000); const tAll = wI < 0 ? -1 : Date.now() - t0;
ok(auOn && gt1 - gt0 >= 1 && samp.size >= 3, `生成期间游戏与自动演示持续推进（游戏时间 +${(gt1 - gt0).toFixed(1)}s，${samp.size} 种演示状态（关卡状态/手指/演示步骤计时/剩余环）（忙碌采样 ${busyN}），自动演示仍开启=${auOn}）`);
ok(tAll >= 0, `玉石材质全部生成完成，未挂起（${tAll}ms @${RATE}×，slow=${j.slow}）`);
const m1 = await maxLT(); ok(m1 < 300, `首次切换期间最长任务 ${m1}ms < 300ms`);

// 2) 再切回已缓存主题：即时（停自动演示，避免进入新关卡后按需生成新关卡精灵）
await p.evaluate(() => __auto(false)); await waitIdle(60000); await maxLT();
for (const t of ['default', 'jade']) {
  t0 = Date.now(); await sw(t); const w = await waitIdle(5000), tot = Date.now() - t0, m = await maxLT();
  ok(w >= 0 && tot < 1500 && m < 300, `已缓存「${t}」再切换即时（${tot}ms，最长任务 ${m}ms）`);
}

// 3) 快速连切（超写实→原版）：过期任务取消，最终落在原版且很快空闲
await sw('jade'); await p.waitForTimeout(150); await sw('default');
const w3 = await waitIdle(5000), cur = await p.evaluate(() => __S ? __S().theme : null), m3 = await maxLT();
ok(w3 >= 0 && w3 < 3000, `连切后过期的超写实任务被取消（${w3}ms 空闲）`);
ok(cur === 'default', `最终主题 = default（${cur}）`);
ok(m3 < 300, `连切期间最长任务 ${m3}ms < 300ms`);
ok(await p.evaluate(() => __spriteKeys().filter(k => k.startsWith('jade')).length > 0), '玉石精灵缓存保留（切换不清空）');
ok(errs.length === 0, '无页面错误' + (errs.length ? '：' + errs.slice(0, 3).join(' | ') : ''));
await b.close(); done('themeswitch');
